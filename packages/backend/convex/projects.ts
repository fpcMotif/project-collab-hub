import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("new"),
        v.literal("assessment"),
        v.literal("solution"),
        v.literal("ready"),
        v.literal("executing"),
        v.literal("delivering"),
        v.literal("done"),
        v.literal("cancelled"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    if (args.status) {
      return ctx.db
        .query("projects")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .collect();
    }
    return ctx.db.query("projects").collect();
  },
});

export const getById = query({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.id);
  },
});

export const getDetailOverview = query({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.id);
    if (!project) {
      return null;
    }

    const [departmentTracks, approvalGates, workItems, comments] = await Promise.all([
      ctx.db
        .query("departmentTracks")
        .withIndex("by_project", (q) => q.eq("projectId", args.id))
        .collect(),
      ctx.db
        .query("approvalGates")
        .withIndex("by_project", (q) => q.eq("projectId", args.id))
        .collect(),
      ctx.db
        .query("workItems")
        .withIndex("by_project", (q) => q.eq("projectId", args.id))
        .collect(),
      ctx.db
        .query("comments")
        .withIndex("by_project", (q) => q.eq("projectId", args.id))
        .collect(),
    ]);

    return {
      project,
      departmentTracks,
      approvalGates,
      workItems,
      comments,
    };
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    ownerId: v.string(),
    departmentId: v.string(),
    customerName: v.optional(v.string()),
    templateId: v.optional(v.string()),
    templateVersion: v.optional(v.number()),
    priority: v.optional(
      v.union(
        v.literal("low"),
        v.literal("medium"),
        v.literal("high"),
        v.literal("urgent"),
      ),
    ),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    slaDeadline: v.optional(v.number()),
    createdBy: v.string(),
    sourceEntry: v.union(
      v.literal("workbench"),
      v.literal("message_shortcut"),
      v.literal("api"),
    ),
  },
  handler: async (ctx, args) => {
    const projectId = await ctx.db.insert("projects", {
      ...args,
      status: "new",
    });

    await ctx.db.insert("auditEvents", {
      projectId,
      actorId: args.createdBy,
      action: "project.created",
      objectType: "project",
      objectId: projectId,
      changeSummary: `Project "${args.name}" created via ${args.sourceEntry}`,
      sourceEntry: args.sourceEntry,
    });

    return projectId;
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("projects"),
    status: v.union(
      v.literal("new"),
      v.literal("assessment"),
      v.literal("solution"),
      v.literal("ready"),
      v.literal("executing"),
      v.literal("delivering"),
      v.literal("done"),
      v.literal("cancelled"),
    ),
    actorId: v.string(),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.id);
    if (!project) {
      throw new Error(`Project ${args.id} not found`);
    }

    const pendingGate = await ctx.db
      .query("approvalGates")
      .withIndex("by_project", (q) => q.eq("projectId", args.id))
      .filter((q) =>
        q.and(
          q.eq(q.field("triggerStage"), args.status),
          q.eq(q.field("status"), "pending"),
        ),
      )
      .first();

    if (pendingGate) {
      throw new Error(
        `GATE_BLOCKED:阶段 ${args.status} 需要先完成审批「${pendingGate.title}」后才能迁移。`,
      );
    }

    const fromStatus = project.status;
    await ctx.db.patch(args.id, { status: args.status });

    await ctx.db.insert("auditEvents", {
      projectId: args.id,
      actorId: args.actorId,
      action: "project.status_changed",
      objectType: "project",
      objectId: args.id,
      changeSummary: `Status changed from ${fromStatus} to ${args.status}`,
    });
  },
});
