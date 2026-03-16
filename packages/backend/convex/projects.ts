import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertProjectPermission, listAccessibleProjects } from "./authz";

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
  },
  handler: async (ctx, args) => {
    const projects = args.status
      ? await ctx.db
          .query("projects")
          .withIndex("by_status", (q) => q.eq("status", args.status!))
          .collect()
      : await ctx.db.query("projects").collect();

    return listAccessibleProjects(ctx, args.actorId, projects, "project:read");
  },
});

export const getById = query({
  args: { id: v.id("projects"), actorId: v.string() },
  handler: async (ctx, args) => {
    await assertProjectPermission(ctx, {
      userId: args.actorId,
      projectId: args.id,
      action: "project:read",
      objectType: "project",
      objectId: args.id,
    });

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
    const actorRoles = await ctx.db
      .query("roleBindings")
      .withIndex("by_user", (q) => q.eq("userId", args.createdBy))
      .collect();
    if (
      !actorRoles.some((binding) =>
        ["platform_admin", "workspace_admin", "owner"].includes(binding.role),
      )
    ) {
      await ctx.db.insert("auditEvents", {
        actorId: args.createdBy,
        action: "permission.denied",
        objectType: "project",
        objectId: `project:${args.name}`,
        changeSummary: `User ${args.createdBy} is not allowed to perform project:create`,
        deniedReason: "missing_project_create_permission",
      });
      throw new Error("Permission denied: project:create");
    }

    const projectId = await ctx.db.insert("projects", {
      ...args,
      status: "new",
    });

    await ctx.db.insert("projectMembers", {
      projectId,
      userId: args.ownerId,
      role: "owner",
      grantedBy: args.createdBy,
      grantedAt: Date.now(),
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

    await assertProjectPermission(ctx, {
      userId: args.actorId,
      projectId: args.id,
      action: "project:write",
      objectType: "project",
      objectId: args.id,
    });

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
