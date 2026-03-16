import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { canAdvanceStage } from "@collab-hub/shared";

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

    const fromStatus = project.status;
    const requiredTracks = await ctx.db
      .query("departmentTracks")
      .withIndex("by_project", (q) => q.eq("projectId", args.id))
      .filter((q) => q.eq(q.field("isRequired"), true))
      .collect();

    const transitionDecision = canAdvanceStage(
      fromStatus,
      args.status,
      requiredTracks.map((track) => track.status),
    );

    if (!transitionDecision.allowed) {
      const reason =
        transitionDecision.reason ??
        `Transition from ${fromStatus} to ${args.status} is not permitted`;

      await ctx.db.insert("auditEvents", {
        projectId: args.id,
        actorId: args.actorId,
        action: "project.status_change_rejected",
        objectType: "project",
        objectId: args.id,
        changeSummary: `Status change rejected from ${fromStatus} to ${args.status}`,
        fromStage: fromStatus,
        toStage: args.status,
        decision: "rejected",
        decisionReason: reason,
      });

      throw new Error(`无法迁移阶段：${reason}`);
    }

    const blockingRequiredTracks = requiredTracks.filter(
      (track) => track.status === "blocked" || track.status === "waiting_approval",
    );
    if (blockingRequiredTracks.length > 0) {
      const trackNames = blockingRequiredTracks.map((track) => track.departmentName);
      const reason = `必需部门轨道存在阻塞：${trackNames.join("、")}`;

      await ctx.db.insert("auditEvents", {
        projectId: args.id,
        actorId: args.actorId,
        action: "project.status_change_rejected",
        objectType: "project",
        objectId: args.id,
        changeSummary: `Status change rejected from ${fromStatus} to ${args.status}`,
        fromStage: fromStatus,
        toStage: args.status,
        decision: "rejected",
        decisionReason: reason,
      });

      throw new Error(`无法迁移阶段：${reason}`);
    }

    const requiredGates = await ctx.db
      .query("approvalGates")
      .withIndex("by_project", (q) => q.eq("projectId", args.id))
      .filter((q) => q.eq(q.field("triggerStage"), args.status))
      .collect();

    const pendingRequiredGates = requiredGates.filter(
      (gate) => gate.status !== "approved",
    );

    if (pendingRequiredGates.length > 0) {
      const gateTitles = pendingRequiredGates.map((gate) => gate.title);
      const reason = `目标阶段存在未通过审批门禁：${gateTitles.join("、")}`;

      await ctx.db.insert("auditEvents", {
        projectId: args.id,
        actorId: args.actorId,
        action: "project.status_change_rejected",
        objectType: "project",
        objectId: args.id,
        changeSummary: `Status change rejected from ${fromStatus} to ${args.status}`,
        fromStage: fromStatus,
        toStage: args.status,
        decision: "rejected",
        decisionReason: reason,
      });

      throw new Error(`无法迁移阶段：${reason}`);
    }

    const allowReason =
      requiredGates.length > 0
        ? `目标阶段审批门禁均已通过，共 ${requiredGates.length} 项`
        : "无必需部门阻塞，且目标阶段无审批门禁";

    await ctx.db.patch(args.id, { status: args.status });

    await ctx.db.insert("auditEvents", {
      projectId: args.id,
      actorId: args.actorId,
      action: "project.status_changed",
      objectType: "project",
      objectId: args.id,
      changeSummary: `Status changed from ${fromStatus} to ${args.status}`,
      fromStage: fromStatus,
      toStage: args.status,
      decision: "allowed",
      decisionReason: allowReason,
    });
  },
});
