import { query } from "./_generated/server";
import { v } from "convex/values";

export const getByTaskGuid = query({
  args: { taskGuid: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("feishuTaskBindings")
      .withIndex("by_feishu_task", (q) => q.eq("feishuTaskGuid", args.taskGuid))
      .first();
  },
});
