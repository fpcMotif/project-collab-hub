import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";

const normalizeMentionedUserIds = (mentionedUserIds: string[] | undefined) => {
  if (!mentionedUserIds || mentionedUserIds.length === 0) {
    return [] as string[];
  }
  return [...new Set(mentionedUserIds)];
};

const resolveMentionChannel = async (
  ctx: any,
  projectId: string,
  _recipientId: string,
) => {
  const chatBinding = await ctx.db
    .query("chatBindings")
    .withIndex("by_project", (q: any) => q.eq("projectId", projectId))
    .first();

  // TODO: Replace with real chat-membership check when membership data is available.
  if (chatBinding) {
    return "group_chat" as const;
  }

  return "private_chat" as const;
};

const createMentionDelivery = async (
  ctx: any,
  {
    commentId,
    projectId,
    authorId,
    recipientId,
  }: {
    commentId: string;
    projectId: string;
    authorId: string;
    recipientId: string;
  },
) => {
  const existingMention = await ctx.db
    .query("mentions")
    .withIndex("by_comment_and_user", (q: any) =>
      q.eq("commentId", commentId).eq("mentionedUserId", recipientId),
    )
    .first();

  if (existingMention?.notificationSent) {
    return;
  }

  const existingDelivery = await ctx.db
    .query("notificationDeliveries")
    .withIndex("by_comment_recipient_type", (q: any) =>
      q
        .eq("commentId", commentId)
        .eq("recipientId", recipientId)
        .eq("messageType", "mention"),
    )
    .first();

  if (existingDelivery) {
    if (existingMention && !existingMention.notificationDeliveryId) {
      await ctx.db.patch(existingMention._id, {
        notificationDeliveryId: existingDelivery._id,
      });
    }
    return;
  }

  const channel = await resolveMentionChannel(ctx, projectId, recipientId);
  const deliveryId = await ctx.db.insert("notificationDeliveries", {
    commentId,
    projectId,
    recipientId,
    channel,
    messageType: "mention",
    payload: JSON.stringify({
      type: "comment_mention",
      commentId,
      projectId,
      mentionedByUserId: authorId,
      recipientId,
    }),
    status: "pending",
    retryCount: 0,
  });

  if (existingMention) {
    await ctx.db.patch(existingMention._id, {
      notificationDeliveryId: deliveryId,
      notificationSent: true,
    });
    return;
  }

  await ctx.db.insert("mentions", {
    commentId,
    projectId,
    mentionedUserId: recipientId,
    mentionedByUserId: authorId,
    notificationSent: true,
    notificationDeliveryId: deliveryId,
  });
};

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

    const uniqueUserIds = normalizeMentionedUserIds(mentionedUserIds);
    for (const userId of uniqueUserIds) {
      await ctx.runMutation(internal.comments.upsertMentionDelivery, {
        commentId,
        projectId: args.projectId,
        authorId: args.authorId,
        recipientId: userId,
      });
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
    const existingMentionUserIds = new Set(
      existingMentions.map((mention) => mention.mentionedUserId),
    );
    const nextMentionUserIds = new Set(
      normalizeMentionedUserIds(args.mentionedUserIds),
    );

    const addedMentionUserIds = [...nextMentionUserIds].filter(
      (userId) => !existingMentionUserIds.has(userId),
    );

    await ctx.db.patch(args.id, {
      body: args.body,
      editedAt: Date.now(),
    });

    for (const userId of addedMentionUserIds) {
      await ctx.runMutation(internal.comments.upsertMentionDelivery, {
        commentId: args.id,
        projectId: comment.projectId,
        authorId: args.actorId,
        recipientId: userId,
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

    return args.id;
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

export const upsertMentionDelivery = internalMutation({
  args: {
    commentId: v.id("comments"),
    projectId: v.id("projects"),
    authorId: v.string(),
    recipientId: v.string(),
  },
  handler: async (ctx, args) => {
    await createMentionDelivery(ctx, {
      commentId: args.commentId,
      projectId: args.projectId,
      authorId: args.authorId,
      recipientId: args.recipientId,
    });
  },
});
