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
        await handleTaskEvent(ctx, body, eventId, eventType);
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

async function handleTaskEvent(
  ctx: { runQuery: typeof Function.prototype; runMutation: typeof Function.prototype },
  body: Record<string, unknown>,
  eventId: string,
  eventType: string,
) {
  const payload = JSON.stringify(body);
  const existingReceipt = await (ctx.runQuery as Function)(
    api.feishuEventReceipts.getByEventId,
    { eventId },
  );
  if (existingReceipt && existingReceipt.status !== "pending_retry") {
    console.log(`Duplicate Feishu task event ignored: ${eventId}`);
    return;
  }

  const event = body.event as Record<string, unknown> | undefined;
  if (!event) {
    await (ctx.runMutation as Function)(api.feishuEventReceipts.upsert, {
      eventId,
      eventType,
      status: "ignored",
      reason: "missing_event_payload",
      payload,
    });
    return;
  }

  const taskGuid = event.task_id as string | undefined;
  if (!taskGuid) {
    await (ctx.runMutation as Function)(api.feishuEventReceipts.upsert, {
      eventId,
      eventType,
      status: "ignored",
      reason: "missing_task_guid",
      payload,
    });
    return;
  }

  const rawStatus =
    (event.status as string | undefined) ??
    (event.task_status as string | undefined) ??
    ((event.completed as boolean | undefined) === true ? "completed" : undefined) ??
    (eventType === "task.completed" ? "completed" : undefined);
  const feishuStatus = rawStatus?.toLowerCase();

  const statusMap: Record<string, "todo" | "in_progress" | "in_review" | "done"> = {
    created: "todo",
    todo: "todo",
    started: "in_progress",
    in_progress: "in_progress",
    processing: "in_progress",
    pending_review: "in_review",
    reviewing: "in_review",
    completed: "done",
    done: "done",
  };
  const mappedStatus = feishuStatus ? statusMap[feishuStatus] : undefined;
  if (!mappedStatus) {
    await (ctx.runMutation as Function)(api.feishuEventReceipts.upsert, {
      eventId,
      eventType,
      taskGuid,
      status: "ignored",
      reason: `unsupported_task_status:${feishuStatus ?? "unknown"}`,
      payload,
    });
    return;
  }

  const binding = await (ctx.runQuery as Function)(
    api.feishuTaskBindings.getByTaskGuid,
    { taskGuid },
  );

  if (!binding) {
    console.log(`Feishu task event ignored for unbound task: ${taskGuid}`);
    await (ctx.runMutation as Function)(api.auditEvents.logIntegrationEvent, {
      actorId: "feishu_bot",
      action: "feishu.task.unbound_event",
      objectType: "feishu_task",
      objectId: taskGuid,
      changeSummary: `Ignored unbound task event ${eventType} (${eventId})`,
      sourceEntry: "feishu_webhook",
      idempotencyKey: eventId,
    });
    await (ctx.runMutation as Function)(api.feishuEventReceipts.upsert, {
      eventId,
      eventType,
      taskGuid,
      status: "ignored",
      reason: "binding_not_found",
      payload,
    });
    return;
  }

  try {
    await (ctx.runMutation as Function)(api.workItems.updateStatus, {
      id: binding.workItemId,
      status: mappedStatus,
      actorId: (event.user_id as string) ?? "feishu_bot",
    });

    await (ctx.runMutation as Function)(api.feishuTaskBindings.markSyncedFromFeishu, {
      id: binding._id,
      feishuTaskStatus: feishuStatus ?? eventType,
    });

    await (ctx.runMutation as Function)(api.feishuEventReceipts.upsert, {
      eventId,
      eventType,
      taskGuid,
      status: "processed",
      payload,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await (ctx.runMutation as Function)(api.auditEvents.logIntegrationEvent, {
      projectId: binding.projectId,
      actorId: "feishu_bot",
      action: "feishu.task.sync_failed",
      objectType: "work_item",
      objectId: binding.workItemId,
      changeSummary: `Failed to apply task event ${eventType} (${eventId}): ${errorMessage}`,
      sourceEntry: "feishu_webhook",
    });
    await (ctx.runMutation as Function)(api.feishuEventReceipts.upsert, {
      eventId,
      eventType,
      taskGuid,
      status: "pending_retry",
      reason: "status_writeback_failed",
      lastError: errorMessage,
      payload,
    });
  }
}

export default http;
