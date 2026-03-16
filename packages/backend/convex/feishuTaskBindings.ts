import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getByTaskGuid = query({
  args: { taskGuid: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("feishuTaskBindings")
      .withIndex("by_feishu_task", (q) => q.eq("feishuTaskGuid", args.taskGuid))
      .first();
  },
});

export const applyTaskEvent = mutation({
  args: {
    bindingId: v.id("feishuTaskBindings"),
    workItemId: v.id("workItems"),
    taskGuid: v.string(),
    feishuTaskStatus: v.string(),
    mappedStatus: v.union(
      v.literal("todo"),
      v.literal("in_progress"),
      v.literal("in_review"),
      v.literal("done"),
    ),
    eventId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("auditEvents")
      .withIndex("by_idempotency_key", (q) => q.eq("idempotencyKey", args.eventId))
      .first();

    if (existing) {
      return { deduplicated: true };
    }

    const binding = await ctx.db.get(args.bindingId);
    if (!binding) {
      return { deduplicated: false, missingBinding: true };
    }

    const workItem = await ctx.db.get(args.workItemId);
    if (!workItem) {
      throw new Error(`WorkItem ${args.workItemId} not found`);
    }

    const workItemPatch: {
      status?: "todo" | "in_progress" | "in_review" | "done";
      completedAt?: number;
    } = {};

    if (workItem.status !== args.mappedStatus) {
      workItemPatch.status = args.mappedStatus;
      if (args.mappedStatus === "done") {
        workItemPatch.completedAt = Date.now();
      }
    }

    if (Object.keys(workItemPatch).length > 0) {
      await ctx.db.patch(args.workItemId, workItemPatch);
    }

    await ctx.db.patch(args.bindingId, {
      feishuTaskStatus: args.feishuTaskStatus,
      lastSyncedAt: Date.now(),
    });

    await ctx.db.insert("auditEvents", {
      projectId: binding.projectId,
      actorId: "feishu_bot",
      action: "work_item.status_synced_from_feishu",
      objectType: "work_item",
      objectId: args.workItemId,
      changeSummary:
        workItem.status === args.mappedStatus
          ? `Feishu task ${args.taskGuid} status observed as ${args.feishuTaskStatus}; local status already ${args.mappedStatus}`
          : `Feishu task ${args.taskGuid} status synced from ${workItem.status} to ${args.mappedStatus} (${args.feishuTaskStatus})`,
      sourceEntry: "feishu_webhook",
      idempotencyKey: args.eventId,
    });

    return { deduplicated: false, missingBinding: false };
  },
});
