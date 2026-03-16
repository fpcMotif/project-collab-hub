import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getByTaskGuid = query({
  args: { taskGuid: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("feishuTaskBindings")
      .withIndex("by_feishu_task", (q) => q.eq("feishuTaskGuid", args.taskGuid))
      .first();
  },
});

export const markSyncedFromFeishu = mutation({
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
