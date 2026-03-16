import { v } from "convex/values";

import { query, mutation } from "./_generated/server";

export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) =>
    ctx.db
      .query("workItems")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect(),
});

export const listByAssignee = query({
  args: { assigneeId: v.string() },
  handler: async (ctx, args) =>
    ctx.db
      .query("workItems")
      .withIndex("by_assignee", (q) => q.eq("assigneeId", args.assigneeId))
      .collect(),
});

export const create = mutation({
  args: {
    assigneeId: v.optional(v.string()),
    collaboratorIds: v.optional(v.array(v.string())),
    createdBy: v.string(),
    departmentTrackId: v.optional(v.id("departmentTracks")),
    description: v.string(),
    dueDate: v.optional(v.number()),
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("urgent")
    ),
    projectId: v.id("projects"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const { createdBy, ...insertArgs } = args;
    const workItemId = await ctx.db.insert("workItems", {
      ...insertArgs,
      status: "todo",
    });

    await ctx.db.insert("auditEvents", {
      action: "work_item.created",
      actorId: createdBy,
      changeSummary: `Work item "${args.title}" created`,
      objectId: workItemId,
      objectType: "work_item",
      projectId: args.projectId,
    });

    return workItemId;
  },
});

export const updateStatus = mutation({
  args: {
    actorId: v.string(),
    id: v.id("workItems"),
    status: v.union(
      v.literal("todo"),
      v.literal("in_progress"),
      v.literal("in_review"),
      v.literal("done")
    ),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.id);
    if (!item) {
      throw new Error(`WorkItem ${args.id} not found`);
    }

    const patch: Record<string, unknown> = { status: args.status };
    if (args.status === "done") {
      patch.completedAt = Date.now();
    }

    await ctx.db.patch(args.id, patch);

    await ctx.db.insert("auditEvents", {
      action: "work_item.status_changed",
      actorId: args.actorId,
      changeSummary: `"${item.title}" status changed from ${item.status} to ${args.status}`,
      objectId: args.id,
      objectType: "work_item",
      projectId: item.projectId,
    });
  },
});
