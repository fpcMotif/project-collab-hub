import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getByFeishuTaskGuid = query({
  args: { feishuTaskGuid: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("feishuTaskBindings")
      .withIndex("by_feishu_task", (q) =>
        q.eq("feishuTaskGuid", args.feishuTaskGuid),
      )
      .first();
  },
});

export const updateSyncState = mutation({
  args: {
    id: v.id("feishuTaskBindings"),
    feishuTaskStatus: v.string(),
    lastSyncedAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      feishuTaskStatus: args.feishuTaskStatus,
      lastSyncedAt: args.lastSyncedAt,
    });
  },
});
