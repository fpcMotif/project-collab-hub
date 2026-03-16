import { anyApi, httpRouter } from "convex/server";
import type { GenericActionCtx } from "convex/server";

import type { DataModel, Id } from "./_generated/dataModel";
import { httpAction } from "./_generated/server";
import {
  createFeishuSignature,
  extractChallenge,
  extractEventHeader,
  extractProjectIdFromUrl,
  getRecord,
  getString,
  isFreshFeishuTimestamp,
  mapApprovalStatus,
  mapTaskStatus,
  parseJsonRecord,
  sanitizeLogInput,
  toConvexId,
} from "./lib/feishu-webhook";

type CallableCtx = GenericActionCtx<DataModel>;

const http = httpRouter();
const FEISHU_MAX_SKEW_MS = 5 * 60 * 1000;

const jsonResponse = (body: unknown, status = 200) =>
  Response.json(body, { status });

// ── Request Parsing & Verification ──────────────────────────────────────

const parseRequestBody = async (
  request: Request
): Promise<{ body: Record<string, unknown>; rawBody: string } | null> => {
  const rawBody = await request.text();
  const body = parseJsonRecord(rawBody);
  return body ? { body, rawBody } : null;
};

const verifyFeishuRequest = async (
  request: Request,
  rawBody: string,
  body: Record<string, unknown>
): Promise<string | null> => {
  const secret = process.env.FEISHU_APP_SECRET;
  if (!secret) {
    return null;
  }

  const timestamp = request.headers.get("x-lark-request-timestamp") ?? "";
  const nonce = request.headers.get("x-lark-request-nonce") ?? "";
  const signature = request.headers.get("x-lark-signature") ?? "";

  if (!timestamp || !nonce || !signature) {
    return "Missing Feishu signature headers";
  }

  if (!isFreshFeishuTimestamp(timestamp, Date.now(), FEISHU_MAX_SKEW_MS)) {
    return "Expired Feishu request timestamp";
  }

  const expectedSignature = await createFeishuSignature(
    secret,
    timestamp,
    nonce,
    rawBody
  );

  if (expectedSignature !== signature) {
    return "Invalid Feishu request signature";
  }

  const verificationToken = process.env.FEISHU_VERIFICATION_TOKEN;
  const { token } = extractEventHeader(body);
  if (verificationToken && token && token !== verificationToken) {
    return "Invalid Feishu verification token";
  }

  return null;
};

// ── Audit Logging ───────────────────────────────────────────────────────

const logIntegrationEvent = async (
  ctx: CallableCtx,
  args: {
    action: string;
    changeSummary: string;
    idempotencyKey?: string;
    objectId: string;
    objectType: string;
    projectId?: Id<"projects">;
  }
) => {
  await ctx.runMutation(anyApi.auditEvents.logIntegrationEvent, {
    action: args.action,
    actorId: "feishu_bot",
    changeSummary: args.changeSummary,
    idempotencyKey: args.idempotencyKey,
    objectId: args.objectId,
    objectType: args.objectType,
    projectId: args.projectId,
    sourceEntry: "feishu_webhook",
  });
};

// ── Internal Handlers ───────────────────────────────────────────────────

const handleApprovalEvent = async (
  ctx: CallableCtx,
  body: Record<string, unknown>,
  eventId: string
) => {
  const event = getRecord(body, "event");
  if (!event) {
    return;
  }

  const instanceCode = getString(event, "instance_code");
  const approvalStatus = mapApprovalStatus(getString(event, "status"));

  if (!instanceCode || !approvalStatus) {
    return;
  }

  const gate = (await ctx.runQuery(anyApi.approvalGates.getByInstanceCode, {
    instanceCode,
  })) as unknown as { _id: string } | null;
  if (!gate) {
    return;
  }

  await ctx.runMutation(anyApi.approvalGates.resolve, {
    id: gate._id,
    idempotencyKey: eventId,
    instanceCode,
    resolvedBy: getString(event, "user_id") ?? "system",
    status: approvalStatus,
  });
};

const handleTaskEvent = async (
  ctx: CallableCtx,
  body: Record<string, unknown>,
  eventId: string,
  eventType: string
) => {
  const existingReceipt = await ctx.runQuery(
    anyApi.feishuEventReceipts.getByEventId,
    { eventId }
  );
  if (existingReceipt && existingReceipt.status !== "pending_retry") {
    return;
  }

  const payload = JSON.stringify(body);
  const event = getRecord(body, "event");
  if (!event) {
    await ctx.runMutation(anyApi.feishuEventReceipts.upsert, {
      eventId,
      eventType,
      payload,
      reason: "missing_event_payload",
      status: "ignored",
    });
    return;
  }

  const taskGuid = getString(event, "task_id") ?? getString(event, "guid");
  if (!taskGuid) {
    await ctx.runMutation(anyApi.feishuEventReceipts.upsert, {
      eventId,
      eventType,
      payload,
      reason: "missing_task_guid",
      status: "ignored",
    });
    return;
  }

  const mappedTaskStatus = mapTaskStatus(event, eventType);
  if (!mappedTaskStatus) {
    await ctx.runMutation(anyApi.feishuEventReceipts.upsert, {
      eventId,
      eventType,
      payload,
      reason: `unsupported_task_status:${sanitizeLogInput(getString(event, "status") ?? "unknown")}`,
      status: "ignored",
      taskGuid,
    });
    return;
  }

  const binding = await ctx.runQuery(anyApi.feishuTaskBindings.getByTaskGuid, {
    feishuTaskGuid: taskGuid,
  });

  if (!binding) {
    await logIntegrationEvent(ctx, {
      action: "feishu.task.unbound_event",
      changeSummary: `Ignored unbound task event ${eventType} (${eventId})`,
      idempotencyKey: eventId,
      objectId: taskGuid,
      objectType: "feishu_task",
    });
    await ctx.runMutation(anyApi.feishuEventReceipts.upsert, {
      eventId,
      eventType,
      payload,
      reason: "binding_not_found",
      status: "ignored",
      taskGuid,
    });
    return;
  }

  try {
    await ctx.runMutation(anyApi.feishuTaskBindings.applyTaskEvent, {
      feishuTaskGuid: taskGuid,
      feishuTaskStatus: mappedTaskStatus.feishuStatus,
      idempotencyKey: eventId,
      workItemStatus: mappedTaskStatus.workItemStatus,
    });
    await ctx.runMutation(anyApi.feishuEventReceipts.upsert, {
      eventId,
      eventType,
      payload,
      status: "processed",
      taskGuid,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logIntegrationEvent(ctx, {
      action: "feishu.task.sync_failed",
      changeSummary: `Failed to apply task event ${eventType} (${eventId}): ${errorMessage}`,
      objectId: binding.workItemId,
      objectType: "work_item",
      projectId: binding.projectId,
    });
    await ctx.runMutation(anyApi.feishuEventReceipts.upsert, {
      eventId,
      eventType,
      lastError: errorMessage,
      payload,
      reason: "status_writeback_failed",
      status: "pending_retry",
      taskGuid,
    });
  }
};

// ── Feishu Event Subscription ───────────────────────────────────────────

http.route({
  handler: httpAction(async (ctx, request) => {
    const parsedRequestBody = await parseRequestBody(request);
    if (!parsedRequestBody) {
      return new Response("Invalid JSON body", { status: 400 });
    }

    const { body, rawBody } = parsedRequestBody;

    const challenge = extractChallenge(body);
    if (challenge) {
      return jsonResponse({ challenge });
    }

    const verificationError = await verifyFeishuRequest(request, rawBody, body);
    if (verificationError) {
      return new Response(verificationError, { status: 401 });
    }

    const { eventId, eventType } = extractEventHeader(body);

    if (!eventId || !eventType) {
      return new Response("Missing event_id or event_type", { status: 400 });
    }

    switch (eventType) {
      case "approval_instance": {
        await handleApprovalEvent(ctx, body, eventId);
        break;
      }
      case "task.updated":
      case "task.completed": {
        await handleTaskEvent(ctx, body, eventId, eventType);
        break;
      }
      default: {
        await logIntegrationEvent(ctx, {
          action: "feishu.event.ignored",
          changeSummary: `Unhandled Feishu event type: ${sanitizeLogInput(eventType)}`,
          idempotencyKey: eventId,
          objectId: sanitizeLogInput(eventType),
          objectType: "feishu_event",
        });
      }
    }

    return jsonResponse({ ok: true });
  }),
  method: "POST",
  path: "/feishu/events",
});

// ── Feishu Card Callback ────────────────────────────────────────────────

http.route({
  handler: httpAction(async (ctx, request) => {
    const parsedRequestBody = await parseRequestBody(request);
    if (!parsedRequestBody) {
      return new Response("Invalid JSON body", { status: 400 });
    }

    const { body, rawBody } = parsedRequestBody;

    const challenge = extractChallenge(body);
    if (challenge) {
      return jsonResponse({ challenge });
    }

    const verificationError = await verifyFeishuRequest(request, rawBody, body);
    if (verificationError) {
      return new Response(verificationError, { status: 401 });
    }

    const action = getRecord(body, "action");
    const actionTag = action ? (getString(action, "tag") ?? "") : "";
    const actionValue = action ? getRecord(action, "value") : null;

    if (!actionValue) {
      return new Response("Missing action value", { status: 400 });
    }

    switch (actionTag) {
      case "claim_work_item": {
        const workItemId = toConvexId<"workItems">(
          getString(actionValue, "workItemId")
        );
        const userId = getString(actionValue, "userId");
        if (workItemId && userId) {
          await ctx.runMutation(anyApi.workItems.updateStatus, {
            actorId: userId,
            id: workItemId,
            status: "in_progress",
          });
        }
        break;
      }
      case "view_project": {
        break;
      }
      case "approve_gate": {
        break;
      }
      default: {
        await logIntegrationEvent(ctx, {
          action: "feishu.card_callback.ignored",
          changeSummary: `Unhandled card action: ${sanitizeLogInput(actionTag)}`,
          objectId: sanitizeLogInput(actionTag || "unknown"),
          objectType: "feishu_card_action",
        });
      }
    }

    return jsonResponse({});
  }),
  method: "POST",
  path: "/feishu/card-callback",
});

// ── Link Preview Callback ───────────────────────────────────────────────

http.route({
  handler: httpAction(async (ctx, request) => {
    const parsedRequestBody = await parseRequestBody(request);
    if (!parsedRequestBody) {
      return new Response("Invalid JSON body", { status: 400 });
    }

    const { body, rawBody } = parsedRequestBody;

    const challenge = extractChallenge(body);
    if (challenge) {
      return jsonResponse({ challenge });
    }

    const verificationError = await verifyFeishuRequest(request, rawBody, body);
    if (verificationError) {
      return new Response(verificationError, { status: 401 });
    }

    const event = getRecord(body, "event");
    const url = event ? (getString(event, "url") ?? "") : "";
    const projectId = extractProjectIdFromUrl(url);
    if (!projectId) {
      return jsonResponse({});
    }

    const projectIdRef = toConvexId<"projects">(projectId);
    if (!projectIdRef) {
      return jsonResponse({});
    }

    const project = await ctx
      .runQuery(anyApi.projects.getById, { id: projectIdRef })
      .catch(() => null);

    if (!project) {
      return jsonResponse({});
    }

    const previewCard = {
      data: {
        template_id: "link_preview",
        template_variable: {
          open_url: url,
          project_name: project.name,
          project_owner: project.ownerId,
          project_status: project.status,
        },
      },
      type: "template",
    };

    return jsonResponse(previewCard);
  }),
  method: "POST",
  path: "/feishu/link-preview",
});

export default http;
