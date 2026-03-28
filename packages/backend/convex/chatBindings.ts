import { v } from "convex/values";

import { query } from "./_generated/server";

export const getByProjectId = query({
  args: { projectId: v.id("projects") },
  handler: (ctx, args) =>
    ctx.db
      .query("chatBindings")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .first(),
});
