import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET;
const FEISHU_VERIFICATION_TOKEN = process.env.FEISHU_VERIFICATION_TOKEN;
const FEISHU_MAX_SKEW_MS = 5 * 60 * 1000;

type FeishuCallbackPayload = Record<string, unknown>;

async function hmacSha256Base64(secret: string, data: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  const bytes = new Uint8Array(sig);
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function validateFeishuRequest(
  request: Request,
  rawBody: string,
  payload?: FeishuCallbackPayload,
) {
  if (!FEISHU_APP_SECRET) {
    return { ok: false as const, reason: "Missing FEISHU_APP_SECRET" };
  }

  const timestamp = request.headers.get("x-lark-request-timestamp") ?? "";
  const nonce = request.headers.get("x-lark-request-nonce") ?? "";
  const signature = request.headers.get("x-lark-signature") ?? "";

  if (!timestamp || !nonce || !signature) {
    return { ok: false as const, reason: "Missing Feishu signature headers" };
  }

  const ts = Number(timestamp) * 1000;
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > FEISHU_MAX_SKEW_MS) {
    return { ok: false as const, reason: "Feishu timestamp expired" };
  }

  const expected = await hmacSha256Base64(FEISHU_APP_SECRET, `${timestamp}${nonce}${rawBody}`);
  if (expected !== signature) {
    return { ok: false as const, reason: "Feishu signature mismatch" };
  }

  const token = payload?.header && typeof payload.header === "object"
    ? (payload.header as Record<string, unknown>).token
    : undefined;

  if (
    FEISHU_VERIFICATION_TOKEN &&
    typeof token === "string" &&
    token !== FEISHU_VERIFICATION_TOKEN
  ) {
    return { ok: false as const, reason: "Feishu verification token mismatch" };
  }

  return { ok: true as const };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function enqueueCallback(
  ctx: { runMutation: typeof Function.prototype },
  source: "events" | "card_callback" | "link_preview",
  body: FeishuCallbackPayload,
) {
  const header = body.header as Record<string, unknown> | undefined;
  const eventId = (header?.event_id as string | undefined) ?? crypto.randomUUID();
  const eventType = (header?.event_type as string | undefined) ?? `${source}.unknown`;

  await (ctx.runMutation as Function)(api.eventInbox.enqueue, {
    source,
    eventId,
    eventType,
    payload: JSON.stringify(body),
  });
}

http.route({
  path: "/feishu/events",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const rawBody = await request.text();
    const body = JSON.parse(rawBody) as FeishuCallbackPayload;

    const valid = await validateFeishuRequest(request, rawBody, body);
    if (!valid.ok) {
      return new Response(valid.reason, { status: 401 });
    }

    if (body.type === "url_verification") {
      return jsonResponse({ challenge: body.challenge });
    }

    await enqueueCallback(ctx, "events", body);
    return jsonResponse({ ok: true, accepted: true });
  }),
});

http.route({
  path: "/feishu/card-callback",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const rawBody = await request.text();
    const body = JSON.parse(rawBody) as FeishuCallbackPayload;

    const valid = await validateFeishuRequest(request, rawBody, body);
    if (!valid.ok) {
      return new Response(valid.reason, { status: 401 });
    }

    if (body.type === "url_verification") {
      return jsonResponse({ challenge: body.challenge });
    }

    await enqueueCallback(ctx, "card_callback", body);
    return jsonResponse({});
  }),
});

http.route({
  path: "/feishu/link-preview",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const rawBody = await request.text();
    const body = JSON.parse(rawBody) as FeishuCallbackPayload;

    const valid = await validateFeishuRequest(request, rawBody, body);
    if (!valid.ok) {
      return new Response(valid.reason, { status: 401 });
    }

    if (body.type === "url_verification") {
      return jsonResponse({ challenge: body.challenge });
    }

    await enqueueCallback(ctx, "link_preview", body);
    return jsonResponse({ accepted: true });
  }),
});

export default http;
