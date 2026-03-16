import { v } from "convex/values";

import { query } from "./_generated/server";

export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) =>
    ctx.db
      .query("auditEvents")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect(),
});

export const listByActor = query({
  args: { actorId: v.string() },
  handler: async (ctx, args) =>
    ctx.db
      .query("auditEvents")
      .withIndex("by_actor", (q) => q.eq("actorId", args.actorId))
      .order("desc")
      .collect(),
});
