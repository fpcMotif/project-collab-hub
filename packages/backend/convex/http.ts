import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

// ── Feishu Event Subscription Verification ──────────────────────────────
// Feishu sends a challenge request to verify the endpoint.

http.route({
  path: "/feishu/events",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = (await request.json()) as Record<string, unknown>;

    // Handle URL verification challenge
    if (body.type === "url_verification") {
      return new Response(
        JSON.stringify({ challenge: body.challenge }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
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
      case "approval_instance":
        await handleApprovalEvent(ctx, body, eventId);
        break;
      case "task.updated":
      case "task.completed":
        await handleTaskEvent(ctx, body, eventId);
        break;
      default:
        // Log unhandled event types for observability
        console.log(`Unhandled Feishu event type: ${eventType}`);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

// ── Feishu Card Callback ────────────────────────────────────────────────
// Handles interactive card button clicks from Feishu message cards.

http.route({
  path: "/feishu/card-callback",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = (await request.json()) as Record<string, unknown>;

    // Handle URL verification
    if (body.type === "url_verification") {
      return new Response(
        JSON.stringify({ challenge: body.challenge }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
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
        if (workItemId && userId) {
          await ctx.runMutation(api.workItems.updateStatus, {
            id: workItemId as never,
            status: "in_progress",
            actorId: userId,
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
        console.log(`Unhandled card action: ${actionTag}`);
    }

    // Return empty body to acknowledge (Feishu expects 200)
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

// ── Link Preview Callback ───────────────────────────────────────────────
// Returns preview card data when project links are pasted in Feishu.

http.route({
  path: "/feishu/link-preview",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = (await request.json()) as Record<string, unknown>;

    // Handle URL verification
    if (body.type === "url_verification") {
      return new Response(
        JSON.stringify({ challenge: body.challenge }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    const event = body.event as Record<string, unknown> | undefined;
    const url = (event?.url as string) ?? "";

    // Extract project ID from URL pattern: /projects/{projectId}
    const projectIdMatch = url.match(/\/projects\/([a-zA-Z0-9_]+)/);
    if (!projectIdMatch) {
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const projectId = projectIdMatch[1];
    const project = await ctx
      .runQuery(api.projects.getById, { id: projectId as never })
      .catch(() => null);

    if (!project) {
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Return link preview card data
    const previewCard = {
      type: "template",
      data: {
        template_id: "link_preview",
        template_variable: {
          project_name: project.name,
          project_status: project.status,
          project_owner: project.ownerId,
          open_url: url,
        },
      },
    };

    return new Response(JSON.stringify(previewCard), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

// ── Internal Handlers ───────────────────────────────────────────────────

async function handleApprovalEvent(
  ctx: { runQuery: typeof Function.prototype; runMutation: typeof Function.prototype },
  body: Record<string, unknown>,
  eventId: string,
) {
  const event = body.event as Record<string, unknown> | undefined;
  if (!event) return;

  const instanceCode = event.instance_code as string | undefined;
  const approvalStatus = event.status as string | undefined;

  if (!instanceCode || !approvalStatus) return;

  // Map Feishu approval status to our status
  const statusMap: Record<string, string> = {
    APPROVED: "approved",
    REJECTED: "rejected",
    CANCELED: "cancelled",
  };
  const mappedStatus = statusMap[approvalStatus];
  if (!mappedStatus) return;

  // Find the approval gate by instance code
  const gate = await (ctx.runQuery as Function)(
    api.approvalGates.getByInstanceCode,
    { instanceCode },
  );
  if (!gate) return;

  // Resolve the approval gate with idempotency
  await (ctx.runMutation as Function)(api.approvalGates.resolve, {
    id: gate._id,
    instanceCode,
    status: mappedStatus,
    resolvedBy: (event.user_id as string) ?? "system",
    idempotencyKey: eventId,
  });
}

type WorkItemStatus = "todo" | "in_progress" | "in_review" | "done";

function extractTaskGuid(event: Record<string, unknown>): string | undefined {
  const directTaskId = event.task_id;
  if (typeof directTaskId === "string" && directTaskId) {
    return directTaskId;
  }

  const task = event.task as Record<string, unknown> | undefined;
  const nestedTaskId = task?.task_id;
  if (typeof nestedTaskId === "string" && nestedTaskId) {
    return nestedTaskId;
  }

  return undefined;
}

function extractTaskStatus(event: Record<string, unknown>): string | undefined {
  const directStatus = event.status;
  if (typeof directStatus === "string" && directStatus) {
    return directStatus;
  }

  const task = event.task as Record<string, unknown> | undefined;
  const nestedStatus = task?.status;
  if (typeof nestedStatus === "string" && nestedStatus) {
    return nestedStatus;
  }

  return undefined;
}

function mapFeishuTaskStatusToWorkItemStatus(
  feishuStatus: string,
): WorkItemStatus | undefined {
  const normalized = feishuStatus.trim().toLowerCase();

  const statusMap: Record<string, WorkItemStatus> = {
    completed: "done",
    done: "done",
    in_progress: "in_progress",
    inprogress: "in_progress",
    executing: "in_progress",
    underway: "in_progress",
    todo: "todo",
    open: "todo",
    pending: "todo",
    not_started: "todo",
    in_review: "in_review",
    review: "in_review",
  };

  return statusMap[normalized];
}

async function handleTaskEvent(
  ctx: { runQuery: typeof Function.prototype; runMutation: typeof Function.prototype },
  body: Record<string, unknown>,
  eventId: string,
) {
  const event = body.event as Record<string, unknown> | undefined;
  if (!event) return;

  const taskGuid = extractTaskGuid(event);
  if (!taskGuid) return;

  const header = body.header as Record<string, unknown> | undefined;
  const eventType = typeof header?.event_type === "string" ? header.event_type : "";

  const incomingTaskStatus =
    extractTaskStatus(event) || (eventType === "task.completed" ? "completed" : undefined);
  if (!incomingTaskStatus) return;

  const idempotencyKey = `feishu.task_event.${eventId}`;
  const lockAcquired = await (ctx.runMutation as Function)(
    api.auditEvents.acquireIdempotencyLock,
    {
      idempotencyKey,
      actorId: "feishu_bot",
      action: "feishu.task.event.received",
      objectType: "feishu_task_event",
      objectId: eventId,
      changeSummary: `Task event accepted: task=${taskGuid}, status=${incomingTaskStatus}`,
      sourceEntry: "feishu_webhook",
    },
  );
  if (!lockAcquired) {
    return;
  }

  const binding = await (ctx.runQuery as Function)(
    api.feishuTaskBindings.getByFeishuTaskGuid,
    { feishuTaskGuid: taskGuid },
  );
  if (!binding) {
    await (ctx.runMutation as Function)(api.auditEvents.create, {
      actorId: "feishu_bot",
      action: "feishu.task.binding_missing",
      objectType: "feishu_task",
      objectId: taskGuid,
      changeSummary: `No binding found for task ${taskGuid}; status=${incomingTaskStatus}`,
      sourceEntry: "feishu_webhook",
    });
    return;
  }

  const syncedAt = Date.now();

  if (binding.feishuTaskStatus !== incomingTaskStatus) {
    await (ctx.runMutation as Function)(api.feishuTaskBindings.updateSyncState, {
      id: binding._id,
      feishuTaskStatus: incomingTaskStatus,
      lastSyncedAt: syncedAt,
    });
  }

  if (binding.syncDirection === "manual_link") {
    await (ctx.runMutation as Function)(api.auditEvents.create, {
      projectId: binding.projectId,
      actorId: "feishu_bot",
      action: "feishu.task.manual_link.audit_only",
      objectType: "feishu_task_binding",
      objectId: binding._id,
      changeSummary: `Task ${taskGuid} status=${incomingTaskStatus} recorded (audit only, no app->work item sync).`,
      sourceEntry: "feishu_webhook",
    });
    return;
  }

  const mappedStatus = mapFeishuTaskStatusToWorkItemStatus(incomingTaskStatus);
  if (!mappedStatus) {
    await (ctx.runMutation as Function)(api.auditEvents.create, {
      projectId: binding.projectId,
      actorId: "feishu_bot",
      action: "feishu.task.unmapped_status",
      objectType: "feishu_task_binding",
      objectId: binding._id,
      changeSummary: `Task ${taskGuid} status=${incomingTaskStatus} has no local mapping.`,
      sourceEntry: "feishu_webhook",
    });
    return;
  }

  const workItem = await (ctx.runQuery as Function)(api.workItems.getById, {
    id: binding.workItemId,
  });
  if (!workItem) {
    await (ctx.runMutation as Function)(api.auditEvents.create, {
      projectId: binding.projectId,
      actorId: "feishu_bot",
      action: "feishu.task.work_item_missing",
      objectType: "feishu_task_binding",
      objectId: binding._id,
      changeSummary: `Bound work item not found for task ${taskGuid}.`,
      sourceEntry: "feishu_webhook",
    });
    return;
  }

  if (workItem.status === mappedStatus) {
    return;
  }

  await (ctx.runMutation as Function)(api.workItems.updateStatus, {
    id: binding.workItemId,
    status: mappedStatus,
    actorId: "feishu_bot",
  });

  await (ctx.runMutation as Function)(api.auditEvents.create, {
    projectId: binding.projectId,
    actorId: "feishu_bot",
    action: "feishu.task.synced_to_work_item",
    objectType: "feishu_task_binding",
    objectId: binding._id,
    changeSummary: `Task ${taskGuid} status ${incomingTaskStatus} synced to work item status ${mappedStatus}.`,
    sourceEntry: "feishu_webhook",
  });
}

export default http;
