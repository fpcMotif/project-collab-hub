import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { activeOnly: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    if (args.activeOnly) {
      return ctx.db
        .query("projectTemplates")
        .withIndex("by_active", (q) => q.eq("isActive", true))
        .collect();
    }
    return ctx.db.query("projectTemplates").collect();
  },
});

export const getById = query({
  args: { id: v.id("projectTemplates") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    departments: v.array(
      v.object({
        departmentId: v.string(),
        departmentName: v.string(),
        isRequired: v.boolean(),
        defaultOwnerId: v.optional(v.string()),
      }),
    ),
    approvalGates: v.array(
      v.object({
        triggerStage: v.string(),
        approvalCode: v.string(),
        title: v.string(),
        isRequired: v.boolean(),
      }),
    ),
    notificationRules: v.array(
      v.object({
        event: v.string(),
        channel: v.string(),
        enabled: v.boolean(),
        recipientStrategy: v.string(),
      }),
    ),
    chatPolicy: v.object({
      autoCreateChat: v.boolean(),
      addBotAsManager: v.boolean(),
      pinProjectCard: v.boolean(),
      chatNameTemplate: v.optional(v.string()),
    }),
    defaultPriority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("urgent"),
    ),
    createdBy: v.string(),
  },
  handler: async (ctx, args) => {
    const templateId = await ctx.db.insert("projectTemplates", {
      ...args,
      version: 1,
      isActive: true,
      updatedAt: Date.now(),
    });

    await ctx.db.insert("auditEvents", {
      actorId: args.createdBy,
      action: "template.created",
      objectType: "project_template",
      objectId: templateId,
      changeSummary: `Template "${args.name}" created (v1)`,
    });

    return templateId;
  },
});

export const createNewVersion = mutation({
  args: {
    sourceTemplateId: v.id("projectTemplates"),
    actorId: v.string(),
  },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceTemplateId);
    if (!source) {
      throw new Error(`Template ${args.sourceTemplateId} not found`);
    }

    await ctx.db.patch(args.sourceTemplateId, { isActive: false });

    const { _id, _creationTime, ...rest } = source;
    const newVersion = rest.version + 1;

    const newId = await ctx.db.insert("projectTemplates", {
      ...rest,
      version: newVersion,
      isActive: true,
      updatedAt: Date.now(),
    });

    await ctx.db.insert("auditEvents", {
      actorId: args.actorId,
      action: "template.versioned",
      objectType: "project_template",
      objectId: newId,
      changeSummary: `Template "${rest.name}" upgraded to v${newVersion}`,
    });

    return newId;
  },
});
