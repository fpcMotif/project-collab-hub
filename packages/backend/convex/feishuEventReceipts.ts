import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getByEventId = query({
  args: { eventId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("feishuEventReceipts")
      .withIndex("by_event_id", (q) => q.eq("eventId", args.eventId))
      .first();
  },
});

export const upsert = mutation({
  args: {
    eventId: v.string(),
    eventType: v.string(),
    taskGuid: v.optional(v.string()),
    status: v.union(
      v.literal("processed"),
      v.literal("ignored"),
      v.literal("pending_retry"),
    ),
    reason: v.optional(v.string()),
    lastError: v.optional(v.string()),
    payload: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("feishuEventReceipts")
      .withIndex("by_event_id", (q) => q.eq("eventId", args.eventId))
      .first();

    if (!existing) {
      await ctx.db.insert("feishuEventReceipts", {
        ...args,
        retryCount: args.status === "pending_retry" ? 1 : 0,
        lastProcessedAt: Date.now(),
      });
      return;
    }

    const retryCount =
      args.status === "pending_retry" ? existing.retryCount + 1 : existing.retryCount;

    await ctx.db.patch(existing._id, {
      eventType: args.eventType,
      taskGuid: args.taskGuid,
      status: args.status,
      reason: args.reason,
      lastError: args.lastError,
      payload: args.payload,
      retryCount,
      lastProcessedAt: Date.now(),
    });
  },
});
