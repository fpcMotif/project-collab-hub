import { v } from "convex/values";

import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { buildNotificationCard } from "./lib/notification-card";
import {
  getNotificationRetryDelayMs,
  MAX_NOTIFICATION_RETRY_COUNT,
} from "./lib/notification-retry";

// ── Mutation: enqueue a notification delivery ────────────────────────────

export const enqueue = internalMutation({
  args: {
    channel: v.union(
      v.literal("group_chat"),
      v.literal("private_chat"),
      v.literal("batch_message")
    ),
    messageType: v.union(
      v.literal("mention"),
      v.literal("approval_result"),
      v.literal("task_update"),
      v.literal("stage_change"),
      v.literal("risk_alert")
    ),
    payload: v.string(),
    projectId: v.id("projects"),
    recipientId: v.string(),
  },
  handler: async (ctx, args) => {
    const deliveryId = await ctx.db.insert("notificationDeliveries", {
      channel: args.channel,
      messageType: args.messageType,
      payload: args.payload,
      projectId: args.projectId,
      recipientId: args.recipientId,
      retryCount: 0,
      status: "pending",
    });

    await ctx.scheduler.runAfter(
      0,
      internal.notificationActions.processDelivery,
      { deliveryId }
    );

    return deliveryId;
  },
});

// ── Action: process a single delivery by sending via Feishu ──────────────

export const processDelivery = internalAction({
  args: { deliveryId: v.id("notificationDeliveries") },
  handler: async (ctx, args) => {
    const delivery = await ctx.runQuery(
      internal.notificationActions.getDelivery,
      { deliveryId: args.deliveryId }
    );

    if (!delivery || delivery.status === "sent") {
      return;
    }

    await ctx.runMutation(internal.notificationActions.markSending, {
      deliveryId: args.deliveryId,
    });

    const payload = JSON.parse(delivery.payload) as Record<string, unknown>;

    if (payload.applicantName && typeof payload.applicantName === "string") {
      try {
        const userResult = await ctx.runAction(internal.feishuActions.getUser, { userId: payload.applicantName });
        if (userResult && userResult.name) {
          payload.applicantName = userResult.name;
        }
      } catch (error) {
        console.error("Failed to get user details for applicantName lookup", error);
      }
    }

    try {
      const card = buildNotificationCard(delivery.messageType, payload);

      await ctx.runAction(internal.feishuActions.sendCardMessage, {
        card: JSON.stringify(card),
        chatId: delivery.recipientId,
      });

      await ctx.runMutation(internal.notificationActions.markSent, {
        deliveryId: args.deliveryId,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (delivery.retryCount < MAX_NOTIFICATION_RETRY_COUNT) {
        const delay = getNotificationRetryDelayMs(delivery.retryCount);

        await ctx.runMutation(internal.notificationActions.markRetrying, {
          deliveryId: args.deliveryId,
          lastError: errorMessage,
          nextAttemptAt: Date.now() + delay,
        });

        await ctx.scheduler.runAfter(
          delay,
          internal.notificationActions.processDelivery,
          { deliveryId: args.deliveryId }
        );
      } else {
        await ctx.runMutation(internal.notificationActions.markFailed, {
          deliveryId: args.deliveryId,
          lastError: errorMessage,
        });
      }
    }
  },
});

// ── Internal queries/mutations for delivery lifecycle ────────────────────

export const getDelivery = internalQuery({
  args: { deliveryId: v.id("notificationDeliveries") },
  handler: (ctx, args) => ctx.db.get(args.deliveryId),
});

export const markSent = internalMutation({
  args: { deliveryId: v.id("notificationDeliveries") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.deliveryId, { status: "sent" });
  },
});

export const markSending = internalMutation({
  args: { deliveryId: v.id("notificationDeliveries") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.deliveryId, { status: "sending" });
  },
});

export const markRetrying = internalMutation({
  args: {
    deliveryId: v.id("notificationDeliveries"),
    lastError: v.string(),
    nextAttemptAt: v.number(),
  },
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.deliveryId);
    if (!delivery) {
      return;
    }

    await ctx.db.patch(args.deliveryId, {
      lastError: args.lastError,
      nextAttemptAt: args.nextAttemptAt,
      retryCount: delivery.retryCount + 1,
      status: "retrying",
    });
  },
});

export const markFailed = internalMutation({
  args: {
    deliveryId: v.id("notificationDeliveries"),
    lastError: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.deliveryId, {
      lastError: args.lastError,
      status: "failed",
    });
  },
});
