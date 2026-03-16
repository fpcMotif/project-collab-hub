import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

function sanitizeLogInput(input: unknown): string {
  if (typeof input !== "string") return "";
  // Strip control characters and truncate to 100 characters to prevent log forging
  return input.replace(/[\r\n\x00-\x1F\x7F]/g, "").substring(0, 100);
}

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
        console.log(`Unhandled Feishu event type: ${sanitizeLogInput(eventType)}`);
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
        console.log(`Unhandled card action: ${sanitizeLogInput(actionTag)}`);
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
  _eventId: string,
) {
  const event = body.event as Record<string, unknown> | undefined;
  if (!event) return;

  const taskGuid = event.task_id as string | undefined;
  if (!taskGuid) return;

  // TODO: Look up feishuTaskBindings by taskGuid, then update workItem status.
  // This requires a query on feishuTaskBindings.by_feishu_task index.
  console.log(`Task event received for task: ${sanitizeLogInput(taskGuid)}`);
}

export default http;
