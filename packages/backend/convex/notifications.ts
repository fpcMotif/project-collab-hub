import { v } from "convex/values";

import { query, mutation, internalMutation } from "./_generated/server";

export const listPending = query({
  args: {},
  handler: (ctx) =>
    ctx.db
      .query("notificationDeliveries")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect(),
});

export const create = mutation({
  args: {
    channel: v.union(
      v.literal("group_chat"),
      v.literal("private_chat"),
      v.literal("batch_message")
    ),
    messageType: v.union(
      v.literal("mention"),
      v.literal("approval_result"),
      v.literal("task_update"),
      v.literal("stage_change"),
      v.literal("risk_alert")
    ),
    payload: v.string(),
    projectId: v.id("projects"),
    recipientId: v.string(),
  },
  handler: (ctx, args) =>
    ctx.db.insert("notificationDeliveries", {
      ...args,
      retryCount: 0,
      status: "pending",
    }),
});

export const markSent = internalMutation({
  args: {
    feishuMessageId: v.string(),
    id: v.id("notificationDeliveries"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      feishuMessageId: args.feishuMessageId,
      status: "sent",
    });
  },
});

export const markFailed = internalMutation({
  args: {
    error: v.string(),
    id: v.id("notificationDeliveries"),
  },
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.id);
    if (!delivery) {
      return;
    }

    const newRetryCount = delivery.retryCount + 1;
    await ctx.db.patch(args.id, {
      lastError: args.error,
      retryCount: newRetryCount,
      status: newRetryCount >= 3 ? "failed" : "retrying",
    });
  },
});
