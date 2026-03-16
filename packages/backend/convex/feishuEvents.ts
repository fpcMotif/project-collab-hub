import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";

const MAX_RETRY_COUNT = 5;
const BASE_RETRY_DELAY_MS = 30_000;
const MAX_RETRY_DELAY_MS = 30 * 60_000;

export const ingestEvent = mutation({
  args: {
    event_id: v.string(),
    event_type: v.string(),
    payload: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("feishuEventInbox")
      .withIndex("by_event_id", (q) => q.eq("event_id", args.event_id))
      .first();

    if (existing) {
      return {
        accepted: false,
        eventDocId: existing._id,
        status: existing.status,
      };
    }

    const eventDocId = await ctx.db.insert("feishuEventInbox", {
      event_id: args.event_id,
      event_type: args.event_type,
      payload: args.payload,
      status: "pending",
      retry_count: 0,
      next_retry_at: Date.now(),
      dead_letter_at: undefined,
    });

    await ctx.db.insert("auditEvents", {
      actorId: "system:feishu_webhook",
      action: "feishu.event.ingested",
      objectType: "feishu_event",
      objectId: args.event_id,
      changeSummary: `Event ${args.event_type} ingested`,
      sourceEntry: "feishu_webhook",
      idempotencyKey: args.event_id,
    });

    return { accepted: true, eventDocId, status: "pending" as const };
  },
});

export const markProcessing = mutation({
  args: { eventDocId: v.id("feishuEventInbox") },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.eventDocId);
    if (!item) {
      return null;
    }

    if (item.status === "succeeded" || item.status === "dead_letter") {
      return null;
    }

    if (item.status === "processing") {
      return null;
    }

    if ((item.next_retry_at ?? 0) > Date.now()) {
      return null;
    }

    await ctx.db.patch(args.eventDocId, {
      status: "processing",
    });

    return item;
  },
});

export const markSucceeded = mutation({
  args: { eventDocId: v.id("feishuEventInbox") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.eventDocId, {
      status: "succeeded",
      next_retry_at: Date.now(),
    });
  },
});

export const markFailed = mutation({
  args: {
    eventDocId: v.id("feishuEventInbox"),
    errorMessage: v.string(),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.eventDocId);
    if (!item) {
      return { status: "missing" as const };
    }

    const nextRetryCount = item.retry_count + 1;
    const shouldDeadLetter = nextRetryCount > MAX_RETRY_COUNT;

    if (shouldDeadLetter) {
      const now = Date.now();
      await ctx.db.patch(args.eventDocId, {
        status: "dead_letter",
        retry_count: nextRetryCount,
        dead_letter_at: now,
        next_retry_at: now,
      });

      await ctx.db.insert("auditEvents", {
        actorId: "system:feishu_worker",
        action: "feishu.event.dead_letter",
        objectType: "feishu_event",
        objectId: item.event_id,
        changeSummary: args.errorMessage,
        sourceEntry: "feishu_worker",
        idempotencyKey: `${item.event_id}:dead_letter`,
      });

      return { status: "dead_letter" as const, event_id: item.event_id };
    }

    const retryDelay = Math.min(
      BASE_RETRY_DELAY_MS * 2 ** (nextRetryCount - 1),
      MAX_RETRY_DELAY_MS,
    );
    const nextRetryAt = Date.now() + retryDelay;

    await ctx.db.patch(args.eventDocId, {
      status: "retrying",
      retry_count: nextRetryCount,
      next_retry_at: nextRetryAt,
    });

    await ctx.db.insert("auditEvents", {
      actorId: "system:feishu_worker",
      action: "feishu.event.retry_scheduled",
      objectType: "feishu_event",
      objectId: item.event_id,
      changeSummary: `retry #${nextRetryCount}, next_retry_at=${nextRetryAt}, error=${args.errorMessage}`,
      sourceEntry: "feishu_worker",
      idempotencyKey: `${item.event_id}:retry:${nextRetryCount}`,
    });

    return {
      status: "retrying" as const,
      next_retry_at: nextRetryAt,
      retry_count: nextRetryCount,
      event_id: item.event_id,
    };
  },
});

export const listDueEvents = query({
  args: { now: v.number(), limit: v.number() },
  handler: async (ctx, args) => {
    const pending = await ctx.db
      .query("feishuEventInbox")
      .withIndex("by_status_next_retry", (q) =>
        q.eq("status", "pending").lte("next_retry_at", args.now),
      )
      .take(args.limit);

    const retrying = await ctx.db
      .query("feishuEventInbox")
      .withIndex("by_status_next_retry", (q) =>
        q.eq("status", "retrying").lte("next_retry_at", args.now),
      )
      .take(args.limit);

    return [...pending, ...retrying].slice(0, args.limit);
  },
});

export const dispatchEvent = action({
  args: { eventDocId: v.id("feishuEventInbox") },
  handler: async (ctx, args) => {
    const eventDoc = await ctx.runMutation(api.feishuEvents.markProcessing, {
      eventDocId: args.eventDocId,
    });

    if (!eventDoc) {
      return { skipped: true };
    }

    const startedAt = Date.now();

    try {
      const parsedPayload = JSON.parse(eventDoc.payload) as Record<string, unknown>;

      switch (eventDoc.event_type) {
        case "approval_instance":
          await dispatchApprovalEvent(ctx, parsedPayload, eventDoc.event_id);
          break;
        case "task.updated":
        case "task.completed":
          await dispatchTaskEvent(ctx, parsedPayload, eventDoc.event_id);
          break;
        default:
          console.info(
            JSON.stringify({
              metric: "feishu_event_unhandled_total",
              event_id: eventDoc.event_id,
              event_type: eventDoc.event_type,
            }),
          );
      }

      await ctx.runMutation(api.feishuEvents.markSucceeded, {
        eventDocId: args.eventDocId,
      });

      const latencyMs = Date.now() - startedAt;
      console.info(
        JSON.stringify({
          metric: "feishu_event_processing",
          event_id: eventDoc.event_id,
          event_type: eventDoc.event_type,
          status: "success",
          latency_ms: latencyMs,
          retry_count: eventDoc.retry_count,
          failure_rate_sample: 0,
        }),
      );

      return { processed: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const result = await ctx.runMutation(api.feishuEvents.markFailed, {
        eventDocId: args.eventDocId,
        errorMessage: message,
      });

      const latencyMs = Date.now() - startedAt;
      console.error(
        JSON.stringify({
          metric: "feishu_event_processing",
          event_id: eventDoc.event_id,
          event_type: eventDoc.event_type,
          status: "failed",
          latency_ms: latencyMs,
          retry_count: eventDoc.retry_count + 1,
          failure_rate_sample: 1,
          next_retry_at:
            "next_retry_at" in result ? result.next_retry_at : undefined,
          dead_letter: result.status === "dead_letter",
          error: message,
        }),
      );

      if (result.status === "dead_letter") {
        console.error(
          JSON.stringify({
            alert: "feishu_event_dead_letter",
            event_id: eventDoc.event_id,
            event_type: eventDoc.event_type,
            retry_count: eventDoc.retry_count + 1,
            error: message,
          }),
        );
      }

      return { processed: false, status: result.status };
    }
  },
});

export const dispatchDueEvents = action({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const dueEvents = await ctx.runQuery(api.feishuEvents.listDueEvents, {
      now: Date.now(),
      limit: args.limit ?? 50,
    });

    await Promise.all(
      dueEvents.map((eventDoc) =>
        ctx.scheduler.runAfter(0, api.feishuEvents.dispatchEvent, {
          eventDocId: eventDoc._id,
        }),
      ),
    );

    return { scheduled: dueEvents.length };
  },
});

export const reconcileFeishuState = action({
  args: {},
  handler: async (ctx) => {
    const approvals = await ctx.runQuery(api.approvalGates.listPending, {});
    const taskBindings = await ctx.runQuery(api.feishuTaskBindings.listForSync, { limit: 200 });

    let corrected = 0;

    for (const gate of approvals) {
      const remoteStatus = await fetchApprovalStatusFromFeishu(gate.instanceCode);
      if (!remoteStatus) continue;

      if (remoteStatus !== gate.status) {
        corrected += 1;
        await ctx.runMutation(api.approvalGates.resolve, {
          id: gate._id,
          instanceCode: gate.instanceCode ?? "",
          status: remoteStatus,
          resolvedBy: "system:reconcile_job",
          idempotencyKey: `reconcile:${gate._id}:${Date.now()}`,
        });
      }
    }

    for (const binding of taskBindings) {
      const remoteStatus = await fetchTaskStatusFromFeishu(binding.feishuTaskGuid);
      if (!remoteStatus || remoteStatus === binding.feishuTaskStatus) continue;

      corrected += 1;
      await ctx.runMutation(api.feishuTaskBindings.patchStatus, {
        bindingId: binding._id,
        feishuTaskStatus: remoteStatus,
      });
    }

    console.info(
      JSON.stringify({
        metric: "feishu_reconcile_job",
        checked_approvals: approvals.length,
        checked_tasks: taskBindings.length,
        corrected,
      }),
    );

    await ctx.runMutation(api.auditEvents.logSystemEvent, {
      action: "feishu.reconcile.completed",
      objectType: "feishu_reconcile",
      objectId: `${Date.now()}`,
      changeSummary: `checked approvals=${approvals.length}, tasks=${taskBindings.length}, corrected=${corrected}`,
    });

    return { checkedApprovals: approvals.length, checkedTasks: taskBindings.length, corrected };
  },
});

async function dispatchApprovalEvent(
  ctx: { runQuery: typeof Function.prototype; runMutation: typeof Function.prototype },
  body: Record<string, unknown>,
  eventId: string,
) {
  const event = body.event as Record<string, unknown> | undefined;
  if (!event) return;

  const instanceCode = event.instance_code as string | undefined;
  const approvalStatus = event.status as string | undefined;

  if (!instanceCode || !approvalStatus) return;

  const statusMap: Record<string, "approved" | "rejected" | "cancelled"> = {
    APPROVED: "approved",
    REJECTED: "rejected",
    CANCELED: "cancelled",
  };
  const mappedStatus = statusMap[approvalStatus];
  if (!mappedStatus) return;

  const gate = await (ctx.runQuery as Function)(
    api.approvalGates.getByInstanceCode,
    { instanceCode },
  );
  if (!gate) return;

  await (ctx.runMutation as Function)(api.approvalGates.resolve, {
    id: gate._id,
    instanceCode,
    status: mappedStatus,
    resolvedBy: (event.user_id as string) ?? "system",
    idempotencyKey: eventId,
  });
}

async function dispatchTaskEvent(
  _ctx: { runQuery: typeof Function.prototype; runMutation: typeof Function.prototype },
  body: Record<string, unknown>,
  eventId: string,
) {
  const event = body.event as Record<string, unknown> | undefined;
  const taskGuid = event?.task_id as string | undefined;

  console.info(
    JSON.stringify({
      metric: "feishu_task_event_received",
      event_id: eventId,
      task_guid: taskGuid,
    }),
  );
}

async function fetchApprovalStatusFromFeishu(
  _instanceCode: string | undefined,
): Promise<"pending" | "approved" | "rejected" | "cancelled" | null> {
  // TODO: Replace with Feishu OpenAPI lookup.
  return null;
}

async function fetchTaskStatusFromFeishu(
  _taskGuid: string,
): Promise<string | null> {
  // TODO: Replace with Feishu Task API lookup.
  return null;
}
