import { v } from "convex/values";

import { query, mutation } from "../convex/_generated/server";

export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: (ctx, args) =>
    ctx.db
      .query("auditEvents")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect(),
});

export const listByActor = query({
  args: { actorId: v.string() },
  handler: (ctx, args) =>
    ctx.db
      .query("auditEvents")
      .withIndex("by_actor", (q) => q.eq("actorId", args.actorId))
      .order("desc")
      .collect(),
});

export const logSystemEvent = mutation({
  args: {
    action: v.string(),
    changeSummary: v.string(),
    idempotencyKey: v.optional(v.string()),
    objectId: v.string(),
    objectType: v.string(),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    if (args.idempotencyKey) {
      const existing = await ctx.db
        .query("auditEvents")
        .withIndex("by_idempotency_key", (q) =>
          q.eq("idempotencyKey", args.idempotencyKey)
        )
        .first();
      if (existing) {
        return existing._id;
      }
    }

    return ctx.db.insert("auditEvents", {
      ...args,
      actorId: "system",
    });
  },
});
