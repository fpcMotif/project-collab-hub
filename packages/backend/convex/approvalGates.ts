import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertProjectPermission } from "./authz";

export const listByProject = query({
  args: { projectId: v.id("projects"), actorId: v.string() },
  handler: async (ctx, args) => {
    await assertProjectPermission(ctx, {
      userId: args.actorId,
      projectId: args.projectId,
      action: "approval:read",
      objectType: "approval_gate",
      objectId: `project:${args.projectId}`,
    });

    return ctx.db
      .query("approvalGates")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

export const getByInstanceCode = query({
  args: { instanceCode: v.string(), actorId: v.string() },
  handler: async (ctx, args) => {
    const gate = await ctx.db
      .query("approvalGates")
      .withIndex("by_instance_code", (q) => q.eq("instanceCode", args.instanceCode))
      .first();

    if (gate) {
      await assertProjectPermission(ctx, {
        userId: args.actorId,
        projectId: gate.projectId,
        action: "approval:read",
        objectType: "approval_gate",
        objectId: gate._id,
      });
    }

    return gate;
  },
});

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    departmentTrackId: v.optional(v.id("departmentTracks")),
    triggerStage: v.union(
      v.literal("new"),
      v.literal("assessment"),
      v.literal("solution"),
      v.literal("ready"),
      v.literal("executing"),
      v.literal("delivering"),
      v.literal("done"),
      v.literal("cancelled"),
    ),
    approvalCode: v.string(),
    title: v.string(),
    applicantId: v.string(),
    snapshotData: v.optional(v.string()),
    templateVersion: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await assertProjectPermission(ctx, {
      userId: args.applicantId,
      projectId: args.projectId,
      action: "approval:write",
      objectType: "approval_gate",
      objectId: `project:${args.projectId}`,
    });

    const gateId = await ctx.db.insert("approvalGates", {
      ...args,
      status: "pending",
    });

    await ctx.db.insert("auditEvents", {
      projectId: args.projectId,
      actorId: args.applicantId,
      action: "approval_gate.created",
      objectType: "approval_gate",
      objectId: gateId,
      changeSummary: `Approval "${args.title}" created for stage ${args.triggerStage}`,
    });

    return gateId;
  },
});

export const resolve = mutation({
  args: {
    id: v.id("approvalGates"),
    instanceCode: v.string(),
    status: v.union(v.literal("approved"), v.literal("rejected")),
    resolvedBy: v.string(),
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.idempotencyKey) {
      const existing = await ctx.db
        .query("auditEvents")
        .withIndex("by_idempotency_key", (q) => q.eq("idempotencyKey", args.idempotencyKey))
        .first();
      if (existing) {
        return;
      }
    }

    const gate = await ctx.db.get(args.id);
    if (!gate) {
      throw new Error(`ApprovalGate ${args.id} not found`);
    }

    await assertProjectPermission(ctx, {
      userId: args.resolvedBy,
      projectId: gate.projectId,
      action: "approval:write",
      objectType: "approval_gate",
      objectId: args.id,
    });

    await ctx.db.patch(args.id, {
      instanceCode: args.instanceCode,
      status: args.status,
      resolvedAt: Date.now(),
      resolvedBy: args.resolvedBy,
    });

    await ctx.db.insert("auditEvents", {
      projectId: gate.projectId,
      actorId: args.resolvedBy,
      action: `approval_gate.${args.status}`,
      objectType: "approval_gate",
      objectId: args.id,
      changeSummary: `Approval "${gate.title}" ${args.status}`,
      idempotencyKey: args.idempotencyKey,
    });
  },
});
