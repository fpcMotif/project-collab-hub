import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
} from "./_generated/server";

const RETRY_BACKOFF_MS = [60_000, 5 * 60_000, 15 * 60_000];
const MAX_RETRY = RETRY_BACKOFF_MS.length;

export const enqueue = mutation({
  args: {
    source: v.union(
      v.literal("events"),
      v.literal("card_callback"),
      v.literal("link_preview"),
    ),
    eventId: v.string(),
    eventType: v.string(),
    payload: v.string(),
  },
  handler: async (ctx, args) => {
    const exists = await ctx.db
      .query("eventInbox")
      .withIndex("by_event_id", (q) => q.eq("eventId", args.eventId))
      .first();

    if (exists) {
      return exists._id;
    }

    const id = await ctx.db.insert("eventInbox", {
      ...args,
      status: "pending",
      retryCount: 0,
      maxRetry: MAX_RETRY,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await ctx.scheduler.runAfter(0, internal.eventInbox.processSingle, { id });
    return id;
  },
});

export const getById = internalQuery({
  args: { id: v.id("eventInbox") },
  handler: async (ctx, args) => ctx.db.get(args.id),
});

export const markProcessing = internalMutation({
  args: { id: v.id("eventInbox") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: "processing", updatedAt: Date.now() });
  },
});

export const markDone = internalMutation({
  args: { id: v.id("eventInbox") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "processed",
      processedAt: Date.now(),
      updatedAt: Date.now(),
      lastError: undefined,
      alarmLevel: undefined,
      alarmMessage: undefined,
      deadLetterAt: undefined,
    });
  },
});

export const markFailed = internalMutation({
  args: {
    id: v.id("eventInbox"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row) return;

    const nextRetry = row.retryCount + 1;
    if (nextRetry > row.maxRetry) {
      await ctx.db.patch(args.id, {
        status: "dead_letter",
        retryCount: nextRetry,
        lastError: args.reason,
        deadLetterAt: Date.now(),
        updatedAt: Date.now(),
        alarmLevel: "critical",
        alarmMessage: `Event moved to dead letter after ${nextRetry} retries`,
      });
      return;
    }

    const nextRetryAt = Date.now() + RETRY_BACKOFF_MS[Math.min(nextRetry - 1, RETRY_BACKOFF_MS.length - 1)];
    await ctx.db.patch(args.id, {
      status: "retrying",
      retryCount: nextRetry,
      nextRetryAt,
      lastError: args.reason,
      updatedAt: Date.now(),
      alarmLevel: "warning",
      alarmMessage: `Retry scheduled at ${new Date(nextRetryAt).toISOString()}`,
    });

    await ctx.scheduler.runAfter(nextRetryAt - Date.now(), internal.eventInbox.processSingle, {
      id: args.id,
    });
  },
});

async function handleApprovalEvent(body: Record<string, unknown>, eventId: string, runQuery: Function, runMutation: Function) {
  const event = body.event as Record<string, unknown> | undefined;
  if (!event) return;

  const instanceCode = event.instance_code as string | undefined;
  const approvalStatus = event.status as string | undefined;
  if (!instanceCode || !approvalStatus) return;

  const statusMap: Record<string, "approved" | "rejected" | "cancelled" | undefined> = {
    APPROVED: "approved",
    REJECTED: "rejected",
    CANCELED: "cancelled",
  };
  const mappedStatus = statusMap[approvalStatus];
  if (!mappedStatus || mappedStatus === "cancelled") return;

  const gate = await runQuery(api.approvalGates.getByInstanceCode, { instanceCode });
  if (!gate) return;

  await runMutation(api.approvalGates.resolve, {
    id: gate._id,
    instanceCode,
    status: mappedStatus,
    resolvedBy: (event.user_id as string) ?? "system",
    idempotencyKey: eventId,
  });
}

async function handleTaskEvent(body: Record<string, unknown>, runQuery: Function, runMutation: Function) {
  const event = body.event as Record<string, unknown> | undefined;
  if (!event) return;

  const taskGuid = (event.task_id as string | undefined) ?? (event.guid as string | undefined);
  const taskStatus = event.status as string | undefined;
  if (!taskGuid || !taskStatus) return;

  const binding = await runQuery(api.feishuTaskBindings.getByFeishuTaskGuid, { taskGuid });
  if (!binding) return;

  await runMutation(api.feishuTaskBindings.updateSyncStatus, {
    id: binding._id,
    feishuTaskStatus: taskStatus,
  });

  const statusMap: Record<string, "todo" | "in_progress" | "in_review" | "done" | undefined> = {
    CREATED: "todo",
    IN_PROGRESS: "in_progress",
    COMPLETED: "done",
  };

  const workItemStatus = statusMap[taskStatus];
  if (!workItemStatus) return;

  await runMutation(api.workItems.updateStatus, {
    id: binding.workItemId,
    status: workItemStatus,
    actorId: "feishu_webhook",
  });
}

async function handleCardCallback(body: Record<string, unknown>, runMutation: Function) {
  const action = body.action as Record<string, unknown> | undefined;
  const actionTag = (action?.tag as string) ?? "";
  const actionValue = action?.value as Record<string, string> | undefined;

  if (actionTag === "claim_work_item" && actionValue?.workItemId && actionValue?.userId) {
    await runMutation(api.workItems.updateStatus, {
      id: actionValue.workItemId as never,
      status: "in_progress",
      actorId: actionValue.userId,
    });
  }
}

export const processSingle = internalAction({
  args: { id: v.id("eventInbox") },
  handler: async (ctx, args) => {
    const row = await ctx.runQuery(internal.eventInbox.getById, { id: args.id });
    if (!row || row.status === "processed" || row.status === "dead_letter") {
      return;
    }

    await ctx.runMutation(internal.eventInbox.markProcessing, { id: args.id });

    try {
      const payload = JSON.parse(row.payload) as Record<string, unknown>;
      if (row.source === "events") {
        if (row.eventType === "approval_instance") {
          await handleApprovalEvent(payload, row.eventId, ctx.runQuery, ctx.runMutation);
        }

        if (row.eventType === "task.updated" || row.eventType === "task.completed") {
          await handleTaskEvent(payload, ctx.runQuery, ctx.runMutation);
        }
      }

      if (row.source === "card_callback") {
        await handleCardCallback(payload, ctx.runMutation);
      }

      await ctx.runMutation(internal.eventInbox.markDone, { id: args.id });
    } catch (error) {
      await ctx.runMutation(internal.eventInbox.markFailed, {
        id: args.id,
        reason: error instanceof Error ? error.message : "Unknown event processing failure",
      });
    }
  },
});

export const processDue = internalAction({
  args: {},
  handler: async (ctx) => {
    const pending = await ctx.runQuery(internal.eventInbox.listDue, {});
    for (const item of pending) {
      await ctx.scheduler.runAfter(0, internal.eventInbox.processSingle, { id: item._id });
    }
  },
});

export const listDue = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const pending = await ctx.db
      .query("eventInbox")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    const retrying = await ctx.db
      .query("eventInbox")
      .withIndex("by_status", (q) => q.eq("status", "retrying"))
      .collect();

    return [...pending, ...retrying.filter((item) => (item.nextRetryAt ?? 0) <= now)].slice(0, 50);
  },
});
