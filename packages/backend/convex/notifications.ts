import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { canReadProject } from "./authz";
import { insertAuditEvent, withAuditSource } from "./auditEvents";

const roleValidator = v.optional(
  v.union(
    v.literal("admin"),
    v.literal("project_manager"),
    v.literal("editor"),
    v.literal("member"),
    v.literal("viewer"),
    v.literal("guest"),
  ),
);

export const listPending = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("notificationDeliveries")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
  },
});

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    recipientId: v.string(),
    recipientDepartmentId: v.optional(v.string()),
    recipientRole: roleValidator,
    senderId: v.optional(v.string()),
    channel: v.union(
      v.literal("group_chat"),
      v.literal("private_chat"),
      v.literal("batch_message"),
    ),
    messageType: v.union(
      v.literal("mention"),
      v.literal("approval_result"),
      v.literal("task_update"),
      v.literal("stage_change"),
      v.literal("risk_alert"),
    ),
    payload: v.string(),
    sourceEntry: v.optional(v.string()),
    sourceIp: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error(`Project ${args.projectId} not found`);
    }

    const hasAccess = canReadProject(project, {
      projectId: args.projectId,
      actorId: args.recipientId,
      actorDepartmentId: args.recipientDepartmentId,
      actorRole: args.recipientRole,
    });

    const payload =
      args.messageType === "mention" && !hasAccess
        ? "你被@提及，但当前无项目权限。请申请访问后查看详情。"
        : args.payload;

    if (args.messageType === "mention" && !hasAccess) {
      await insertAuditEvent(ctx, {
        projectId: args.projectId,
        actorId: args.senderId ?? "system",
        action: "notification.payload_clipped",
        objectType: "notification",
        objectId: args.recipientId,
        changeSummary: `Mention payload clipped for ${args.recipientId} due to missing permission`,
        ...withAuditSource(args),
      });
    }

    const { recipientDepartmentId, recipientRole, senderId, sourceEntry, sourceIp, ...deliveryArgs } =
      args;

    return ctx.db.insert("notificationDeliveries", {
      ...deliveryArgs,
      payload,
      status: "pending",
      retryCount: 0,
    });
  },
});

export const markSent = internalMutation({
  args: {
    id: v.id("notificationDeliveries"),
    feishuMessageId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "sent",
      feishuMessageId: args.feishuMessageId,
    });
  },
});

export const markFailed = internalMutation({
  args: {
    id: v.id("notificationDeliveries"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.id);
    if (!delivery) return;

    const newRetryCount = delivery.retryCount + 1;
    await ctx.db.patch(args.id, {
      status: newRetryCount >= 3 ? "failed" : "retrying",
      retryCount: newRetryCount,
      lastError: args.error,
    });
  },
});
