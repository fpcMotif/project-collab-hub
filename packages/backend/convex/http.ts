import { httpRouter, anyApi } from "convex/server";
import type { GenericActionCtx } from "convex/server";

import { api, internal } from "./_generated/api";
import type { DataModel, Id } from "./_generated/dataModel";
import { httpAction } from "./_generated/server";
import {
  extractBaseRecordIdFromEvent,
  isValidConvexWorkItemId,
} from "./lib/feishu-http-utils";
import {
  mapFeishuApprovalStatus,
  mapFeishuTaskToWorkItemStatus,
  mapFeishuWorkflowStatus,
} from "./lib/feishu-maps";
import {
  readFeishuSignatureHeaders,
  verifyFeishuRequestSignature,
} from "./lib/feishu-signature";

type CallableCtx = GenericActionCtx<DataModel>;

const isValidId = (value: string): value is Id<"workItems"> =>
  isValidConvexWorkItemId(value);

const isValidProjectId = (value: string): value is Id<"projects"> =>
  /^[a-z0-9]{32}$/.test(value);

const http = httpRouter();

const verifySignature = (
  request: Request,
  bodyText: string
): Promise<boolean> =>
  verifyFeishuRequestSignature(
    readFeishuSignatureHeaders(request),
    bodyText,
    process.env.FEISHU_ENCRYPT_KEY
  );

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

  const mappedStatus = mapFeishuApprovalStatus(approvalStatus);
  if (!mappedStatus) {
    return;
  }

  const gate = (await ctx.runQuery(anyApi.approvalGates.getByInstanceCode, {
    instanceCode,
  })) as unknown as {
    _id: Id<"approvalGates">;
    projectId: Id<"projects">;
    title: string;
  } | null;
  if (!gate) {
    return;
  }

  const resolvedBy = (event.user_id as string) ?? "system";

  await ctx.runMutation(anyApi.approvalGates.resolve, {
    id: gate._id,
    idempotencyKey: eventId,
    instanceCode,
    resolvedBy,
    status: mappedStatus,
  });

  const [project, chatBinding] = await Promise.all([
    ctx.runQuery(anyApi.projects.getById, { id: gate.projectId }),
    ctx.runQuery(anyApi.chatBindings.getByProjectId, {
      projectId: gate.projectId,
    }),
  ]);

  if (!project || !chatBinding) {
    return;
  }

  await ctx.runMutation(internal.notificationActions.enqueue, {
    channel: "group_chat" as const,
    messageType: "approval_result" as const,
    payload: JSON.stringify({
      approvalTitle: gate.title,
      projectName: project.name,
      resolvedBy,
      status: mappedStatus,
    }),
    projectId: gate.projectId,
    recipientId: chatBinding.feishuChatId,
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

  const mappedStatus = mapFeishuTaskToWorkItemStatus(taskStatus);
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

const handleBaseRecordChange = async (
  ctx: CallableCtx,
  body: Record<string, unknown>
) => {
  const event = body.event as Record<string, unknown> | undefined;
  if (!event) {
    return;
  }

  const recordId = extractBaseRecordIdFromEvent(event);

  if (!recordId) {
    return;
  }

  const binding = (await ctx.runQuery(anyApi.baseBindings.getByRecordId, {
    recordId,
  })) as unknown as { _id: string } | null;

  if (!binding) {
    return;
  }

  await ctx.scheduler.runAfter(0, internal.baseSyncActions.pullFromBase, {
    bindingId: binding._id as Id<"baseBindings">,
  });
};

// ── Feishu Event Subscription ────────────────────────────────────────────

http.route({
  handler: httpAction(async (ctx, request) => {
    const bodyText = await request.text();
    const body = JSON.parse(bodyText) as Record<string, unknown>;

    if (body.type === "url_verification") {
      return Response.json({ challenge: body.challenge }, { status: 200 });
    }

    // Verify event signature
    const signatureValid = await verifySignature(request, bodyText);
    if (!signatureValid) {
      return new Response("Invalid signature", { status: 403 });
    }

    const header = body.header as Record<string, string> | undefined;
    const eventId = header?.event_id;
    const eventType = header?.event_type;

    if (!eventId || !eventType) {
      return new Response("Missing event_id or event_type", { status: 400 });
    }

    // Wrap in try-catch: always return 200 to Feishu to prevent retry storms
    try {
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
        case "drive.file.bitable_record_changed_v1": {
          await handleBaseRecordChange(ctx, body);
          break;
        }
        default:
      }
    } catch (error) {
      console.error(
        `[feishu/events] Error handling ${eventType} (${eventId}):`,
        error instanceof Error ? error.message : error
      );
    }

    return Response.json({ ok: true }, { status: 200 });
  }),
  method: "POST",
  path: "/feishu/events",
});

// ── Feishu Card Callback ────────────────────────────────────────────────

http.route({
  handler: httpAction(async (ctx, request) => {
    const bodyText = await request.text();
    const body = JSON.parse(bodyText) as Record<string, unknown>;

    if (body.type === "url_verification") {
      return Response.json({ challenge: body.challenge }, { status: 200 });
    }

    const signatureValid = await verifySignature(request, bodyText);
    if (!signatureValid) {
      return new Response("Invalid signature", { status: 403 });
    }

    try {
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
          break;
        }
        case "approval_gate_action": {
          const { action: decision, gateId, userId: approverId } = actionValue;
          if (
            gateId &&
            approverId &&
            decision &&
            isValidConvexWorkItemId(gateId)
          ) {
            const status = decision === "approve" ? "approved" : "rejected";

            await ctx.runMutation(anyApi.approvalGates.resolve, {
              id: gateId as Id<"approvalGates">,
              resolvedBy: approverId,
              status,
            });
          }
          break;
        }
        default:
      }
    } catch (error) {
      console.error(
        "[feishu/card-callback] Error:",
        error instanceof Error ? error.message : error
      );
    }

    return Response.json({}, { status: 200 });
  }),
  method: "POST",
  path: "/feishu/card-callback",
});

// ── Link Preview Callback ───────────────────────────────────────────────

http.route({
  handler: httpAction(async (ctx, request) => {
    const bodyText = await request.text();
    const body = JSON.parse(bodyText) as Record<string, unknown>;

    if (body.type === "url_verification") {
      return Response.json({ challenge: body.challenge }, { status: 200 });
    }

    const signatureValid = await verifySignature(request, bodyText);
    if (!signatureValid) {
      return new Response("Invalid signature", { status: 403 });
    }

    try {
      const event = body.event as Record<string, unknown> | undefined;
      const url = (event?.url as string) ?? "";

      const projectIdMatch = url.match(/\/projects\/([a-zA-Z0-9_]+)/);
      if (!projectIdMatch) {
        return Response.json({}, { status: 200 });
      }

      const [, projectId] = projectIdMatch;
      if (!isValidProjectId(projectId)) {
        return Response.json({}, { status: 200 });
      }

      const project = await ctx
        .runQuery(anyApi.projects.getById, { id: projectId })
        .catch(() => null);

      if (!project) {
        return Response.json({}, { status: 200 });
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

      return Response.json(previewCard, { status: 200 });
    } catch (error) {
      console.error(
        "[feishu/link-preview] Error:",
        error instanceof Error ? error.message : error
      );
      return Response.json({}, { status: 200 });
    }
  }),
  method: "POST",
  path: "/feishu/link-preview",
});

// ── Feishu Workflow Callback ─────────────────────────────────────────────

http.route({
  handler: httpAction(async (ctx, request) => {
    const bodyText = await request.text();
    const body = JSON.parse(bodyText) as Record<string, unknown>;

    if (body.type === "url_verification") {
      return Response.json({ challenge: body.challenge }, { status: 200 });
    }

    const signatureValid = await verifySignature(request, bodyText);
    if (!signatureValid) {
      return new Response("Invalid signature", { status: 403 });
    }

    try {
      const header = body.header as Record<string, string> | undefined;
      const eventId = header?.event_id;
      const eventType = header?.event_type;

      if (!eventId || !eventType) {
        return new Response("Missing event_id or event_type", { status: 400 });
      }

      const event = body.event as Record<string, unknown> | undefined;
      if (!event) {
        return Response.json({ ok: true }, { status: 200 });
      }

      const instanceCode = event.instance_code as string | undefined;
      const status = event.status as string | undefined;

      if (!instanceCode) {
        return Response.json({ ok: true }, { status: 200 });
      }

      const mappedStatus = mapFeishuWorkflowStatus(status);

      const instance = (await ctx.runQuery(
        anyApi.workflowInstances.getByInstanceCode,
        { instanceCode }
      )) as unknown as { _id: string } | null;

      if (instance) {
        await ctx.runMutation(anyApi.workflowInstances.updateStatus, {
          id: instance._id,
          nodeCallbackData: JSON.stringify(event),
          resolvedBy: (event.user_id as string) ?? undefined,
          status: mappedStatus,
        });
      }
    } catch (error) {
      console.error(
        "[feishu/workflow-callback] Error:",
        error instanceof Error ? error.message : error
      );
    }

    return Response.json({ ok: true }, { status: 200 });
  }),
  method: "POST",
  path: "/feishu/workflow-callback",
});

export default http;
