import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { insertAuditEvent, withAuditSource } from "./auditEvents";
import { canReadProject, requireProjectAccess } from "./authz";

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
    actorId: v.string(),
    actorDepartmentId: v.optional(v.string()),
    actorRole: roleValidator,
  },
  handler: async (ctx, args) => {
    const projects = args.status
      ? await ctx.db
          .query("projects")
          .withIndex("by_status", (q) => q.eq("status", args.status!))
          .collect()
      : await ctx.db.query("projects").collect();

    return projects.filter((project) =>
      canReadProject(project, {
        projectId: project._id,
        actorId: args.actorId,
        actorDepartmentId: args.actorDepartmentId,
        actorRole: args.actorRole,
      }),
    );
  },
});

export const getById = query({
  args: {
    id: v.id("projects"),
    actorId: v.string(),
    actorDepartmentId: v.optional(v.string()),
    actorRole: roleValidator,
    sourceEntry: v.optional(v.string()),
    sourceIp: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return requireProjectAccess(
      ctx,
      {
        projectId: args.id,
        actorId: args.actorId,
        actorDepartmentId: args.actorDepartmentId,
        actorRole: args.actorRole,
        sourceEntry: args.sourceEntry,
        sourceIp: args.sourceIp,
      },
      "read",
      "project.getById",
    );
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
    sourceIp: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { sourceIp, ...projectArgs } = args;
    const projectId = await ctx.db.insert("projects", {
      ...projectArgs,
      status: "new",
    });

    await insertAuditEvent(ctx, {
      projectId,
      actorId: args.createdBy,
      action: "project.created",
      objectType: "project",
      objectId: projectId,
      changeSummary: `Project "${args.name}" created via ${args.sourceEntry}`,
      ...withAuditSource(args),
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
    actorDepartmentId: v.optional(v.string()),
    actorRole: roleValidator,
    sourceEntry: v.optional(v.string()),
    sourceIp: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const project = await requireProjectAccess(
      ctx,
      {
        projectId: args.id,
        actorId: args.actorId,
        actorDepartmentId: args.actorDepartmentId,
        actorRole: args.actorRole,
        sourceEntry: args.sourceEntry,
        sourceIp: args.sourceIp,
      },
      "write",
      "project.updateStatus",
    );

    const fromStatus = project.status;
    await ctx.db.patch(args.id, { status: args.status });

    await insertAuditEvent(ctx, {
      projectId: args.id,
      actorId: args.actorId,
      action: "project.status_changed",
      objectType: "project",
      objectId: args.id,
      changeSummary: `Status changed from ${fromStatus} to ${args.status}`,
      ...withAuditSource(args),
    });
  },
});
