import { query, mutation, internalMutation, internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Effect } from "effect";
import { FeishuLive, FeishuMessageService } from "@collab-hub/feishu-integration";

const MAX_RETRY_COUNT = 3;
const BASE_RETRY_DELAY_MS = 60_000;

function computeBackoffMs(retryCount: number) {
  return BASE_RETRY_DELAY_MS * 2 ** Math.max(0, retryCount - 1);
}

export const listPending = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("notificationDeliveries")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
  },
});

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    recipientId: v.string(),
    channel: v.union(
      v.literal("group_chat"),
      v.literal("private_chat"),
      v.literal("batch_message"),
    ),
    messageType: v.union(
      v.literal("mention"),
      v.literal("approval_result"),
      v.literal("task_update"),
      v.literal("stage_change"),
      v.literal("risk_alert"),
    ),
    payload: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("notificationDeliveries", {
      ...args,
      status: "pending",
      retryCount: 0,
    });
  },
});

export const markSent = internalMutation({
  args: {
    id: v.id("notificationDeliveries"),
    feishuMessageId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "sent",
      feishuMessageId: args.feishuMessageId,
      lastError: undefined,
      nextAttemptAt: undefined,
    });

  },
});

export const markFailed = internalMutation({
  args: {
    id: v.id("notificationDeliveries"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.id);
    if (!delivery) return;

    const newRetryCount = delivery.retryCount + 1;
    const shouldFail = newRetryCount >= MAX_RETRY_COUNT;

    await ctx.db.patch(args.id, {
      status: shouldFail ? "failed" : "retrying",
      retryCount: newRetryCount,
      lastError: args.error,
      nextAttemptAt: shouldFail
        ? undefined
        : Date.now() + computeBackoffMs(newRetryCount),
    });
  },
});


export const markSending = internalMutation({
  args: { id: v.id("notificationDeliveries") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "sending",
    });
  },
});

export const processPending = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const pendingDeliveries = await ctx.runQuery(internal.notifications.getRunnable, {
      now,
    });

    for (const delivery of pendingDeliveries) {
      await ctx.runMutation(internal.notifications.markSending, { id: delivery._id });
      try {
        const payload = JSON.parse(delivery.payload) as {
          projectName?: string;
          commentSummary?: string;
          commentAuthorId?: string;
          deepLink?: string;
        };

        const text = [
          `你在项目「${payload.projectName ?? "未知项目"}」中被 @ 了。`,
          `评论人：${payload.commentAuthorId ?? "未知用户"}`,
          `评论摘要：${payload.commentSummary ?? ""}`,
          `查看评论：${payload.deepLink ?? ""}`,
        ].join("\n");

        const feishuMessageId = await sendNotificationMessage({
          receiveId: delivery.recipientId,
          receiveIdType:
            delivery.channel === "group_chat" ? "chat_id" : "open_id",
          text,
        });

        await ctx.runMutation(internal.notifications.markSent, {
          id: delivery._id,
          feishuMessageId,
        });
      } catch (error) {
        await ctx.runMutation(internal.notifications.markFailed, {
          id: delivery._id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (pendingDeliveries.length > 0) {
      await ctx.scheduler.runAfter(30_000, internal.notifications.processPending, {});
    }
  },
});

export const getRunnable = internalQuery({
  args: { now: v.number() },
  handler: async (ctx, args) => {
    const pending = await ctx.db
      .query("notificationDeliveries")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    const retrying = await ctx.db
      .query("notificationDeliveries")
      .withIndex("by_status", (q) => q.eq("status", "retrying"))
      .collect();

    return [...pending, ...retrying].filter(
      (delivery) =>
        delivery.status === "pending" ||
        delivery.nextAttemptAt === undefined ||
        delivery.nextAttemptAt <= args.now,
    );
  },
});


async function sendNotificationMessage(params: {
  receiveId: string;
  receiveIdType: "chat_id" | "open_id";
  text: string;
}) {
  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error("Missing FEISHU_APP_ID or FEISHU_APP_SECRET");
  }

  return Effect.runPromise(
    FeishuMessageService.pipe(
      Effect.flatMap((service) =>
        service.sendText({
          receiveId: params.receiveId,
          receiveIdType: params.receiveIdType,
          text: params.text,
        }),
      ),
      Effect.provide(FeishuLive({ appId, appSecret })),
    ),
  );
}
