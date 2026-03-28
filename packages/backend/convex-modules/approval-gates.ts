import { v } from "convex/values";

import { internal } from "../convex/_generated/api";
import { query, mutation } from "../convex/_generated/server";

export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: (ctx, args) =>
    ctx.db
      .query("approvalGates")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect(),
});

export const listPending = query({
  args: {},
  handler: (ctx) =>
    ctx.db
      .query("approvalGates")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect(),
});

export const getByInstanceCode = query({
  args: { instanceCode: v.string() },
  handler: (ctx, args) =>
    ctx.db
      .query("approvalGates")
      .withIndex("by_instance_code", (q) =>
        q.eq("instanceCode", args.instanceCode)
      )
      .first(),
});

export const get = query({
  args: { id: v.id("approvalGates") },
  handler: (ctx, args) => ctx.db.get(args.id),
});

export const create = mutation({
  args: {
    applicantId: v.string(),
    approvalCode: v.string(),
    departmentTrackId: v.optional(v.id("departmentTracks")),
    projectId: v.id("projects"),
    snapshotData: v.optional(v.string()),
    templateVersion: v.optional(v.number()),
    title: v.string(),
    triggerStage: v.union(
      v.literal("new"),
      v.literal("assessment"),
      v.literal("solution"),
      v.literal("ready"),
      v.literal("executing"),
      v.literal("delivering"),
      v.literal("done"),
      v.literal("cancelled")
    ),
    workItemId: v.optional(v.id("workItems")),
  },
  handler: async (ctx, args) => {
    const gateId = await ctx.db.insert("approvalGates", {
      ...args,
      status: "pending",
    });

    await ctx.db.insert("auditEvents", {
      action: "approval_gate.created",
      actorId: args.applicantId,
      changeSummary: `Approval "${args.title}" created for stage ${args.triggerStage}`,
      objectId: gateId,
      objectType: "approval_gate",
      projectId: args.projectId,
    });

    // Automatically trigger Feishu approval if an approvalCode is provided
    if (args.approvalCode) {
      await ctx.scheduler.runAfter(0, internal.feishuActions.submitApproval, {
        applicantId: args.applicantId,
        approvalCode: args.approvalCode,
        formData: args.snapshotData ?? "[]",
        gateId,
      });
    }

    // Notify project chat if it exists
    const chatBinding = await ctx.db
      .query("chatBindings")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .first();

    if (chatBinding) {
      await ctx.scheduler.runAfter(0, internal.notificationActions.enqueue, {
        channel: "group_chat",
        messageType: "workflow_approval",
        payload: JSON.stringify({
          // Ideally look up the name
          applicantName: args.applicantId,
          approvalTitle: args.title,
          gateId,
          // Ideally look up the project name
          projectName: "Project",
          submissionTime: new Date().toISOString().split("T")[0],
        }),
        projectId: args.projectId,
        recipientId: chatBinding.feishuChatId,
      });
    }

    return gateId;
  },
});

export const resolve = mutation({
  args: {
    id: v.id("approvalGates"),
    idempotencyKey: v.optional(v.string()),
    instanceCode: v.optional(v.string()),
    resolvedBy: v.string(),
    status: v.union(
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("cancelled")
    ),
  },
  handler: async (ctx, args) => {
    if (args.idempotencyKey) {
      const existing = await ctx.db
        .query("auditEvents")
        .withIndex("by_idempotency_key", (q) =>
          q.eq("idempotencyKey", args.idempotencyKey)
        )
        .first();
      if (existing) {
        return;
      }
    }

    const gate = await ctx.db.get(args.id);
    if (!gate) {
      throw new Error(`ApprovalGate ${args.id} not found`);
    }

    if (gate.status !== "pending") {
      return;
    }

    await ctx.db.patch(args.id, {
      instanceCode: args.instanceCode ?? gate.instanceCode,
      resolvedAt: Date.now(),
      resolvedBy: args.resolvedBy,
      status: args.status,
    });

    await ctx.db.insert("auditEvents", {
      action: `approval_gate.${args.status}`,
      actorId: args.resolvedBy,
      changeSummary: `Approval "${gate.title}" ${args.status}`,
      idempotencyKey: args.idempotencyKey,
      objectId: args.id,
      objectType: "approval_gate",
      projectId: gate.projectId,
    });

    // If approved, trigger project stage transition if applicable
    if (args.status === "approved") {
      const project = await ctx.db.get(gate.projectId);
      if (project && project.status !== gate.triggerStage) {
        await ctx.db.patch(gate.projectId, { status: gate.triggerStage });

        await ctx.db.insert("auditEvents", {
          action: "project.status_changed",
          actorId: args.resolvedBy,
          changeSummary: `Project stage advanced to ${gate.triggerStage} via approval of "${gate.title}"`,
          fromStage: project.status,
          objectId: gate.projectId,
          objectType: "project",
          projectId: gate.projectId,
          toStage: gate.triggerStage,
        });
      }
    }
  },
});
