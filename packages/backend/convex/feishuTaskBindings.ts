import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const listForSync = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return ctx.db.query("feishuTaskBindings").take(args.limit ?? 200);
  },
});

export const patchStatus = mutation({
  args: {
    bindingId: v.id("feishuTaskBindings"),
    feishuTaskStatus: v.string(),
  },
  handler: async (ctx, args) => {
    const binding = await ctx.db.get(args.bindingId);
    if (!binding) {
      throw new Error(`Task binding ${args.bindingId} not found`);
    }

    await ctx.db.patch(args.bindingId, {
      feishuTaskStatus: args.feishuTaskStatus,
      lastSyncedAt: Date.now(),
    });

    await ctx.db.insert("auditEvents", {
      projectId: binding.projectId,
      actorId: "system:reconcile_job",
      action: "feishu.task_binding.status_reconciled",
      objectType: "feishu_task_binding",
      objectId: args.bindingId,
      changeSummary: `Task status reconciled to ${args.feishuTaskStatus}`,
      sourceEntry: "feishu_reconcile_job",
    });
  },
});
