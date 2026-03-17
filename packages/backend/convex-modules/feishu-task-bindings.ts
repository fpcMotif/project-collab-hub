import { v } from "convex/values";

import { query, mutation } from "../convex/_generated/server";

export const getByTaskGuid = query({
  args: { feishuTaskGuid: v.string() },
  handler: (ctx, args) =>
    ctx.db
      .query("feishuTaskBindings")
      .withIndex("by_feishu_task", (q) =>
        q.eq("feishuTaskGuid", args.feishuTaskGuid)
      )
      .first(),
});

export const listForSync = query({
  args: { projectId: v.id("projects") },
  handler: (ctx, args) =>
    ctx.db
      .query("feishuTaskBindings")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect(),
});

export const patchStatus = mutation({
  args: {
    feishuTaskStatus: v.string(),
    id: v.id("feishuTaskBindings"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      feishuTaskStatus: args.feishuTaskStatus,
      lastSyncedAt: Date.now(),
    });
  },
});

export const applyTaskEvent = mutation({
  args: {
    feishuTaskGuid: v.string(),
    feishuTaskStatus: v.string(),
    idempotencyKey: v.string(),
    workItemStatus: v.union(
      v.literal("todo"),
      v.literal("in_progress"),
      v.literal("in_review"),
      v.literal("done")
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("auditEvents")
      .withIndex("by_idempotency_key", (q) =>
        q.eq("idempotencyKey", args.idempotencyKey)
      )
      .first();
    if (existing) {
      return;
    }

    const binding = await ctx.db
      .query("feishuTaskBindings")
      .withIndex("by_feishu_task", (q) =>
        q.eq("feishuTaskGuid", args.feishuTaskGuid)
      )
      .first();
    if (!binding) {
      return;
    }

    await ctx.db.patch(binding._id, {
      feishuTaskStatus: args.feishuTaskStatus,
      lastSyncedAt: Date.now(),
    });

    const workItem = await ctx.db.get(binding.workItemId);
    if (!workItem) {
      return;
    }

    const patch: Record<string, unknown> = { status: args.workItemStatus };
    if (args.workItemStatus === "done") {
      patch.completedAt = Date.now();
    }
    await ctx.db.patch(binding.workItemId, patch);

    await ctx.db.insert("auditEvents", {
      action: "work_item.status_changed",
      actorId: "system",
      changeSummary: `"${workItem.title}" status synced from Feishu task to ${args.workItemStatus}`,
      idempotencyKey: args.idempotencyKey,
      objectId: binding.workItemId,
      objectType: "work_item",
      projectId: binding.projectId,
    });
  },
});
