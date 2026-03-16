import { v } from "convex/values";

import { query, mutation } from "./_generated/server";

export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) =>
    ctx.db
      .query("comments")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect(),
});

export const create = mutation({
  args: {
    authorId: v.string(),
    body: v.string(),
    departmentTrackId: v.optional(v.id("departmentTracks")),
    mentionedUserIds: v.optional(v.array(v.string())),
    parentCommentId: v.optional(v.id("comments")),
    projectId: v.id("projects"),
    targetScope: v.union(
      v.literal("project"),
      v.literal("department"),
      v.literal("work_item")
    ),
    workItemId: v.optional(v.id("workItems")),
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
        const notificationDeliveryId = await ctx.db.insert(
          "notificationDeliveries",
          {
            channel: "private_chat",
            messageType: "mention",
            payload: JSON.stringify({
              authorId: args.authorId,
              commentId,
              commentPreview: args.body.slice(0, 120),
              targetScope: args.targetScope,
            }),
            projectId: args.projectId,
            recipientId: userId,
            retryCount: 0,
            status: "pending",
          }
        );

        await ctx.db.insert("mentions", {
          commentId,
          mentionedByUserId: args.authorId,
          mentionedUserId: userId,
          notificationDeliveryId,
          notificationSent: false,
          projectId: args.projectId,
        });
      }
    }

    await ctx.db.insert("auditEvents", {
      action: "comment.created",
      actorId: args.authorId,
      changeSummary: `Comment added on ${args.targetScope}`,
      objectId: commentId,
      objectType: "comment",
      projectId: args.projectId,
    });

    return commentId;
  },
});

export const softDelete = mutation({
  args: {
    actorId: v.string(),
    id: v.id("comments"),
  },
  handler: async (ctx, args) => {
    const comment = await ctx.db.get(args.id);
    if (!comment) {
      throw new Error(`Comment ${args.id} not found`);
    }

    await ctx.db.patch(args.id, {
      deletedAt: Date.now(),
      isDeleted: true,
    });

    await ctx.db.insert("auditEvents", {
      action: "comment.deleted",
      actorId: args.actorId,
      changeSummary: "Comment soft-deleted",
      objectId: args.id,
      objectType: "comment",
      projectId: comment.projectId,
    });
  },
});
