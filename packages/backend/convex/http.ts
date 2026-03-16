import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

http.route({
  path: "/feishu/events",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = (await request.json()) as Record<string, unknown>;

    if (body.type === "url_verification") {
      return new Response(JSON.stringify({ challenge: body.challenge }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const header = body.header as Record<string, string> | undefined;
    const eventId = header?.event_id;
    const eventType = header?.event_type;

    if (!eventId || !eventType) {
      return new Response("Missing event_id or event_type", { status: 400 });
    }

    const ingestResult = await ctx.runMutation(api.feishuEvents.ingestEvent, {
      event_id: eventId,
      event_type: eventType,
      payload: JSON.stringify(body),
    });

    if (ingestResult.accepted) {
      await ctx.scheduler.runAfter(0, api.feishuEvents.dispatchEvent, {
        eventDocId: ingestResult.eventDocId,
      });
    }

    return new Response(
      JSON.stringify({ ok: true, deduplicated: !ingestResult.accepted }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }),
});

http.route({
  path: "/feishu/card-callback",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = (await request.json()) as Record<string, unknown>;

    if (body.type === "url_verification") {
      return new Response(JSON.stringify({ challenge: body.challenge }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
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
            id: workItemId as never,
            status: "in_progress",
            actorId: userId,
          });
        }
        break;
      }
      case "view_project":
      case "approve_gate":
        break;
      default:
        console.log(`Unhandled card action: ${actionTag}`);
    }

    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

http.route({
  path: "/feishu/link-preview",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = (await request.json()) as Record<string, unknown>;

    if (body.type === "url_verification") {
      return new Response(JSON.stringify({ challenge: body.challenge }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const event = body.event as Record<string, unknown> | undefined;
    const url = (event?.url as string) ?? "";
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

export default http;
