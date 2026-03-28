import {
  FeishuApprovalService,
  FeishuChatService,
  FeishuLive,
  FeishuMessageService,
  FeishuTaskService,
} from "@collab-hub/feishu-integration";
import type {
  CreateApprovalInstanceParams,
  CreateChatParams,
  CreateFeishuTaskParams,
  SendCardMessageParams,
  SendTextMessageParams,
  FeishuBaseService,
  FeishuWorkflowService,
} from "@collab-hub/feishu-integration";
import { v } from "convex/values";
import { Effect } from "effect";

import { internal } from "./_generated/api";
import { internalAction, internalMutation } from "./_generated/server";

const buildFeishuLayer = () => {
  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error(
      "Missing FEISHU_APP_ID or FEISHU_APP_SECRET environment variables"
    );
  }

  return FeishuLive({ appId, appSecret });
};

const runFeishuEffect = <A>(
  effect: Effect.Effect<
    A,
    unknown,
    | FeishuApprovalService
    | FeishuBaseService
    | FeishuChatService
    | FeishuMessageService
    | FeishuTaskService
    | FeishuWorkflowService
  >
): Promise<A> => Effect.runPromise(Effect.provide(effect, buildFeishuLayer()));

// ── Approval Actions ─────────────────────────────────────────────────────

export const submitApproval = internalAction({
  args: {
    applicantId: v.string(),
    approvalCode: v.string(),
    formData: v.string(),
    gateId: v.id("approvalGates"),
  },
  handler: async (ctx, args) => {
    const params: CreateApprovalInstanceParams = {
      applicantId: args.applicantId,
      approvalCode: args.approvalCode,
      formData: args.formData,
    };

    const result = await runFeishuEffect(
      FeishuApprovalService.pipe(
        Effect.flatMap((svc) => svc.createInstance(params))
      )
    );

    await ctx.runMutation(internal.feishuActions.patchApprovalInstanceCode, {
      gateId: args.gateId,
      instanceCode: result.instanceCode,
    });

    return result.instanceCode;
  },
});

export const getApprovalInstance = internalAction({
  args: { instanceCode: v.string() },
  handler: (_ctx, args) =>
    runFeishuEffect(
      FeishuApprovalService.pipe(
        Effect.flatMap((svc) => svc.getInstance(args.instanceCode))
      )
    ),
});

// ── Message Actions ──────────────────────────────────────────────────────

export const sendTextMessage = internalAction({
  args: {
    chatId: v.string(),
    deliveryId: v.optional(v.id("notificationDeliveries")),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const params: SendTextMessageParams = {
      chatId: args.chatId,
      text: args.text,
    };

    try {
      await runFeishuEffect(
        FeishuMessageService.pipe(Effect.flatMap((svc) => svc.sendText(params)))
      );

      if (args.deliveryId) {
        await ctx.runMutation(internal.feishuActions.patchDeliveryStatus, {
          deliveryId: args.deliveryId,
          status: "sent",
        });
      }
    } catch (error) {
      if (args.deliveryId) {
        await ctx.runMutation(internal.feishuActions.patchDeliveryStatus, {
          deliveryId: args.deliveryId,
          lastError: error instanceof Error ? error.message : String(error),
          status: "failed",
        });
      }
      throw error;
    }
  },
});

export const sendCardMessage = internalAction({
  args: {
    card: v.string(),
    chatId: v.string(),
    deliveryId: v.optional(v.id("notificationDeliveries")),
  },
  handler: async (ctx, args) => {
    const params: SendCardMessageParams = {
      card: JSON.parse(args.card) as Record<string, unknown>,
      chatId: args.chatId,
    };

    try {
      await runFeishuEffect(
        FeishuMessageService.pipe(Effect.flatMap((svc) => svc.sendCard(params)))
      );

      if (args.deliveryId) {
        await ctx.runMutation(internal.feishuActions.patchDeliveryStatus, {
          deliveryId: args.deliveryId,
          status: "sent",
        });
      }
    } catch (error) {
      if (args.deliveryId) {
        await ctx.runMutation(internal.feishuActions.patchDeliveryStatus, {
          deliveryId: args.deliveryId,
          lastError: error instanceof Error ? error.message : String(error),
          status: "failed",
        });
      }
      throw error;
    }
  },
});

// ── Chat Actions ─────────────────────────────────────────────────────────

export const createProjectChat = internalAction({
  args: {
    description: v.string(),
    name: v.string(),
    ownerOpenId: v.string(),
    projectId: v.id("projects"),
    userOpenIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const params: CreateChatParams = {
      description: args.description,
      name: args.name,
      ownerOpenId: args.ownerOpenId,
      userOpenIds: args.userOpenIds,
    };

    const result = await runFeishuEffect(
      FeishuChatService.pipe(Effect.flatMap((svc) => svc.createChat(params)))
    );

    await ctx.runMutation(internal.feishuActions.insertChatBinding, {
      chatType: "auto_created",
      feishuChatId: result.chatId,
      projectId: args.projectId,
    });

    return result.chatId;
  },
});

export const pinMessageInChat = internalAction({
  args: { messageId: v.string() },
  handler: async (_ctx, args) => {
    await runFeishuEffect(
      FeishuChatService.pipe(
        Effect.flatMap((svc) => svc.pinMessage(args.messageId))
      )
    );
  },
});

// ── Task Actions ─────────────────────────────────────────────────────────

export const createFeishuTask = internalAction({
  args: {
    description: v.string(),
    dueTimestamp: v.string(),
    memberIds: v.array(v.string()),
    originHref: v.string(),
    originTitle: v.string(),
    projectId: v.id("projects"),
    summary: v.string(),
    workItemId: v.id("workItems"),
  },
  handler: async (ctx, args) => {
    const params: CreateFeishuTaskParams = {
      description: args.description,
      dueTimestamp: args.dueTimestamp,
      memberIds: args.memberIds,
      originHref: args.originHref,
      originTitle: args.originTitle,
      summary: args.summary,
    };

    const result = await runFeishuEffect(
      FeishuTaskService.pipe(Effect.flatMap((svc) => svc.createTask(params)))
    );

    await ctx.runMutation(internal.feishuActions.insertTaskBinding, {
      feishuTaskGuid: result.taskGuid,
      projectId: args.projectId,
      workItemId: args.workItemId,
    });

    return result.taskGuid;
  },
});

export const completeFeishuTask = internalAction({
  args: { taskGuid: v.string() },
  handler: async (_ctx, args) => {
    await runFeishuEffect(
      FeishuTaskService.pipe(
        Effect.flatMap((svc) => svc.completeTask(args.taskGuid))
      )
    );
  },
});

// ── Internal Mutations (called by actions above) ─────────────────────────

export const patchApprovalInstanceCode = internalMutation({
  args: {
    gateId: v.id("approvalGates"),
    instanceCode: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.gateId, { instanceCode: args.instanceCode });
  },
});

export const patchDeliveryStatus = internalMutation({
  args: {
    deliveryId: v.id("notificationDeliveries"),
    lastError: v.optional(v.string()),
    status: v.union(v.literal("sent"), v.literal("failed")),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = { status: args.status };
    if (args.lastError) {
      patch.lastError = args.lastError;
    }
    await ctx.db.patch(args.deliveryId, patch);
  },
});

export const insertChatBinding = internalMutation({
  args: {
    chatType: v.union(v.literal("auto_created"), v.literal("manual_bound")),
    feishuChatId: v.string(),
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("chatBindings", {
      botAddedAt: Date.now(),
      chatType: args.chatType,
      feishuChatId: args.feishuChatId,
      projectId: args.projectId,
    });
  },
});

export const insertTaskBinding = internalMutation({
  args: {
    feishuTaskGuid: v.string(),
    projectId: v.id("projects"),
    workItemId: v.id("workItems"),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("feishuTaskBindings", {
      feishuTaskGuid: args.feishuTaskGuid,
      feishuTaskStatus: "created",
      lastSyncedAt: Date.now(),
      projectId: args.projectId,
      syncDirection: "app_created",
      workItemId: args.workItemId,
    });
  },
});
