import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("departmentTracks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    departmentId: v.string(),
    departmentName: v.string(),
    isRequired: v.boolean(),
    ownerId: v.optional(v.string()),
    dueDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("departmentTracks", {
      ...args,
      status: "not_started",
    });
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("departmentTracks"),
    status: v.union(
      v.literal("not_required"),
      v.literal("not_started"),
      v.literal("in_progress"),
      v.literal("blocked"),
      v.literal("waiting_approval"),
      v.literal("done"),
    ),
    blockReason: v.optional(v.string()),
    actorId: v.string(),
  },
  handler: async (ctx, args) => {
    const track = await ctx.db.get(args.id);
    if (!track) {
      throw new Error(`DepartmentTrack ${args.id} not found`);
    }

    await ctx.db.patch(args.id, {
      status: args.status,
      blockReason: args.status === "blocked" ? args.blockReason : undefined,
    });

    await ctx.db.insert("auditEvents", {
      projectId: track.projectId,
      actorId: args.actorId,
      action: "department_track.status_changed",
      objectType: "department_track",
      objectId: args.id,
      changeSummary: `${track.departmentName} status changed from ${track.status} to ${args.status}`,
    });
  },
});
