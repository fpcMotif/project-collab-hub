import { v } from "convex/values";

import { query } from "../convex/_generated/server";

export const getByTaskGuid = query({
  args: { feishuTaskGuid: v.string() },
  handler: (ctx, args) =>
    ctx.db
      .query("feishuTaskBindings")
      .withIndex("by_feishu_task", (q) =>
        q.eq("feishuTaskGuid", args.feishuTaskGuid)
      )
      .first(),
});
