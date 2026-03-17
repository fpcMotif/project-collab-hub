import { v } from "convex/values";

import { query, mutation } from "../convex/_generated/server";

export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: (ctx, args) =>
    ctx.db
      .query("departmentTracks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect(),
});

export const create = mutation({
  args: {
    departmentId: v.string(),
    departmentName: v.string(),
    dueDate: v.optional(v.number()),
    isRequired: v.boolean(),
    ownerId: v.optional(v.string()),
    projectId: v.id("projects"),
  },
  handler: (ctx, args) =>
    ctx.db.insert("departmentTracks", {
      ...args,
      status: "not_started",
    }),
});

export const updateStatus = mutation({
  args: {
    actorId: v.string(),
    blockReason: v.optional(v.string()),
    id: v.id("departmentTracks"),
    status: v.union(
      v.literal("not_required"),
      v.literal("not_started"),
      v.literal("in_progress"),
      v.literal("blocked"),
      v.literal("waiting_approval"),
      v.literal("done")
    ),
  },
  handler: async (ctx, args) => {
    const track = await ctx.db.get(args.id);
    if (!track) {
      throw new Error(`DepartmentTrack ${args.id} not found`);
    }

    await ctx.db.patch(args.id, {
      blockReason: args.status === "blocked" ? args.blockReason : undefined,
      status: args.status,
    });

    await ctx.db.insert("auditEvents", {
      action: "department_track.status_changed",
      actorId: args.actorId,
      changeSummary: `${track.departmentName} status changed from ${track.status} to ${args.status}`,
      objectId: args.id,
      objectType: "department_track",
      projectId: track.projectId,
    });
  },
});
