import { internal } from "./_generated/api";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { v } from "convex/values";

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
    commentId: v.optional(v.id("comments")),
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

export const claimForSending = internalMutation({
  args: {
    id: v.id("notificationDeliveries"),
  },
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.id);
    if (!delivery) {
      return null;
    }
    if (delivery.status !== "pending" && delivery.status !== "retrying") {
      return null;
    }

    await ctx.db.patch(args.id, {
      status: "sending",
    });

    return delivery;
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
    await ctx.db.patch(args.id, {
      status: newRetryCount >= 3 ? "failed" : "retrying",
      retryCount: newRetryCount,
      lastError: args.error,
    });
  },
});

export const executePending = action({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const pending = await ctx.runQuery(internal.notifications.listDeliveriesForExecution, {
      limit: args.limit ?? 20,
    });

    let sent = 0;
    let failed = 0;

    for (const delivery of pending) {
      const claimed = await ctx.runMutation(internal.notifications.claimForSending, {
        id: delivery._id,
      });
      if (!claimed) {
        continue;
      }

      try {
        // TODO: Replace with real Feishu API send call.
        const feishuMessageId = `mock_${claimed._id}_${Date.now()}`;

        await ctx.runMutation(internal.notifications.markSent, {
          id: claimed._id,
          feishuMessageId,
        });
        sent += 1;
      } catch (error) {
        await ctx.runMutation(internal.notifications.markFailed, {
          id: claimed._id,
          error: error instanceof Error ? error.message : "Unknown send error",
        });
        failed += 1;
      }
    }

    return {
      attempted: pending.length,
      sent,
      failed,
    };
  },
});

export const listDeliveriesForExecution = internalQuery({
  args: {
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const pending = await ctx.db
      .query("notificationDeliveries")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .take(args.limit);

    const remaining = args.limit - pending.length;
    if (remaining <= 0) {
      return pending;
    }

    const retrying = await ctx.db
      .query("notificationDeliveries")
      .withIndex("by_status", (q) => q.eq("status", "retrying"))
      .take(remaining);

    return [...pending, ...retrying];
  },
});
