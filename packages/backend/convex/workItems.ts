import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { insertAuditEvent, withAuditSource } from "./auditEvents";
import { requireProjectAccess } from "./authz";

const roleValidator = v.optional(
  v.union(
    v.literal("admin"),
    v.literal("project_manager"),
    v.literal("editor"),
    v.literal("member"),
    v.literal("viewer"),
    v.literal("guest"),
  ),
);

export const listByProject = query({
  args: {
    projectId: v.id("projects"),
    actorId: v.string(),
    actorDepartmentId: v.optional(v.string()),
    actorRole: roleValidator,
    sourceEntry: v.optional(v.string()),
    sourceIp: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireProjectAccess(
      ctx,
      {
        projectId: args.projectId,
        actorId: args.actorId,
        actorDepartmentId: args.actorDepartmentId,
        actorRole: args.actorRole,
        sourceEntry: args.sourceEntry,
        sourceIp: args.sourceIp,
      },
      "read",
      "workItem.listByProject",
    );

    return ctx.db
      .query("workItems")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

export const listByAssignee = query({
  args: { assigneeId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("workItems")
      .withIndex("by_assignee", (q) => q.eq("assigneeId", args.assigneeId))
      .collect();
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
    creatorDepartmentId: v.optional(v.string()),
    creatorRole: roleValidator,
    sourceEntry: v.optional(v.string()),
    sourceIp: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireProjectAccess(
      ctx,
      {
        projectId: args.projectId,
        actorId: args.createdBy,
        actorDepartmentId: args.creatorDepartmentId,
        actorRole: args.creatorRole,
        sourceEntry: args.sourceEntry,
        sourceIp: args.sourceIp,
      },
      "write",
      "workItem.create",
    );

    const { createdBy, creatorDepartmentId, creatorRole, sourceEntry, sourceIp, ...insertArgs } = args;
    const workItemId = await ctx.db.insert("workItems", {
      ...insertArgs,
      status: "todo",
    });

    await insertAuditEvent(ctx, {
      projectId: args.projectId,
      actorId: createdBy,
      action: "work_item.created",
      objectType: "work_item",
      objectId: workItemId,
      changeSummary: `Work item "${args.title}" created`,
      ...withAuditSource(args),
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
    actorDepartmentId: v.optional(v.string()),
    actorRole: roleValidator,
    sourceEntry: v.optional(v.string()),
    sourceIp: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.id);
    if (!item) {
      throw new Error(`WorkItem ${args.id} not found`);
    }

    await requireProjectAccess(
      ctx,
      {
        projectId: item.projectId,
        actorId: args.actorId,
        actorDepartmentId: args.actorDepartmentId,
        actorRole: args.actorRole,
        sourceEntry: args.sourceEntry,
        sourceIp: args.sourceIp,
      },
      "write",
      "workItem.updateStatus",
    );

    const patch: Record<string, unknown> = { status: args.status };
    if (args.status === "done") {
      patch.completedAt = Date.now();
    }

    await ctx.db.patch(args.id, patch);

    await insertAuditEvent(ctx, {
      projectId: item.projectId,
      actorId: args.actorId,
      action: "work_item.status_changed",
      objectType: "work_item",
      objectId: args.id,
      changeSummary: `"${item.title}" status changed from ${item.status} to ${args.status}`,
      ...withAuditSource(args),
    });
  },
});
