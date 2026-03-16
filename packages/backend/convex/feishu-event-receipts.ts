import { v } from "convex/values";

import { mutation, query } from "./_generated/server";

export const getByEventId = query({
  args: { eventId: v.string() },
  handler: (ctx, args) =>
    ctx.db
      .query("feishuEventReceipts")
      .withIndex("by_event_id", (q) => q.eq("eventId", args.eventId))
      .first(),
});

export const upsert = mutation({
  args: {
    eventId: v.string(),
    eventType: v.string(),
    lastError: v.optional(v.string()),
    payload: v.string(),
    reason: v.optional(v.string()),
    status: v.union(
      v.literal("processed"),
      v.literal("ignored"),
      v.literal("pending_retry")
    ),
    taskGuid: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("feishuEventReceipts")
      .withIndex("by_event_id", (q) => q.eq("eventId", args.eventId))
      .first();

    if (!existing) {
      await ctx.db.insert("feishuEventReceipts", {
        ...args,
        lastProcessedAt: Date.now(),
        retryCount: args.status === "pending_retry" ? 1 : 0,
      });
      return;
    }

    await ctx.db.patch(existing._id, {
      eventType: args.eventType,
      lastError: args.lastError,
      lastProcessedAt: Date.now(),
      payload: args.payload,
      reason: args.reason,
      retryCount:
        args.status === "pending_retry"
          ? existing.retryCount + 1
          : existing.retryCount,
      status: args.status,
      taskGuid: args.taskGuid,
    });
  },
});
