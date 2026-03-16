import {
  query,
  mutation,
  internalMutation,
  internalQuery,
  action,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Effect } from "effect";
import {
  FeishuLive,
  FeishuMessageService,
} from "@collab-hub/feishu-integration";

const parseMentionPayload = (
  payload: string,
): {
  projectName: string;
  commentSummary: string;
  commenterId: string;
  deepLink: string;
  commentId: string;
} | null => {
  try {
    return JSON.parse(payload) as {
      projectName: string;
      commentSummary: string;
      commenterId: string;
      deepLink: string;
      commentId: string;
    };
  } catch {
    return null;
  }
};

const buildMentionText = (payload: {
  projectName: string;
  commentSummary: string;
  commenterId: string;
  deepLink: string;
}) =>
  [
    `你在项目「${payload.projectName}」中被 @ 了。`,
    `评论人：${payload.commenterId}`,
    `评论摘要：${payload.commentSummary}`,
    `查看详情：${payload.deepLink}`,
  ].join("\n");

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

export const listSendableMentions = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const pending = await ctx.db
      .query("notificationDeliveries")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    const retrying = await ctx.db
      .query("notificationDeliveries")
      .withIndex("by_status", (q) => q.eq("status", "retrying"))
      .collect();

    const mentionDeliveries = [...pending, ...retrying]
      .filter(
        (delivery) =>
          delivery.messageType === "mention" &&
          delivery.channel === "private_chat",
      )
      .sort((a, b) => a._creationTime - b._creationTime);

    if (args.limit && args.limit > 0) {
      return mentionDeliveries.slice(0, args.limit);
    }

    return mentionDeliveries;
  },
});

export const markSending = internalMutation({
  args: {
    id: v.id("notificationDeliveries"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "sending",
      lastError: undefined,
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
    });

    const mention = await ctx.db
      .query("mentions")
      .withIndex("by_notification_delivery", (q) =>
        q.eq("notificationDeliveryId", args.id),
      )
      .first();

    if (mention) {
      await ctx.db.patch(mention._id, {
        notificationSent: true,
      });
    }
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
    await ctx.db.patch(args.id, {
      status: newRetryCount >= 3 ? "failed" : "retrying",
      retryCount: newRetryCount,
      lastError: args.error,
    });
  },
});

export const processMentionQueue = action({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const deliveries = await ctx.runQuery(internal.notifications.listSendableMentions, {
      limit: args.limit,
    });

    const deduped = new Map<string, (typeof deliveries)[number]>();
    const duplicatedDeliveryIds: Array<string> = [];

    for (const delivery of deliveries) {
      const payload = parseMentionPayload(delivery.payload);
      if (!payload?.commentId) {
        await ctx.runMutation(internal.notifications.markFailed, {
          id: delivery._id,
          error: "Invalid mention payload",
        });
        continue;
      }

      const dedupeKey = `${delivery.recipientId}:${payload.commentId}`;
      if (deduped.has(dedupeKey)) {
        duplicatedDeliveryIds.push(delivery._id);
        continue;
      }
      deduped.set(dedupeKey, delivery);
    }

    for (const duplicateId of duplicatedDeliveryIds) {
      await ctx.runMutation(internal.notifications.markSent, {
        id: duplicateId as never,
        feishuMessageId: "deduped",
      });
    }

    const appId = process.env.FEISHU_APP_ID;
    const appSecret = process.env.FEISHU_APP_SECRET;

    if (!appId || !appSecret) {
      for (const delivery of deduped.values()) {
        await ctx.runMutation(internal.notifications.markFailed, {
          id: delivery._id,
          error: "Missing FEISHU_APP_ID/FEISHU_APP_SECRET",
        });
      }
      return { processed: 0, failed: deduped.size };
    }

    const feishuLayer = FeishuLive({ appId, appSecret });

    let processed = 0;
    let failed = 0;

    for (const delivery of deduped.values()) {
      const payload = parseMentionPayload(delivery.payload);
      if (!payload) {
        await ctx.runMutation(internal.notifications.markFailed, {
          id: delivery._id,
          error: "Invalid mention payload",
        });
        failed += 1;
        continue;
      }

      await ctx.runMutation(internal.notifications.markSending, {
        id: delivery._id,
      });

      const sendEffect = Effect.gen(function* () {
        const service = yield* FeishuMessageService;
        yield* service.sendText({
          chatId: delivery.recipientId,
          text: buildMentionText(payload),
        });
      }).pipe(Effect.provide(feishuLayer));

      try {
        await Effect.runPromise(sendEffect);
        await ctx.runMutation(internal.notifications.markSent, {
          id: delivery._id,
          feishuMessageId: `mention:${String(delivery._id)}`,
        });
        processed += 1;
      } catch (error) {
        await ctx.runMutation(internal.notifications.markFailed, {
          id: delivery._id,
          error: error instanceof Error ? error.message : String(error),
        });
        failed += 1;
      }
    }

    return { processed, failed };
  },
});
