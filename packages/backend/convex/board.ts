import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";

const projectStatus = v.union(
  v.literal("new"),
  v.literal("assessment"),
  v.literal("solution"),
  v.literal("ready"),
  v.literal("executing"),
  v.literal("delivering"),
  v.literal("done"),
  v.literal("cancelled")
);

const FORWARD_FLOW = [
  "new",
  "assessment",
  "solution",
  "ready",
  "executing",
  "delivering",
  "done",
] as const;

const STAGE_TRANSITIONS: Record<string, readonly string[]> = {
  assessment: ["solution", "cancelled"],
  cancelled: [],
  delivering: ["done", "executing", "cancelled"],
  done: [],
  executing: ["delivering", "cancelled"],
  new: ["assessment", "cancelled"],
  ready: ["executing", "solution", "cancelled"],
  solution: ["ready", "assessment", "cancelled"],
} as const;

const BLOCKING_TRACK_STATUSES = new Set(["blocked", "waiting_approval"]);

const requireAuthenticatedIdentity = async (ctx: QueryCtx | MutationCtx) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Authentication required");
  }
  return identity;
};

const isForwardTransition = (currentStatus: string, targetStatus: string) => {
  const currentIndex = FORWARD_FLOW.indexOf(
    currentStatus as (typeof FORWARD_FLOW)[number]
  );
  const targetIndex = FORWARD_FLOW.indexOf(
    targetStatus as (typeof FORWARD_FLOW)[number]
  );

  return (
    currentIndex !== -1 && targetIndex !== -1 && targetIndex > currentIndex
  );
};

const canTransitionProject = (
  currentStatus: string,
  targetStatus: string,
  requiredTrackStatuses: readonly string[],
  pendingRequiredApprovalCount: number
) => {
  const allowedTargets = STAGE_TRANSITIONS[currentStatus];
  if (!allowedTargets || !allowedTargets.includes(targetStatus)) {
    return {
      allowed: false,
      reason: `Transition from "${currentStatus}" to "${targetStatus}" is not permitted`,
    } as const;
  }

  if (!isForwardTransition(currentStatus, targetStatus)) {
    return { allowed: true } as const;
  }

  const blockingTracks = requiredTrackStatuses.filter((status) =>
    BLOCKING_TRACK_STATUSES.has(status)
  );
  if (blockingTracks.length > 0) {
    return {
      allowed: false,
      reason: `${blockingTracks.length} required department(s) are blocked or waiting approval`,
    } as const;
  }

  if (pendingRequiredApprovalCount > 0) {
    return {
      allowed: false,
      reason: `${pendingRequiredApprovalCount} required approval(s) are still pending`,
    } as const;
  }

  const incompleteTracks = requiredTrackStatuses.filter(
    (status) => status !== "done"
  );
  if (incompleteTracks.length > 0) {
    return {
      allowed: false,
      reason: `${incompleteTracks.length} required department(s) are not complete`,
    } as const;
  }

  return { allowed: true } as const;
};

const deriveSlaRisk = (
  slaDeadline: number | undefined,
  overdueTaskCount: number
) => {
  if (overdueTaskCount > 0) {
    return "overdue" as const;
  }

  if (!slaDeadline) {
    return "on_time" as const;
  }

  const riskThresholdMs = 1000 * 60 * 60 * 24 * 3;
  return slaDeadline <= Date.now() + riskThresholdMs ? "at_risk" : "on_time";
};

const buildBoardProjectRecord = async (
  ctx: QueryCtx,
  project: Doc<"projects">
) => {
  const [departmentTracks, workItems, approvalGates, template] =
    await Promise.all([
      ctx.db
        .query("departmentTracks")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect(),
      ctx.db
        .query("workItems")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect(),
      ctx.db
        .query("approvalGates")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect(),
      project.templateId
        ? ctx.db.get(project.templateId as unknown as Id<"projectTemplates">)
        : Promise.resolve(null),
    ] as const);

  const overdueTaskCount = workItems.filter(
    (item) =>
      item.status !== "done" &&
      item.dueDate !== undefined &&
      item.dueDate < Date.now()
  ).length;

  return {
    customerName: project.customerName ?? "未填写客户",
    departmentTracks: departmentTracks.map((track) => ({
      blockReason: track.blockReason,
      departmentName: track.departmentName,
      status: track.isRequired ? track.status : "not_required",
    })),
    id: project._id,
    name: project.name,
    overdueTaskCount,
    ownerName: project.ownerId,
    pendingApprovalCount: approvalGates.filter(
      (gate) => gate.status === "pending"
    ).length,
    priority: project.priority ?? "medium",
    slaRisk: deriveSlaRisk(project.slaDeadline, overdueTaskCount),
    status: project.status,
    templateType: (template as Doc<"projectTemplates">)?.name ?? "默认模板",
  };
};

export const listBoardProjects = query({
  args: {},
  handler: async (ctx) => {
    await requireAuthenticatedIdentity(ctx);
    const projects = await ctx.db.query("projects").collect();

    return Promise.all(
      projects.map((project) => buildBoardProjectRecord(ctx, project))
    );
  },
});

export const getProjectDetail = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    await requireAuthenticatedIdentity(ctx);
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      return null;
    }

    const [
      boardProject,
      departmentTracks,
      workItems,
      approvalGates,
      comments,
      auditEvents,
      chatBindings,
      docBindings,
      baseBindings,
      feishuTaskBindings,
    ] = await Promise.all([
      buildBoardProjectRecord(ctx, project),
      ctx.db
        .query("departmentTracks")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .collect(),
      ctx.db
        .query("workItems")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .collect(),
      ctx.db
        .query("approvalGates")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .collect(),
      ctx.db
        .query("comments")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .collect(),
      ctx.db
        .query("auditEvents")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .order("desc")
        .collect(),
      ctx.db
        .query("chatBindings")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .collect(),
      ctx.db
        .query("docBindings")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .collect(),
      ctx.db
        .query("baseBindings")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .collect(),
      ctx.db
        .query("feishuTaskBindings")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .collect(),
    ]);

    const taskBindingByWorkItemId = new Map(
      feishuTaskBindings.map((binding) => [binding.workItemId, binding])
    );

    const departmentTrackById = new Map(
      departmentTracks.map((track) => [track._id, track])
    );

    const commentMentionsByCommentId = new Map<
      Id<"comments">,
      Doc<"mentions">[]
    >(
      await Promise.all(
        comments.map(async (comment) => {
          const mentions = await ctx.db
            .query("mentions")
            .withIndex("by_comment", (q) => q.eq("commentId", comment._id))
            .collect();
          return [comment._id, mentions] as const;
        })
      )
    );

    return {
      approvals: approvalGates.map((gate) => ({
        applicantId: gate.applicantId,
        approvalCode: gate.approvalCode,
        departmentName: gate.departmentTrackId
          ? (departmentTrackById.get(gate.departmentTrackId)?.departmentName ??
            null)
          : null,
        id: gate._id,
        instanceCode: gate.instanceCode,
        resolvedAt: gate.resolvedAt,
        resolvedBy: gate.resolvedBy,
        status: gate.status,
        title: gate.title,
        triggerStage: gate.triggerStage,
      })),
      bindings: {
        bases: baseBindings.map((binding) => ({
          fieldOwnership: binding.fieldOwnership,
          id: binding._id,
          lastSyncedAt: binding.lastSyncedAt,
          recordId: binding.recordId,
          tableId: binding.tableId,
        })),
        chats: chatBindings.map((binding) => ({
          chatType: binding.chatType,
          feishuChatId: binding.feishuChatId,
          id: binding._id,
          pinnedMessageId: binding.pinnedMessageId,
        })),
        docs: docBindings.map((binding) => ({
          docType: binding.docType,
          id: binding._id,
          purpose: binding.purpose,
          title: binding.title,
        })),
      },
      comments: comments.map((comment) => ({
        authorId: comment.authorId,
        body: comment.body,
        createdAt: comment._creationTime,
        id: comment._id,
        isDeleted: comment.isDeleted,
        mentionedUserIds:
          commentMentionsByCommentId
            .get(comment._id)
            ?.map((mention) => mention.mentionedUserId) ?? [],
        parentCommentId: comment.parentCommentId ?? null,
        targetScope: comment.targetScope,
      })),
      departmentTracks: departmentTracks.map((track) => ({
        blockReason: track.blockReason,
        collaboratorIds: track.collaboratorIds ?? [],
        departmentId: track.departmentId,
        departmentName: track.departmentName,
        dueDate: track.dueDate,
        id: track._id,
        isRequired: track.isRequired,
        ownerId: track.ownerId,
        pendingApprovalCount: approvalGates.filter(
          (gate) =>
            gate.departmentTrackId === track._id && gate.status === "pending"
        ).length,
        relatedWorkItemCount: workItems.filter(
          (item) => item.departmentTrackId === track._id
        ).length,
        status: track.status,
      })),
      project: {
        ...boardProject,
        createdBy: project.createdBy,
        description: project.description,
        endDate: project.endDate,
        slaDeadline: project.slaDeadline,
        sourceEntry: project.sourceEntry,
        startDate: project.startDate,
      },
      timeline: auditEvents.map((event) => ({
        action: event.action,
        actorId: event.actorId,
        changeSummary: event.changeSummary,
        createdAt: event._creationTime,
        id: event._id,
        objectId: event.objectId,
        objectType: event.objectType,
        sourceEntry: event.sourceEntry,
      })),
      workItems: workItems.map((item) => {
        const binding = taskBindingByWorkItemId.get(item._id);
        return {
          assigneeId: item.assigneeId,
          collaboratorIds: item.collaboratorIds ?? [],
          completedAt: item.completedAt,
          departmentName: item.departmentTrackId
            ? (departmentTrackById.get(item.departmentTrackId)
                ?.departmentName ?? null)
            : null,
          departmentTrackId: item.departmentTrackId,
          description: item.description,
          dueDate: item.dueDate,
          feishuTaskGuid: binding?.feishuTaskGuid ?? null,
          feishuTaskStatus: binding?.feishuTaskStatus ?? null,
          id: item._id,
          priority: item.priority,
          status: item.status,
          title: item.title,
        };
      }),
    };
  },
});

const logStageTransition = async (
  ctx: MutationCtx,
  projectId: Id<"projects">,
  actorId: string,
  fromStatus: string,
  targetStatus: string,
  reason?: string
) => {
  await ctx.db.insert("auditEvents", {
    action: "project.stage_transitioned",
    actorId,
    changeSummary: reason
      ? `Stage moved from ${fromStatus} to ${targetStatus}: ${reason}`
      : `Stage moved from ${fromStatus} to ${targetStatus}`,
    objectId: projectId,
    objectType: "project",
    projectId: projectId,
    sourceEntry: "web_drag_drop",
  });
};

const createApprovalGatesForStage = async (
  ctx: MutationCtx,
  project: Doc<"projects">,
  actorId: string,
  fromStatus: string,
  targetStatus: string
) => {
  if (!project.templateId) {
    return;
  }

  const template = await ctx.db.get(
    project.templateId as unknown as Id<"projectTemplates">
  );

  if (!template) {
    return;
  }

  const stageGates = template.approvalGates.filter(
    (gate) => gate.triggerStage === targetStatus
  );

  for (const gateConfig of stageGates) {
    const gateId = await ctx.db.insert("approvalGates", {
      applicantId: actorId,
      approvalCode: gateConfig.approvalCode,
      projectId: project._id,
      snapshotData: JSON.stringify({
        fromStage: fromStatus,
        projectName: project.name,
        targetStage: targetStatus,
      }),
      status: "pending",
      templateVersion: project.templateVersion,
      title: gateConfig.title,
      triggerStage: targetStatus as
        | "new"
        | "assessment"
        | "solution"
        | "ready"
        | "executing"
        | "delivering"
        | "done"
        | "cancelled",
    });

    await ctx.scheduler.runAfter(0, internal.feishuActions.submitApproval, {
      applicantId: actorId,
      approvalCode: gateConfig.approvalCode,
      formData: JSON.stringify([
        {
          id: "project_name",
          type: "input",
          value: project.name,
        },
        {
          id: "stage_transition",
          type: "input",
          value: `${fromStatus} → ${targetStatus}`,
        },
      ]),
      gateId,
    });
  }
};

const notifyStageChange = async (
  ctx: MutationCtx,
  project: Doc<"projects">,
  fromStatus: string,
  targetStatus: string
) => {
  const chatBinding = await ctx.db
    .query("chatBindings")
    .withIndex("by_project", (q) => q.eq("projectId", project._id))
    .first();

  if (!chatBinding) {
    return;
  }

  const deliveryId = await ctx.db.insert("notificationDeliveries", {
    channel: "group_chat",
    messageType: "stage_change",
    payload: JSON.stringify({
      fromStage: fromStatus,
      projectName: project.name,
      targetStage: targetStatus,
    }),
    projectId: project._id,
    recipientId: chatBinding.feishuChatId,
    retryCount: 0,
    status: "pending",
  });

  await ctx.scheduler.runAfter(0, internal.feishuActions.sendCardMessage, {
    card: JSON.stringify({
      elements: [
        {
          fields: [
            {
              is_short: true,
              text: {
                content: `**Project:** ${project.name}`,
                tag: "lark_md",
              },
            },
            {
              is_short: true,
              text: {
                content: `**Stage:** ${fromStatus} → ${targetStatus}`,
                tag: "lark_md",
              },
            },
          ],
          tag: "div",
        },
      ],
      header: {
        template: "blue",
        title: { content: "Stage Transition", tag: "plain_text" },
      },
    }),
    chatId: chatBinding.feishuChatId,
    deliveryId,
  });
};

export const transitionProjectStage = mutation({
  args: {
    projectId: v.id("projects"),
    reason: v.optional(v.string()),
    targetStatus: projectStatus,
  },
  handler: async (ctx, args) => {
    const identity = await requireAuthenticatedIdentity(ctx);
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      return {
        message: `Project ${args.projectId} not found`,
        ok: false,
      } as const;
    }

    if (project.status === args.targetStatus) {
      return {
        message: "项目已处于目标阶段",
        ok: true,
        status: project.status,
      } as const;
    }

    const [departmentTracks, approvalGates] = await Promise.all([
      ctx.db
        .query("departmentTracks")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .collect(),
      ctx.db
        .query("approvalGates")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .collect(),
    ]);

    const decision = canTransitionProject(
      project.status,
      args.targetStatus,
      departmentTracks
        .filter((track) => track.isRequired)
        .map((track) => track.status),
      approvalGates.filter((gate) => gate.status === "pending").length
    );

    if (!decision.allowed) {
      return { message: decision.reason, ok: false } as const;
    }

    const fromStatus = project.status;
    await ctx.db.patch(args.projectId, { status: args.targetStatus });

    await logStageTransition(
      ctx,
      args.projectId,
      identity.subject,
      fromStatus,
      args.targetStatus,
      args.reason
    );

    await createApprovalGatesForStage(
      ctx,
      project,
      identity.subject,
      fromStatus,
      args.targetStatus
    );

    await notifyStageChange(ctx, project, fromStatus, args.targetStatus);

    return {
      message: "阶段迁移成功",
      ok: true,
      status: args.targetStatus,
    } as const;
  },
});
