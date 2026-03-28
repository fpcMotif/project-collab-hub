import { v } from "convex/values";

import { query, mutation } from "../convex/_generated/server";
import type { MutationCtx } from "../convex/_generated/server";

const getAuthenticatedUserId = async (
  ctx: MutationCtx
): Promise<string> => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Authentication required");
  }

  return identity.subject;
};

export const list = query({
  args: { activeOnly: v.optional(v.boolean()) },
  handler: (ctx, args) => {
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
  handler: (ctx, args) => ctx.db.get(args.id),
});

export const create = mutation({
  args: {
    approvalGates: v.array(
      v.object({
        approvalCode: v.string(),
        isRequired: v.boolean(),
        title: v.string(),
        triggerStage: v.string(),
      })
    ),
    chatPolicy: v.object({
      addBotAsManager: v.boolean(),
      autoCreateChat: v.boolean(),
      chatNameTemplate: v.optional(v.string()),
      pinProjectCard: v.boolean(),
    }),
    defaultPriority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("urgent")
    ),
    departments: v.array(
      v.object({
        defaultOwnerId: v.optional(v.string()),
        departmentId: v.string(),
        departmentName: v.string(),
        isRequired: v.boolean(),
      })
    ),
    description: v.string(),
    name: v.string(),
    notificationRules: v.array(
      v.object({
        channel: v.string(),
        enabled: v.boolean(),
        event: v.string(),
        recipientStrategy: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const createdBy = await getAuthenticatedUserId(ctx);
    const templateId = await ctx.db.insert("projectTemplates", {
      ...args,
      createdBy,
      isActive: true,
      updatedAt: Date.now(),
      version: 1,
    });

    await ctx.db.insert("auditEvents", {
      action: "template.created",
      actorId: createdBy,
      changeSummary: `Template "${args.name}" created (v1)`,
      objectId: templateId,
      objectType: "project_template",
    });

    return templateId;
  },
});

export const createNewVersion = mutation({
  args: {
    sourceTemplateId: v.id("projectTemplates"),
  },
  handler: async (ctx, args) => {
    const actorId = await getAuthenticatedUserId(ctx);
    const source = await ctx.db.get(args.sourceTemplateId);
    if (!source) {
      throw new Error(`Template ${args.sourceTemplateId} not found`);
    }

    await ctx.db.patch(args.sourceTemplateId, { isActive: false });

    const { _id, _creationTime, ...rest } = source;
    const newVersion = rest.version + 1;

    const newId = await ctx.db.insert("projectTemplates", {
      ...rest,
      isActive: true,
      updatedAt: Date.now(),
      version: newVersion,
    });

    await ctx.db.insert("auditEvents", {
      action: "template.versioned",
      actorId,
      changeSummary: `Template "${rest.name}" upgraded to v${newVersion}`,
      objectId: newId,
      objectType: "project_template",
    });

    return newId;
  },
});
