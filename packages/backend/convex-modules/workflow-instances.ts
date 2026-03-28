import { v } from "convex/values";

import { mutation, query } from "../convex/_generated/server";

const workflowStatus = v.union(
  v.literal("pending"),
  v.literal("running"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("cancelled"),
  v.literal("error")
);

export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: (ctx, args) =>
    ctx.db
      .query("workflowInstances")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect(),
});

export const getByInstanceCode = query({
  args: { instanceCode: v.string() },
  handler: (ctx, args) =>
    ctx.db
      .query("workflowInstances")
      .withIndex("by_instance_code", (q) =>
        q.eq("feishuInstanceCode", args.instanceCode)
      )
      .first(),
});

export const listPending = query({
  args: {},
  handler: (ctx) =>
    ctx.db
      .query("workflowInstances")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect(),
});

export const create = mutation({
  args: {
    feishuInstanceCode: v.string(),
    feishuWorkflowCode: v.string(),
    projectId: v.id("projects"),
    triggerStage: v.optional(v.string()),
    triggeredBy: v.string(),
  },
  handler: async (ctx, args) => {
    const instanceId = await ctx.db.insert("workflowInstances", {
      feishuInstanceCode: args.feishuInstanceCode,
      feishuWorkflowCode: args.feishuWorkflowCode,
      projectId: args.projectId,
      status: "pending",
      triggerStage: args.triggerStage,
      triggeredBy: args.triggeredBy,
    });

    await ctx.db.insert("auditEvents", {
      action: "workflow.triggered",
      actorId: args.triggeredBy,
      changeSummary: `Workflow "${args.feishuWorkflowCode}" triggered (instance: ${args.feishuInstanceCode})`,
      objectId: instanceId,
      objectType: "workflow_instance",
      projectId: args.projectId,
    });

    return instanceId;
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("workflowInstances"),
    nodeCallbackData: v.optional(v.string()),
    resolvedBy: v.optional(v.string()),
    status: workflowStatus,
  },
  handler: async (ctx, args) => {
    const instance = await ctx.db.get(args.id);
    if (!instance) {
      return;
    }

    const patch: Record<string, unknown> = { status: args.status };

    if (args.nodeCallbackData) {
      patch.nodeCallbackData = args.nodeCallbackData;
    }

    if (args.resolvedBy) {
      patch.resolvedBy = args.resolvedBy;
    }

    const isTerminal = ["approved", "rejected", "cancelled", "error"].includes(
      args.status
    );
    if (isTerminal) {
      patch.resolvedAt = Date.now();
    }

    patch.lastPolledAt = Date.now();
    await ctx.db.patch(args.id, patch);

    await ctx.db.insert("auditEvents", {
      action: `workflow.${args.status}`,
      actorId: args.resolvedBy ?? "system",
      changeSummary: `Workflow instance ${instance.feishuInstanceCode} status → ${args.status}`,
      objectId: args.id,
      objectType: "workflow_instance",
      projectId: instance.projectId,
    });
  },
});
