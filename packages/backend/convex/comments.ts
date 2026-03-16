import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertProjectPermission, canAccessProject } from "./authz";

export const listByProject = query({
  args: { projectId: v.id("projects"), actorId: v.string() },
  handler: async (ctx, args) => {
    await assertProjectPermission(ctx, {
      userId: args.actorId,
      projectId: args.projectId,
      action: "comment:read",
      objectType: "comment",
      objectId: `project:${args.projectId}`,
    });

    return ctx.db
      .query("comments")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    departmentTrackId: v.optional(v.id("departmentTracks")),
    workItemId: v.optional(v.id("workItems")),
    parentCommentId: v.optional(v.id("comments")),
    authorId: v.string(),
    body: v.string(),
    targetScope: v.union(
      v.literal("project"),
      v.literal("department"),
      v.literal("work_item"),
    ),
    mentionedUserIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await assertProjectPermission(ctx, {
      userId: args.authorId,
      projectId: args.projectId,
      action: "comment:write",
      objectType: "comment",
      objectId: `project:${args.projectId}`,
    });

    const { mentionedUserIds, ...commentArgs } = args;

    const commentId = await ctx.db.insert("comments", {
      ...commentArgs,
      isDeleted: false,
    });

    if (mentionedUserIds && mentionedUserIds.length > 0) {
      const uniqueUserIds = [...new Set(mentionedUserIds)];
      for (const userId of uniqueUserIds) {
        const canRead = await canAccessProject(ctx, userId, args.projectId, "comment:read");

        const mentionPreview = canRead
          ? args.body
          : "你被@了，但当前无权限查看完整内容。请联系项目管理员申请访问权限。";

        const payload = JSON.stringify({
          commentId,
          projectId: args.projectId,
          preview: mentionPreview,
          restricted: !canRead,
        });

        const notificationDeliveryId = await ctx.db.insert("notificationDeliveries", {
          projectId: args.projectId,
          recipientId: userId,
          channel: "private_chat",
          messageType: "mention",
          status: "pending",
          retryCount: 0,
          payload,
        });

        await ctx.db.insert("mentions", {
          commentId,
          projectId: args.projectId,
          mentionedUserId: userId,
          mentionedByUserId: args.authorId,
          notificationSent: false,
          notificationDeliveryId,
        });
      }
    }

    await ctx.db.insert("auditEvents", {
      projectId: args.projectId,
      actorId: args.authorId,
      action: "comment.created",
      objectType: "comment",
      objectId: commentId,
      changeSummary: `Comment added on ${args.targetScope}`,
    });

    return commentId;
  },
});

export const softDelete = mutation({
  args: {
    id: v.id("comments"),
    actorId: v.string(),
  },
  handler: async (ctx, args) => {
    const comment = await ctx.db.get(args.id);
    if (!comment) {
      throw new Error(`Comment ${args.id} not found`);
    }

    await assertProjectPermission(ctx, {
      userId: args.actorId,
      projectId: comment.projectId,
      action: "comment:write",
      objectType: "comment",
      objectId: args.id,
    });

    await ctx.db.patch(args.id, {
      isDeleted: true,
      deletedAt: Date.now(),
    });

    await ctx.db.insert("auditEvents", {
      projectId: comment.projectId,
      actorId: args.actorId,
      action: "comment.deleted",
      objectType: "comment",
      objectId: args.id,
      changeSummary: "Comment soft-deleted",
    });
  },
});
