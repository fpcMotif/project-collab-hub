import { httpRouter } from "convex/server";

import { api } from "./_generated/api"; /* eslint-disable-line import/first */
import { httpAction } from "./_generated/server";

const http = httpRouter();

// ── Feishu Event Subscription Verification ──────────────────────────────
// Feishu sends a challenge request to verify the endpoint.

http.route({
  handler: httpAction(async (ctx, request) => {
    const body = (await request.json()) as Record<string, unknown>;

    // Handle URL verification challenge
    if (body.type === "url_verification") {
      return new Response(JSON.stringify({ challenge: body.challenge }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
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
      default: {
        // Log unhandled event types for observability
        console.log(`Unhandled Feishu event type: ${eventType}`);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
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
      return new Response(JSON.stringify({ challenge: body.challenge }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
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
            actorId: userId,
            id: workItemId as never,
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
      default: {
        console.log(`Unhandled card action: ${actionTag}`);
      }
    }

    // Return empty body to acknowledge (Feishu expects 200)
    return new Response(JSON.stringify({}), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
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
      return new Response(JSON.stringify({ challenge: body.challenge }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    const event = body.event as Record<string, unknown> | undefined;
    const url = (event?.url as string) ?? "";

    // Extract project ID from URL pattern: /projects/{projectId}
    const projectIdMatch = url.match(/\/projects\/([a-zA-Z0-9_]+)/);
    if (!projectIdMatch) {
      return new Response(JSON.stringify({}), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    const projectId = projectIdMatch[1];
    const project = await ctx
      .runQuery(api.projects.getById, { id: projectId as never })
      .catch(() => null);

    if (!project) {
      return new Response(JSON.stringify({}), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
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

    return new Response(JSON.stringify(previewCard), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  }),
  method: "POST",
  path: "/feishu/link-preview",
});

// ── Internal Handlers ───────────────────────────────────────────────────

async function handleApprovalEvent(
  ctx: {
    runQuery: typeof Function.prototype;
    runMutation: typeof Function.prototype;
  },
  body: Record<string, unknown>,
  eventId: string
) {
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
  const gate = await (ctx.runQuery as Function)(
    api.approvalGates.getByInstanceCode,
    { instanceCode }
  );
  if (!gate) {
    return;
  }

  // Resolve the approval gate with idempotency
  await (ctx.runMutation as Function)(api.approvalGates.resolve, {
    id: gate._id,
    idempotencyKey: eventId,
    instanceCode,
    resolvedBy: (event.user_id as string) ?? "system",
    status: mappedStatus,
  });
}

async function handleTaskEvent(
  ctx: {
    runQuery: typeof Function.prototype;
    runMutation: typeof Function.prototype;
  },
  body: Record<string, unknown>,
  _eventId: string
) {
  const event = body.event as Record<string, unknown> | undefined;
  if (!event) {
    return;
  }

  const taskGuid = event.task_id as string | undefined;
  if (!taskGuid) {
    return;
  }

  // TODO: Look up feishuTaskBindings by taskGuid, then update workItem status.
  // This requires a query on feishuTaskBindings.by_feishu_task index.
  console.log(`Task event received for task: ${taskGuid}`);
}

export default http;
