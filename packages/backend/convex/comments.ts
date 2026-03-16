import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { insertAuditEvent, withAuditSource } from "./auditEvents";
import { canReadProject, requireProjectAccess } from "./authz";

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

export const listByProject = query({
  args: {
    projectId: v.id("projects"),
    actorId: v.string(),
    actorDepartmentId: v.optional(v.string()),
    actorRole: roleValidator,
    sourceEntry: v.optional(v.string()),
    sourceIp: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error(`Project ${args.projectId} not found`);
    }

    const comments = await ctx.db
      .query("comments")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const canRead = canReadProject(project, {
      projectId: args.projectId,
      actorId: args.actorId,
      actorDepartmentId: args.actorDepartmentId,
      actorRole: args.actorRole,
    });

    if (canRead) {
      return comments;
    }

    await insertAuditEvent(ctx, {
      projectId: args.projectId,
      actorId: args.actorId,
      action: "authz.denied",
      objectType: "comment",
      objectId: `project:${args.projectId}`,
      changeSummary: "Denied comment body visibility for project",
      ...withAuditSource(args),
    });

    return comments.map((comment) => ({
      ...comment,
      body: "[REDACTED: no project permission]",
    }));
  },
});

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    departmentTrackId: v.optional(v.id("departmentTracks")),
    workItemId: v.optional(v.id("workItems")),
    parentCommentId: v.optional(v.id("comments")),
    authorId: v.string(),
    authorDepartmentId: v.optional(v.string()),
    authorRole: roleValidator,
    body: v.string(),
    targetScope: v.union(
      v.literal("project"),
      v.literal("department"),
      v.literal("work_item"),
    ),
    mentionedUserIds: v.optional(v.array(v.string())),
    sourceEntry: v.optional(v.string()),
    sourceIp: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireProjectAccess(
      ctx,
      {
        projectId: args.projectId,
        actorId: args.authorId,
        actorDepartmentId: args.authorDepartmentId,
        actorRole: args.authorRole,
        sourceEntry: args.sourceEntry,
        sourceIp: args.sourceIp,
      },
      "write",
      "comment.create",
    );

    const { mentionedUserIds, authorDepartmentId, authorRole, sourceEntry, sourceIp, ...commentArgs } =
      args;

    const commentId = await ctx.db.insert("comments", {
      ...commentArgs,
      isDeleted: false,
    });

    if (mentionedUserIds && mentionedUserIds.length > 0) {
      const uniqueUserIds = [...new Set(mentionedUserIds)];
      for (const userId of uniqueUserIds) {
        await ctx.db.insert("mentions", {
          commentId,
          projectId: args.projectId,
          mentionedUserId: userId,
          mentionedByUserId: args.authorId,
          notificationSent: false,
        });
      }
    }

    await insertAuditEvent(ctx, {
      projectId: args.projectId,
      actorId: args.authorId,
      action: "comment.created",
      objectType: "comment",
      objectId: commentId,
      changeSummary: `Comment added on ${args.targetScope}`,
      ...withAuditSource(args),
    });

    return commentId;
  },
});

export const softDelete = mutation({
  args: {
    id: v.id("comments"),
    actorId: v.string(),
    actorDepartmentId: v.optional(v.string()),
    actorRole: roleValidator,
    sourceEntry: v.optional(v.string()),
    sourceIp: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const comment = await ctx.db.get(args.id);
    if (!comment) {
      throw new Error(`Comment ${args.id} not found`);
    }

    await requireProjectAccess(
      ctx,
      {
        projectId: comment.projectId,
        actorId: args.actorId,
        actorDepartmentId: args.actorDepartmentId,
        actorRole: args.actorRole,
        sourceEntry: args.sourceEntry,
        sourceIp: args.sourceIp,
      },
      "write",
      "comment.softDelete",
    );

    await ctx.db.patch(args.id, {
      isDeleted: true,
      deletedAt: Date.now(),
    });

    await insertAuditEvent(ctx, {
      projectId: comment.projectId,
      actorId: args.actorId,
      action: "comment.deleted",
      objectType: "comment",
      objectId: args.id,
      changeSummary: "Comment soft-deleted",
      ...withAuditSource(args),
    });
  },
});
