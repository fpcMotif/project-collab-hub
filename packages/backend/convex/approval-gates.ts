import { v } from "convex/values";

import { query, mutation } from "./_generated/server";

export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: (ctx, args) =>
    ctx.db
      .query("approvalGates")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
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

    return gateId;
  },
});

export const resolve = mutation({
  args: {
    id: v.id("approvalGates"),
    idempotencyKey: v.optional(v.string()),
    instanceCode: v.string(),
    resolvedBy: v.string(),
    status: v.union(v.literal("approved"), v.literal("rejected")),
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

    await ctx.db.patch(args.id, {
      instanceCode: args.instanceCode,
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
  },
});
