import { v } from "convex/values";

import { internal } from "../convex/_generated/api";
import { mutation, query } from "../convex/_generated/server";

export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: (ctx, args) =>
    ctx.db
      .query("baseBindings")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect(),
});

export const getByRecordId = query({
  args: { recordId: v.string() },
  handler: (ctx, args) =>
    ctx.db
      .query("baseBindings")
      .withIndex("by_record", (q) => q.eq("recordId", args.recordId))
      .first(),
});

export const create = mutation({
  args: {
    baseAppToken: v.string(),
    fieldOwnership: v.optional(v.string()),
    projectId: v.id("projects"),
    recordId: v.string(),
    tableId: v.string(),
  },
  handler: async (ctx, args) => {
    const bindingId = await ctx.db.insert("baseBindings", {
      baseAppToken: args.baseAppToken,
      fieldOwnership: args.fieldOwnership,
      lastSyncedAt: Date.now(),
      projectId: args.projectId,
      recordId: args.recordId,
      tableId: args.tableId,
    });

    await ctx.db.insert("auditEvents", {
      action: "base_binding.created",
      actorId: "system",
      changeSummary: `Linked project to Base table ${args.tableId}, record ${args.recordId}`,
      objectId: bindingId,
      objectType: "base_binding",
      projectId: args.projectId,
    });

    return bindingId;
  },
});

export const linkAndSync = mutation({
  args: {
    baseAppToken: v.string(),
    fieldOwnership: v.optional(v.string()),
    projectId: v.id("projects"),
    recordId: v.string(),
    tableId: v.string(),
  },
  handler: async (ctx, args) => {
    const bindingId = await ctx.db.insert("baseBindings", {
      baseAppToken: args.baseAppToken,
      fieldOwnership: args.fieldOwnership,
      lastSyncedAt: Date.now(),
      projectId: args.projectId,
      recordId: args.recordId,
      tableId: args.tableId,
    });

    await ctx.db.insert("auditEvents", {
      action: "base_binding.created",
      actorId: "system",
      changeSummary: `Linked project to Base table ${args.tableId}, record ${args.recordId}`,
      objectId: bindingId,
      objectType: "base_binding",
      projectId: args.projectId,
    });

    // Schedule initial sync push
    await ctx.scheduler.runAfter(
      0,
      internal.baseSyncActions.syncProjectToBase,
      { bindingId }
    );

    return bindingId;
  },
});

export const updateSyncStatus = mutation({
  args: {
    bindingId: v.id("baseBindings"),
    recordId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = { lastSyncedAt: Date.now() };
    if (args.recordId) {
      patch.recordId = args.recordId;
    }
    await ctx.db.patch(args.bindingId, patch);
  },
});

export const remove = mutation({
  args: { bindingId: v.id("baseBindings") },
  handler: async (ctx, args) => {
    const binding = await ctx.db.get(args.bindingId);
    if (!binding) {
      return;
    }

    await ctx.db.delete(args.bindingId);

    await ctx.db.insert("auditEvents", {
      action: "base_binding.removed",
      actorId: "system",
      changeSummary: `Unlinked project from Base record ${binding.recordId}`,
      objectId: args.bindingId,
      objectType: "base_binding",
      projectId: binding.projectId,
    });
  },
});
