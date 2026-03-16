import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getByFeishuTaskGuid = query({
  args: { taskGuid: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("feishuTaskBindings")
      .withIndex("by_feishu_task", (q) => q.eq("feishuTaskGuid", args.taskGuid))
      .first();
  },
});

export const updateSyncStatus = mutation({
  args: {
    id: v.id("feishuTaskBindings"),
    feishuTaskStatus: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      feishuTaskStatus: args.feishuTaskStatus,
      lastSyncedAt: Date.now(),
    });
  },
});

export const listAll = query({
  args: {},
  handler: async (ctx) => ctx.db.query("feishuTaskBindings").collect(),
});
