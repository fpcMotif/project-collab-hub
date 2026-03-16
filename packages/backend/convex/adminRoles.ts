import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const roleType = v.union(
  v.literal("platform_admin"),
  v.literal("workspace_admin"),
  v.literal("owner"),
  v.literal("contributor"),
  v.literal("viewer"),
);

export const listRoleBindings = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.userId) {
      return ctx.db
        .query("roleBindings")
        .withIndex("by_user", (q) => q.eq("userId", args.userId!))
        .collect();
    }

    return ctx.db.query("roleBindings").collect();
  },
});

export const upsertRoleBinding = mutation({
  args: {
    userId: v.string(),
    role: roleType,
    scopeType: v.union(v.literal("platform"), v.literal("workspace")),
    scopeId: v.optional(v.string()),
    actorId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("roleBindings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const match = existing.find(
      (binding) => binding.scopeType === args.scopeType && binding.scopeId === args.scopeId,
    );

    if (match) {
      await ctx.db.patch(match._id, { role: args.role });
      return match._id;
    }

    return ctx.db.insert("roleBindings", {
      userId: args.userId,
      role: args.role,
      scopeType: args.scopeType,
      scopeId: args.scopeId,
      createdBy: args.actorId,
      createdAt: Date.now(),
    });
  },
});
