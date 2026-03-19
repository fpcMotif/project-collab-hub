import { httpRouter, anyApi } from "convex/server";
import type { GenericActionCtx } from "convex/server";

import { api } from "./_generated/api";
import type { DataModel, Id } from "./_generated/dataModel";
import { httpAction } from "./_generated/server";

type CallableCtx = GenericActionCtx<DataModel>;

const CONVEX_ID_RE = /^[a-z0-9]{32}$/;

const isValidId = (value: string): value is Id<"workItems"> =>
  CONVEX_ID_RE.test(value);

const http = httpRouter();
const FEISHU_WEBHOOK_TOKEN = process.env.FEISHU_WEBHOOK_TOKEN;

// ── Feishu task status mapping ──────────────────────────────────────────

const FEISHU_TASK_STATUS_MAP: Record<
  string,
  "done" | "in_progress" | "in_review" | "todo"
> = {
  closed: "done",
  completed: "done",
  created: "todo",
  done: "done",
  in_progress: "in_progress",
  in_review: "in_review",
  not_started: "todo",
  reviewing: "in_review",
  running: "in_progress",
  todo: "todo",
};

// ── Internal Handlers ───────────────────────────────────────────────────

const handleApprovalEvent = async (
  ctx: CallableCtx,
  body: Record<string, unknown>,
  eventId: string
) => {
  const event = body.event as Record<string, unknown> | undefined;
  if (!event) {
    return;
  }

  const instanceCode = event.instance_code as string | undefined;
  const approvalStatus = event.status as string | undefined;

  if (!instanceCode || !approvalStatus) {
    return;
  }

  // Map Feishu approval status to our status
  const statusMap: Record<string, string> = {
    APPROVED: "approved",
    CANCELED: "cancelled",
    REJECTED: "rejected",
  };
  const mappedStatus = statusMap[approvalStatus];
  if (!mappedStatus) {
    return;
  }

  // Find the approval gate by instance code
  const gate = (await ctx.runQuery(anyApi.approvalGates.getByInstanceCode, {
    instanceCode,
  })) as unknown as { _id: string };
  if (!gate) {
    return;
  }

  // Resolve the approval gate with idempotency
  await ctx.runMutation(anyApi.approvalGates.resolve, {
    id: gate._id,
    idempotencyKey: eventId,
    instanceCode,
    resolvedBy: (event.user_id as string) ?? "system",
    status: mappedStatus,
  });
};

const handleTaskEvent = async (
  ctx: CallableCtx,
  body: Record<string, unknown>,
  eventId: string
) => {
  const event = body.event as Record<string, unknown> | undefined;
  if (!event) {
    return;
  }

  const taskGuid = event.task_id as string | undefined;
  const taskStatus = (event.status as string | undefined) ?? "";

  if (!taskGuid) {
    return;
  }

  const binding = (await ctx.runQuery(api.feishuTaskBindings.getByTaskGuid, {
    feishuTaskGuid: taskGuid,
  })) as unknown as { _id: string } | null;

  if (!binding) {
    return;
  }

  const mappedStatus = FEISHU_TASK_STATUS_MAP[taskStatus.toLowerCase()];
  if (!mappedStatus) {
    return;
  }

  await ctx.runMutation(api.feishuTaskBindings.applyTaskEvent, {
    feishuTaskGuid: taskGuid,
    feishuTaskStatus: taskStatus,
    idempotencyKey: eventId,
    workItemStatus: mappedStatus,
  });
};

const getWebhookTokenFromBody = (body: Record<string, unknown>): string => {
  const header = body.header as Record<string, unknown> | undefined;
  const headerToken =
    typeof header?.token === "string" ? header.token : undefined;
  const bodyToken = typeof body.token === "string" ? body.token : undefined;
  return headerToken ?? bodyToken ?? "";
};

const isAuthorizedFeishuEvent = (body: Record<string, unknown>): boolean => {
  if (!FEISHU_WEBHOOK_TOKEN) {
    return false;
  }
  const incomingToken = getWebhookTokenFromBody(body);
  return incomingToken.length > 0 && incomingToken === FEISHU_WEBHOOK_TOKEN;
};

// ── Feishu Event Subscription Verification ──────────────────────────────
// Feishu sends a challenge request to verify the endpoint.

http.route({
  handler: httpAction(async (ctx, request) => {
    const body = (await request.json()) as Record<string, unknown>;

    if (!isAuthorizedFeishuEvent(body)) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Handle URL verification challenge
    if (body.type === "url_verification") {
      return Response.json({ challenge: body.challenge }, { status: 200 });
    }

    // Extract event header for idempotency
    const header = body.header as Record<string, string> | undefined;
    const eventId = header?.event_id;
    const eventType = header?.event_type;

    if (!eventId || !eventType) {
      return new Response("Missing event_id or event_type", { status: 400 });
    }

    // Route to appropriate handler based on event type
    switch (eventType) {
      case "approval_instance": {
        await handleApprovalEvent(ctx, body, eventId);
        break;
      }
      case "task.updated":
      case "task.completed": {
        await handleTaskEvent(ctx, body, eventId);
        break;
      }
      default:
    }

    return Response.json({ ok: true }, { status: 200 });
  }),
  method: "POST",
  path: "/feishu/events",
});

// ── Feishu Card Callback ────────────────────────────────────────────────
// Handles interactive card button clicks from Feishu message cards.

http.route({
  handler: httpAction(async (ctx, request) => {
    const body = (await request.json()) as Record<string, unknown>;

    // Handle URL verification
    if (body.type === "url_verification") {
      return Response.json({ challenge: body.challenge }, { status: 200 });
    }

    const action = body.action as Record<string, unknown> | undefined;
    const actionTag = (action?.tag as string) ?? "";
    const actionValue = action?.value as Record<string, string> | undefined;

    if (!actionValue) {
      return new Response("Missing action value", { status: 400 });
    }

    switch (actionTag) {
      case "claim_work_item": {
        const { workItemId, userId } = actionValue;
        if (workItemId && userId && isValidId(workItemId)) {
          await ctx.runMutation(api.workItems.updateStatus, {
            actorId: userId,
            id: workItemId,
            status: "in_progress",
          });
        }
        break;
      }
      case "view_project": {
        // No server-side action needed — card opens project URL
        break;
      }
      case "approve_gate": {
        // Approvals go through Feishu's native flow,
        // this is just for navigating to the approval
        break;
      }
      default:
    }

    // Return empty body to acknowledge (Feishu expects 200)
    return Response.json({}, { status: 200 });
  }),
  method: "POST",
  path: "/feishu/card-callback",
});

// ── Link Preview Callback ───────────────────────────────────────────────
// Returns preview card data when project links are pasted in Feishu.

http.route({
  handler: httpAction(async (ctx, request) => {
    const body = (await request.json()) as Record<string, unknown>;

    // Handle URL verification
    if (body.type === "url_verification") {
      return Response.json({ challenge: body.challenge }, { status: 200 });
    }

    const event = body.event as Record<string, unknown> | undefined;
    const url = (event?.url as string) ?? "";

    // Extract project ID from URL pattern: /projects/{projectId}
    const projectIdMatch = url.match(/\/projects\/([a-zA-Z0-9_]+)/);
    if (!projectIdMatch) {
      return Response.json({}, { status: 200 });
    }

    const [, projectId] = projectIdMatch;
    const project = await ctx
      .runQuery(anyApi.projects.getById, { id: projectId as never })
      .catch(() => null);

    if (!project) {
      return Response.json({}, { status: 200 });
    }

    // Return link preview card data
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

    return Response.json(previewCard, { status: 200 });
  }),
  method: "POST",
  path: "/feishu/link-preview",
});

export default http;
