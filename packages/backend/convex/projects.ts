import { v } from "convex/values";

import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";

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
        v.literal("cancelled")
      )
    ),
  },
  handler: (ctx, args) => {
    if (args.status) {
      return ctx.db
        .query("projects")
        .withIndex("by_status", (q) =>
          q.eq(
            "status",
            args.status as
              | "new"
              | "assessment"
              | "solution"
              | "ready"
              | "executing"
              | "delivering"
              | "done"
              | "cancelled"
          )
        )
        .collect();
    }
    return ctx.db.query("projects").collect();
  },
});

export const getById = query({
  args: { id: v.id("projects") },
  handler: (ctx, args) => ctx.db.get(args.id),
});

export const create = mutation({
  args: {
    createdBy: v.string(),
    customerName: v.optional(v.string()),
    departmentId: v.string(),
    description: v.string(),
    endDate: v.optional(v.number()),
    name: v.string(),
    ownerId: v.string(),
    priority: v.optional(
      v.union(
        v.literal("low"),
        v.literal("medium"),
        v.literal("high"),
        v.literal("urgent")
      )
    ),
    slaDeadline: v.optional(v.number()),
    sourceEntry: v.union(
      v.literal("workbench"),
      v.literal("message_shortcut"),
      v.literal("api")
    ),
    startDate: v.optional(v.number()),
    templateId: v.optional(v.string()),
    templateVersion: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const projectId = await ctx.db.insert("projects", {
      ...args,
      status: "new",
    });

    await ctx.db.insert("auditEvents", {
      action: "project.created",
      actorId: args.createdBy,
      changeSummary: `Project "${args.name}" created via ${args.sourceEntry}`,
      objectId: projectId,
      objectType: "project",
      projectId,
      sourceEntry: args.sourceEntry,
    });

    return projectId;
  },
});

export const createFromTemplate = mutation({
  args: {
    createdBy: v.string(),
    customerName: v.optional(v.string()),
    departmentId: v.string(),
    description: v.string(),
    endDate: v.optional(v.number()),
    name: v.string(),
    ownerId: v.string(),
    priority: v.optional(
      v.union(
        v.literal("low"),
        v.literal("medium"),
        v.literal("high"),
        v.literal("urgent")
      )
    ),
    slaDeadline: v.optional(v.number()),
    sourceEntry: v.union(
      v.literal("workbench"),
      v.literal("message_shortcut"),
      v.literal("api")
    ),
    startDate: v.optional(v.number()),
    templateId: v.id("projectTemplates"),
  },
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.templateId);
    if (!template) {
      throw new Error(`Template ${args.templateId} not found`);
    }

    const projectId = await ctx.db.insert("projects", {
      createdBy: args.createdBy,
      customerName: args.customerName,
      departmentId: args.departmentId,
      description: args.description,
      endDate: args.endDate,
      name: args.name,
      ownerId: args.ownerId,
      priority: args.priority ?? template.defaultPriority,
      slaDeadline: args.slaDeadline,
      sourceEntry: args.sourceEntry,
      startDate: args.startDate,
      status: "new",
      templateId: args.templateId,
      templateVersion: template.version,
    });

    for (const department of template.departments) {
      await ctx.db.insert("departmentTracks", {
        departmentId: department.departmentId,
        departmentName: department.departmentName,
        isRequired: department.isRequired,
        ownerId: department.defaultOwnerId,
        projectId,
        status: department.isRequired ? "not_started" : "not_required",
      });
    }

    await ctx.db.insert("auditEvents", {
      action: "project.created",
      actorId: args.createdBy,
      changeSummary: `Project "${args.name}" created from template "${template.name}" (v${template.version})`,
      objectId: projectId,
      objectType: "project",
      projectId,
      sourceEntry: args.sourceEntry,
    });

    // Auto-create Feishu group chat per template chatPolicy
    if (template.chatPolicy.autoCreateChat) {
      const chatName = template.chatPolicy.chatNameTemplate
        ? template.chatPolicy.chatNameTemplate.replace("{{name}}", args.name)
        : `Project: ${args.name}`;

      await ctx.scheduler.runAfter(
        0,
        internal.feishuActions.createProjectChat,
        {
          description: `Auto-created chat for project "${args.name}"`,
          name: chatName,
          ownerOpenId: args.ownerId,
          projectId,
          userOpenIds: [],
        }
      );
    }

    return {
      projectId,
      templateName: template.name,
      templateVersion: template.version,
    };
  },
});

export const updateStatus = mutation({
  args: {
    actorId: v.string(),
    id: v.id("projects"),
    status: v.union(
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
    const project = await ctx.db.get(args.id);
    if (!project) {
      throw new Error(`Project ${args.id} not found`);
    }

    const fromStatus = project.status;
    await ctx.db.patch(args.id, { status: args.status });

    await ctx.db.insert("auditEvents", {
      action: "project.status_changed",
      actorId: args.actorId,
      changeSummary: `Status changed from ${fromStatus} to ${args.status}`,
      objectId: args.id,
      objectType: "project",
      projectId: args.id,
    });
  },
});
