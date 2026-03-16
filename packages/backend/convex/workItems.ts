import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertProjectPermission } from "./authz";

export const listByProject = query({
  args: { projectId: v.id("projects"), actorId: v.string() },
  handler: async (ctx, args) => {
    await assertProjectPermission(ctx, {
      userId: args.actorId,
      projectId: args.projectId,
      action: "work_item:read",
      objectType: "work_item",
      objectId: `project:${args.projectId}`,
    });

    return ctx.db
      .query("workItems")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

export const listByAssignee = query({
  args: { assigneeId: v.string(), actorId: v.string() },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("workItems")
      .withIndex("by_assignee", (q) => q.eq("assigneeId", args.assigneeId))
      .collect();

    const visibleItems: typeof items = [];
    for (const item of items) {
      try {
        await assertProjectPermission(ctx, {
          userId: args.actorId,
          projectId: item.projectId,
          action: "work_item:read",
          objectType: "work_item",
          objectId: item._id,
        });
        visibleItems.push(item);
      } catch {
        // permission denials are audited in helper; skip hidden item
      }
    }

    return visibleItems;
  },
});

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    departmentTrackId: v.optional(v.id("departmentTracks")),
    title: v.string(),
    description: v.string(),
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("urgent"),
    ),
    assigneeId: v.optional(v.string()),
    collaboratorIds: v.optional(v.array(v.string())),
    dueDate: v.optional(v.number()),
    createdBy: v.string(),
  },
  handler: async (ctx, args) => {
    await assertProjectPermission(ctx, {
      userId: args.createdBy,
      projectId: args.projectId,
      action: "work_item:write",
      objectType: "work_item",
      objectId: `project:${args.projectId}`,
    });

    const { createdBy, ...insertArgs } = args;
    const workItemId = await ctx.db.insert("workItems", {
      ...insertArgs,
      status: "todo",
    });

    await ctx.db.insert("auditEvents", {
      projectId: args.projectId,
      actorId: createdBy,
      action: "work_item.created",
      objectType: "work_item",
      objectId: workItemId,
      changeSummary: `Work item "${args.title}" created`,
    });

    return workItemId;
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("workItems"),
    status: v.union(
      v.literal("todo"),
      v.literal("in_progress"),
      v.literal("in_review"),
      v.literal("done"),
    ),
    actorId: v.string(),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.id);
    if (!item) {
      throw new Error(`WorkItem ${args.id} not found`);
    }

    await assertProjectPermission(ctx, {
      userId: args.actorId,
      projectId: item.projectId,
      action: "work_item:write",
      objectType: "work_item",
      objectId: args.id,
    });

    const patch: Record<string, unknown> = { status: args.status };
    if (args.status === "done") {
      patch.completedAt = Date.now();
    }

    await ctx.db.patch(args.id, patch);

    await ctx.db.insert("auditEvents", {
      projectId: item.projectId,
      actorId: args.actorId,
      action: "work_item.status_changed",
      objectType: "work_item",
      objectId: args.id,
      changeSummary: `"${item.title}" status changed from ${item.status} to ${args.status}`,
    });
  },
});
