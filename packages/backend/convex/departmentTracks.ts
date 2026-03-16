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
      "departmentTrack.listByProject",
    );

    return ctx.db
      .query("departmentTracks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    departmentId: v.string(),
    departmentName: v.string(),
    isRequired: v.boolean(),
    ownerId: v.optional(v.string()),
    dueDate: v.optional(v.number()),
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
      "write",
      "departmentTrack.create",
    );

    const { actorId, actorDepartmentId, actorRole, sourceEntry, sourceIp, ...insertArgs } = args;
    return ctx.db.insert("departmentTracks", {
      ...insertArgs,
      status: "not_started",
    });
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("departmentTracks"),
    status: v.union(
      v.literal("not_required"),
      v.literal("not_started"),
      v.literal("in_progress"),
      v.literal("blocked"),
      v.literal("waiting_approval"),
      v.literal("done"),
    ),
    blockReason: v.optional(v.string()),
    actorId: v.string(),
    actorDepartmentId: v.optional(v.string()),
    actorRole: roleValidator,
    sourceEntry: v.optional(v.string()),
    sourceIp: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const track = await ctx.db.get(args.id);
    if (!track) {
      throw new Error(`DepartmentTrack ${args.id} not found`);
    }

    await requireProjectAccess(
      ctx,
      {
        projectId: track.projectId,
        actorId: args.actorId,
        actorDepartmentId: args.actorDepartmentId,
        actorRole: args.actorRole,
        sourceEntry: args.sourceEntry,
        sourceIp: args.sourceIp,
      },
      "write",
      "departmentTrack.updateStatus",
    );

    await ctx.db.patch(args.id, {
      status: args.status,
      blockReason: args.status === "blocked" ? args.blockReason : undefined,
    });

    await insertAuditEvent(ctx, {
      projectId: track.projectId,
      actorId: args.actorId,
      action: "department_track.status_changed",
      objectType: "department_track",
      objectId: args.id,
      changeSummary: `${track.departmentName} status changed from ${track.status} to ${args.status}`,
      ...withAuditSource(args),
    });
  },
});
