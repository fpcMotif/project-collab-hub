import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const projectStatuses = [
  "new",
  "assessment",
  "solution",
  "ready",
  "executing",
  "delivering",
  "done",
  "cancelled",
] as const;

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
    templateId: v.id("projectTemplates"),
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
    externalRef: v.string(),
    sourceEntry: v.union(
      v.literal("workbench"),
      v.literal("message_shortcut"),
      v.literal("api"),
    ),
  },
  handler: async (ctx, args) => {
    const idempotencyKey = `project:create:${args.sourceEntry}:${args.externalRef}`;
    const existingCreateEvent = await ctx.db
      .query("auditEvents")
      .withIndex("by_idempotency_key", (q) => q.eq("idempotencyKey", idempotencyKey))
      .first();

    if (existingCreateEvent?.projectId) {
      return existingCreateEvent.projectId;
    }

    const inputTemplate = await ctx.db.get(args.templateId);
    if (!inputTemplate) {
      throw new Error(`Template ${args.templateId} not found`);
    }

    let activeTemplate = inputTemplate;
    if (!inputTemplate.isActive) {
      const activeByName = await ctx.db
        .query("projectTemplates")
        .withIndex("by_name", (q) => q.eq("name", inputTemplate.name))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();

      const latestActive = activeByName.sort((a, b) => b.version - a.version)[0];
      if (!latestActive) {
        throw new Error(`No active version found for template ${inputTemplate.name}`);
      }
      activeTemplate = latestActive;
    }

    const { externalRef, ...projectFields } = args;

    const projectId = await ctx.db.insert("projects", {
      ...projectFields,
      templateId: activeTemplate._id,
      templateVersion: activeTemplate.version,
      status: "new",
    });

    const departmentTrackPayload = activeTemplate.departments.map((department) => ({
      projectId,
      departmentId: department.departmentId,
      departmentName: department.departmentName,
      isRequired: department.isRequired,
      status: department.isRequired ? "not_started" : "not_required",
      ownerId: department.defaultOwnerId,
    }));

    await Promise.all(
      departmentTrackPayload.map((track) => ctx.db.insert("departmentTracks", track)),
    );

    await Promise.all(
      activeTemplate.approvalGates.map((gate) => {
        if (!projectStatuses.includes(gate.triggerStage as (typeof projectStatuses)[number])) {
          throw new Error(`Unsupported approval gate trigger stage: ${gate.triggerStage}`);
        }

        return ctx.db.insert("approvalGates", {
          projectId,
          triggerStage: gate.triggerStage as (typeof projectStatuses)[number],
          approvalCode: gate.approvalCode,
          status: "pending",
          title: gate.title,
          applicantId: args.createdBy,
          templateVersion: activeTemplate.version,
        });
      }),
    );

    await ctx.db.insert("auditEvents", {
      projectId,
      actorId: args.createdBy,
      action: "project.created",
      objectType: "project",
      objectId: projectId,
      changeSummary: `Project "${args.name}" created via ${args.sourceEntry}; template=${activeTemplate.name} v${activeTemplate.version}; injectedDepartments=${departmentTrackPayload.length}`,
      sourceEntry: args.sourceEntry,
      idempotencyKey,
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
