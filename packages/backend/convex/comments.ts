import { query, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
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

const COMMENT_SNIPPET_MAX_LENGTH = 140;

function dedupeUserIds(userIds: string[] | undefined) {
  if (!userIds) {
    return [];
  }

  return [...new Set(userIds)];
}

function buildCommentSummary(body: string) {
  const normalized = body.replace(/\s+/g, " ").trim();
  if (normalized.length <= COMMENT_SNIPPET_MAX_LENGTH) {
    return normalized;
  }
  return `${normalized.slice(0, COMMENT_SNIPPET_MAX_LENGTH - 1)}…`;
}

async function enqueueMentionNotificationDeliveries(
  ctx: any,
  params: {
    projectId: any;
    projectName: string;
    commentId: any;
    commentBody: string;
    authorId: string;
    mentionedUserIds: string[];
  },
) {
  for (const userId of params.mentionedUserIds) {
    const payload = JSON.stringify({
      projectName: params.projectName,
      commentSummary: buildCommentSummary(params.commentBody),
      commentAuthorId: params.authorId,
      projectId: params.projectId,
      commentId: params.commentId,
      deepLink: `/projects/${params.projectId}#comment-${params.commentId}`,
    });

    const deliveryId = await ctx.db.insert("notificationDeliveries", {
      projectId: params.projectId,
      recipientId: userId,
      channel: "private_chat",
      messageType: "mention",
      status: "pending",
      retryCount: 0,
      payload,
    });

    await ctx.db.insert("mentions", {
      commentId: params.commentId,
      projectId: params.projectId,
      mentionedUserId: userId,
      mentionedByUserId: params.authorId,
      notificationSent: false,
      notificationDeliveryId: deliveryId,
    });
  }

  if (params.mentionedUserIds.length > 0) {
    await ctx.scheduler.runAfter(0, internal.notifications.processPending, {});
  }
}

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

    await enqueueMentionNotificationDeliveries(ctx, {
      projectId: args.projectId,
      projectName: project.name,
      commentId,
      commentBody: args.body,
      authorId: args.authorId,
      mentionedUserIds: dedupeUserIds(mentionedUserIds),
    });

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

export const update = mutation({
  args: {
    id: v.id("comments"),
    actorId: v.string(),
    body: v.string(),
    mentionedUserIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const comment = await ctx.db.get(args.id);
    if (!comment) {
      throw new Error(`Comment ${args.id} not found`);
    }

    const existingMentions = await ctx.db
      .query("mentions")
      .withIndex("by_comment", (q) => q.eq("commentId", args.id))
      .collect();

    const existingMentionedUserIds = new Set(
      existingMentions.map((mention) => mention.mentionedUserId),
    );
    const dedupedMentionedUserIds = dedupeUserIds(args.mentionedUserIds);
    const newMentionedUserIds = dedupedMentionedUserIds.filter(
      (userId) => !existingMentionedUserIds.has(userId),
    );

    await ctx.db.patch(args.id, {
      body: args.body,
      editedAt: Date.now(),
    });

    if (newMentionedUserIds.length > 0) {
      const project = await ctx.db.get(comment.projectId);
      if (!project) {
        throw new Error(`Project ${comment.projectId} not found`);
      }

      await enqueueMentionNotificationDeliveries(ctx, {
        projectId: comment.projectId,
        projectName: project.name,
        commentId: args.id,
        commentBody: args.body,
        authorId: args.actorId,
        mentionedUserIds: newMentionedUserIds,
      });
    }

    await ctx.db.insert("auditEvents", {
      projectId: comment.projectId,
      actorId: args.actorId,
      action: "comment.updated",
      objectType: "comment",
      objectId: args.id,
      changeSummary: "Comment edited",
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
