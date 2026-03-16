import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireProjectAccess } from "./authz";
import { insertAuditEvent, withAuditSource } from "./auditEvents";

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
      "approvalGate.listByProject",
    );

    return ctx.db
      .query("approvalGates")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

export const getByInstanceCode = query({
  args: { instanceCode: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("approvalGates")
      .withIndex("by_instance_code", (q) =>
        q.eq("instanceCode", args.instanceCode),
      )
      .first();
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
    applicantDepartmentId: v.optional(v.string()),
    applicantRole: roleValidator,
    snapshotData: v.optional(v.string()),
    templateVersion: v.optional(v.number()),
    sourceEntry: v.optional(v.string()),
    sourceIp: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireProjectAccess(
      ctx,
      {
        projectId: args.projectId,
        actorId: args.applicantId,
        actorDepartmentId: args.applicantDepartmentId,
        actorRole: args.applicantRole,
        sourceEntry: args.sourceEntry,
        sourceIp: args.sourceIp,
      },
      "write",
      "approvalGate.create",
    );

    const { applicantDepartmentId, applicantRole, sourceEntry, sourceIp, ...insertArgs } = args;
    const gateId = await ctx.db.insert("approvalGates", {
      ...insertArgs,
      status: "pending",
    });

    await insertAuditEvent(ctx, {
      projectId: args.projectId,
      actorId: args.applicantId,
      action: "approval_gate.created",
      objectType: "approval_gate",
      objectId: gateId,
      changeSummary: `Approval "${args.title}" created for stage ${args.triggerStage}`,
      ...withAuditSource(args),
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
    resolverDepartmentId: v.optional(v.string()),
    resolverRole: roleValidator,
    idempotencyKey: v.optional(v.string()),
    sourceEntry: v.optional(v.string()),
    sourceIp: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.idempotencyKey) {
      const existing = await ctx.db
        .query("auditEvents")
        .withIndex("by_idempotency_key", (q) =>
          q.eq("idempotencyKey", args.idempotencyKey),
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

    await requireProjectAccess(
      ctx,
      {
        projectId: gate.projectId,
        actorId: args.resolvedBy,
        actorDepartmentId: args.resolverDepartmentId,
        actorRole: args.resolverRole,
        sourceEntry: args.sourceEntry,
        sourceIp: args.sourceIp,
      },
      "write",
      "approvalGate.resolve",
    );

    await ctx.db.patch(args.id, {
      instanceCode: args.instanceCode,
      status: args.status,
      resolvedAt: Date.now(),
      resolvedBy: args.resolvedBy,
    });

    await insertAuditEvent(ctx, {
      projectId: gate.projectId,
      actorId: args.resolvedBy,
      action: `approval_gate.${args.status}`,
      objectType: "approval_gate",
      objectId: args.id,
      changeSummary: `Approval "${gate.title}" ${args.status}`,
      idempotencyKey: args.idempotencyKey,
      ...withAuditSource(args),
    });
  },
});
