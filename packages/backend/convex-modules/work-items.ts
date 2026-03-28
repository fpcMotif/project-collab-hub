import { v } from "convex/values";

import { internal } from "../convex/_generated/api";
import { mutation, query } from "../convex/_generated/server";

export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: (ctx, args) =>
    ctx.db
      .query("workItems")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect(),
});

export const listByAssignee = query({
  args: { assigneeId: v.string() },
  handler: (ctx, args) =>
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

    // Auto-create a linked Feishu task when an assignee is specified
    if (args.assigneeId) {
      const project = await ctx.db.get(args.projectId);
      const dueTimestamp = args.dueDate
        ? String(Math.floor(args.dueDate / 1000))
        : String(Math.floor((Date.now() + 7 * 24 * 60 * 60 * 1000) / 1000));

      await ctx.scheduler.runAfter(0, internal.feishuActions.createFeishuTask, {
        description: args.description,
        dueTimestamp,
        memberIds: [args.assigneeId],
        originHref: `/projects/${args.projectId}`,
        originTitle: project?.name ?? "Project",
        projectId: args.projectId,
        summary: args.title,
        workItemId,
      });
    }

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

    // Synchronize completion status with Feishu task if it exists
    if (args.status === "done") {
      const binding = await ctx.db
        .query("feishuTaskBindings")
        .withIndex("by_work_item", (q) => q.eq("workItemId", args.id))
        .first();

      if (binding) {
        await ctx.scheduler.runAfter(
          0,
          internal.feishuActions.completeFeishuTask,
          {
            taskGuid: binding.feishuTaskGuid,
          }
        );
      }
    }
  },
});

export const update = mutation({
  args: {
    actorId: v.string(),
    description: v.optional(v.string()),
    id: v.id("workItems"),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.id);
    if (!item) {
      throw new Error(`WorkItem ${args.id} not found`);
    }

    const patch: Record<string, unknown> = {};
    if (args.description !== undefined) {
      patch.description = args.description;
    }
    if (args.title !== undefined) {
      patch.title = args.title;
    }

    if (Object.keys(patch).length === 0) {
      return;
    }

    await ctx.db.patch(args.id, patch);

    await ctx.db.insert("auditEvents", {
      action: "work_item.updated",
      actorId: args.actorId,
      changeSummary: `"${item.title}" updated`,
      objectId: args.id,
      objectType: "work_item",
      projectId: item.projectId,
    });

    // Synchronize title/description with Feishu task if it exists
    const binding = await ctx.db
      .query("feishuTaskBindings")
      .withIndex("by_work_item", (q) => q.eq("workItemId", args.id))
      .first();

    if (binding) {
      await ctx.scheduler.runAfter(0, internal.feishuActions.updateFeishuTask, {
        description: args.description,
        summary: args.title,
        taskGuid: binding.feishuTaskGuid,
      });
    }
  },
});
