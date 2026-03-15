import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
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
    const { mentionedUserIds, ...commentArgs } = args;

    const commentId = await ctx.db.insert("comments", {
      ...commentArgs,
      isDeleted: false,
    });

    if (mentionedUserIds && mentionedUserIds.length > 0) {
      const uniqueUserIds = [...new Set(mentionedUserIds)];
      for (const userId of uniqueUserIds) {
        const notificationDeliveryId = await ctx.db.insert("notificationDeliveries", {
          projectId: args.projectId,
          recipientId: userId,
          channel: "private_chat",
          messageType: "mention",
          status: "pending",
          retryCount: 0,
          payload: JSON.stringify({
            commentId,
            authorId: args.authorId,
            commentPreview: args.body.slice(0, 120),
            targetScope: args.targetScope,
          }),
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
