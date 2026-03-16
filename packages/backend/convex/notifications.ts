import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { canAccessProject } from "./authz";

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
  },
  handler: async (ctx, args) => {
    let payload = args.payload;

    if (args.messageType === "mention") {
      const canReadProject = await canAccessProject(
        ctx,
        args.recipientId,
        args.projectId,
        "comment:read",
      );

      if (!canReadProject) {
        payload = JSON.stringify({
          restricted: true,
          preview: "你被@了，但当前无权限查看完整内容。请联系项目管理员申请访问权限。",
        });
      }
    }

    return ctx.db.insert("notificationDeliveries", {
      ...args,
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
