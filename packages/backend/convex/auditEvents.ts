import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("auditEvents")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();
  },
});

export const listByActor = query({
  args: { actorId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("auditEvents")
      .withIndex("by_actor", (q) => q.eq("actorId", args.actorId))
      .order("desc")
      .collect();
  },
});

export const getByIdempotencyKey = query({
  args: { idempotencyKey: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("auditEvents")
      .withIndex("by_idempotency_key", (q) =>
        q.eq("idempotencyKey", args.idempotencyKey),
      )
      .first();
  },
});

export const acquireIdempotencyLock = mutation({
  args: {
    idempotencyKey: v.string(),
    actorId: v.string(),
    action: v.string(),
    objectType: v.string(),
    objectId: v.string(),
    changeSummary: v.string(),
    projectId: v.optional(v.id("projects")),
    sourceEntry: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("auditEvents")
      .withIndex("by_idempotency_key", (q) =>
        q.eq("idempotencyKey", args.idempotencyKey),
      )
      .first();

    if (existing) {
      return false;
    }

    await ctx.db.insert("auditEvents", args);
    return true;
  },
});

export const create = mutation({
  args: {
    projectId: v.optional(v.id("projects")),
    actorId: v.string(),
    action: v.string(),
    objectType: v.string(),
    objectId: v.string(),
    changeSummary: v.string(),
    sourceEntry: v.optional(v.string()),
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("auditEvents", args);
  },
});
