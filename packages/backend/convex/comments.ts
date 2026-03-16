import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const COMMENT_SUMMARY_MAX_LENGTH = 120;

const extractCommentSummary = (body: string) => {
  const normalized = body.replace(/\s+/g, " ").trim();
  if (normalized.length <= COMMENT_SUMMARY_MAX_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, COMMENT_SUMMARY_MAX_LENGTH)}...`;
};

const buildCommentDeepLink = (projectId: string, commentId: string) =>
  `/projects/${projectId}?commentId=${commentId}`;

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

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error(`Project ${args.projectId} not found`);
    }

    if (mentionedUserIds && mentionedUserIds.length > 0) {
      const uniqueUserIds = [...new Set(mentionedUserIds)];
      for (const userId of uniqueUserIds) {
        const deliveryId = await ctx.db.insert("notificationDeliveries", {
          projectId: args.projectId,
          recipientId: userId,
          channel: "private_chat",
          messageType: "mention",
          status: "pending",
          retryCount: 0,
          payload: JSON.stringify({
            projectName: project.name,
            commentSummary: extractCommentSummary(args.body),
            commenterId: args.authorId,
            deepLink: buildCommentDeepLink(args.projectId, commentId),
            commentId,
          }),
        });

        await ctx.db.insert("mentions", {
          commentId,
          projectId: args.projectId,
          mentionedUserId: userId,
          mentionedByUserId: args.authorId,
          notificationSent: false,
          notificationDeliveryId: deliveryId,
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

export const edit = mutation({
  args: {
    id: v.id("comments"),
    editorId: v.string(),
    body: v.string(),
    mentionedUserIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const comment = await ctx.db.get(args.id);
    if (!comment) {
      throw new Error(`Comment ${args.id} not found`);
    }

    const project = await ctx.db.get(comment.projectId);
    if (!project) {
      throw new Error(`Project ${comment.projectId} not found`);
    }

    await ctx.db.patch(args.id, {
      body: args.body,
      editedAt: Date.now(),
    });

    const existingMentions = await ctx.db
      .query("mentions")
      .withIndex("by_comment", (q) => q.eq("commentId", args.id))
      .collect();

    const existingMentionUserIds = new Set(
      existingMentions.map((mention) => mention.mentionedUserId),
    );
    const nextMentionUserIds = new Set(args.mentionedUserIds ?? []);

    const addedMentionUserIds = [...nextMentionUserIds].filter(
      (userId) => !existingMentionUserIds.has(userId),
    );

    for (const userId of addedMentionUserIds) {
      const deliveryId = await ctx.db.insert("notificationDeliveries", {
        projectId: comment.projectId,
        recipientId: userId,
        channel: "private_chat",
        messageType: "mention",
        status: "pending",
        retryCount: 0,
        payload: JSON.stringify({
          projectName: project.name,
          commentSummary: extractCommentSummary(args.body),
          commenterId: comment.authorId,
          deepLink: buildCommentDeepLink(comment.projectId, args.id),
          commentId: args.id,
        }),
      });

      await ctx.db.insert("mentions", {
        commentId: args.id,
        projectId: comment.projectId,
        mentionedUserId: userId,
        mentionedByUserId: args.editorId,
        notificationSent: false,
        notificationDeliveryId: deliveryId,
      });
    }

    await ctx.db.insert("auditEvents", {
      projectId: comment.projectId,
      actorId: args.editorId,
      action: "comment.edited",
      objectType: "comment",
      objectId: args.id,
      changeSummary: `Comment edited on ${comment.targetScope}`,
    });
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
