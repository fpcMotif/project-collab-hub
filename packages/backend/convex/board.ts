import { v } from "convex/values";

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

function isForwardTransition(currentStatus: string, targetStatus: string) {
  const currentIndex = FORWARD_FLOW.indexOf(
    currentStatus as (typeof FORWARD_FLOW)[number]
  );
  const targetIndex = FORWARD_FLOW.indexOf(
    targetStatus as (typeof FORWARD_FLOW)[number]
  );

  return (
    currentIndex !== -1 && targetIndex !== -1 && targetIndex > currentIndex
  );
}

function canTransitionProject(
  currentStatus: string,
  targetStatus: string,
  requiredTrackStatuses: readonly string[],
  pendingRequiredApprovalCount: number
) {
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
}

function deriveSlaRisk(
  slaDeadline: number | undefined,
  overdueTaskCount: number
) {
  if (overdueTaskCount > 0) {
    return "overdue" as const;
  }

  if (!slaDeadline) {
    return "on_time" as const;
  }

  const riskThresholdMs = 1000 * 60 * 60 * 24 * 3;
  return slaDeadline <= Date.now() + riskThresholdMs ? "at_risk" : "on_time";
}

async function buildBoardProjectRecord(ctx: any, project: any) {
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
        ? ctx.db.get(project.templateId)
        : Promise.resolve(null),
    ]);

  const overdueTaskCount = workItems.filter(
    (item) =>
      item.status !== "done" &&
      item.dueDate !== undefined &&
      item.dueDate < Date.now()
  ).length;

  return {
    customerName: project.customerName ?? "未填写客户",
    departmentTracks: departmentTracks.map((track) => ({
      departmentName: track.departmentName,
      status: track.isRequired ? track.status : "not_required",
      blockReason: track.blockReason,
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
    templateType: template?.name ?? "默认模板",
  };
}

export const listBoardProjects = query({
  args: {},
  handler: async (ctx) => {
    const projects = await ctx.db.query("projects").collect();

    return Promise.all(
      projects.map((project) => buildBoardProjectRecord(ctx, project))
    );
  },
});

export const getProjectDetail = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
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

    const commentMentionsByCommentId = new Map(
      await Promise.all(
        comments.map(async (comment) => [
          comment._id,
          await ctx.db
            .query("mentions")
            .withIndex("by_comment", (q) => q.eq("commentId", comment._id))
            .collect(),
        ])
      )
    );

    return {
      approvals: approvalGates.map((gate) => ({
        id: gate._id,
        title: gate.title,
        triggerStage: gate.triggerStage,
        status: gate.status,
        approvalCode: gate.approvalCode,
        instanceCode: gate.instanceCode,
        applicantId: gate.applicantId,
        resolvedAt: gate.resolvedAt,
        resolvedBy: gate.resolvedBy,
        departmentName: gate.departmentTrackId
          ? (departmentTrackById.get(gate.departmentTrackId)?.departmentName ??
            null)
          : null,
      })),
      bindings: {
        chats: chatBindings.map((binding) => ({
          id: binding._id,
          feishuChatId: binding.feishuChatId,
          chatType: binding.chatType,
          pinnedMessageId: binding.pinnedMessageId,
        })),
        docs: docBindings.map((binding) => ({
          id: binding._id,
          title: binding.title,
          docType: binding.docType,
          purpose: binding.purpose,
          feishuDocToken: binding.feishuDocToken,
        })),
        bases: baseBindings.map((binding) => ({
          id: binding._id,
          baseAppToken: binding.baseAppToken,
          tableId: binding.tableId,
          recordId: binding.recordId,
          fieldOwnership: binding.fieldOwnership,
          lastSyncedAt: binding.lastSyncedAt,
        })),
      },
      comments: comments.map((comment) => ({
        id: comment._id,
        authorId: comment.authorId,
        body: comment.body,
        targetScope: comment.targetScope,
        isDeleted: comment.isDeleted,
        parentCommentId: comment.parentCommentId ?? null,
        mentionedUserIds:
          commentMentionsByCommentId
            .get(comment._id)
            ?.map((mention) => mention.mentionedUserId) ?? [],
        createdAt: comment._creationTime,
      })),
      departmentTracks: departmentTracks.map((track) => ({
        id: track._id,
        departmentId: track.departmentId,
        departmentName: track.departmentName,
        isRequired: track.isRequired,
        status: track.status,
        ownerId: track.ownerId,
        collaboratorIds: track.collaboratorIds ?? [],
        dueDate: track.dueDate,
        blockReason: track.blockReason,
        relatedWorkItemCount: workItems.filter(
          (item) => item.departmentTrackId === track._id
        ).length,
        pendingApprovalCount: approvalGates.filter(
          (gate) =>
            gate.departmentTrackId === track._id && gate.status === "pending"
        ).length,
      })),
      project: {
        ...boardProject,
        description: project.description,
        createdBy: project.createdBy,
        sourceEntry: project.sourceEntry,
        startDate: project.startDate,
        endDate: project.endDate,
        slaDeadline: project.slaDeadline,
      },
      timeline: auditEvents.map((event) => ({
        id: event._id,
        actorId: event.actorId,
        action: event.action,
        objectType: event.objectType,
        objectId: event.objectId,
        changeSummary: event.changeSummary,
        sourceEntry: event.sourceEntry,
        createdAt: event._creationTime,
      })),
      workItems: workItems.map((item) => {
        const binding = taskBindingByWorkItemId.get(item._id);
        return {
          id: item._id,
          title: item.title,
          description: item.description,
          status: item.status,
          priority: item.priority,
          assigneeId: item.assigneeId,
          collaboratorIds: item.collaboratorIds ?? [],
          dueDate: item.dueDate,
          completedAt: item.completedAt,
          departmentTrackId: item.departmentTrackId,
          departmentName: item.departmentTrackId
            ? (departmentTrackById.get(item.departmentTrackId)
                ?.departmentName ?? null)
            : null,
          feishuTaskGuid: binding?.feishuTaskGuid ?? null,
          feishuTaskStatus: binding?.feishuTaskStatus ?? null,
        };
      }),
    };
  },
});

export const transitionProjectStage = mutation({
  args: {
    actorId: v.string(),
    projectId: v.id("projects"),
    reason: v.optional(v.string()),
    targetStatus: projectStatus,
  },
  handler: async (ctx, args) => {
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

    await ctx.db.insert("auditEvents", {
      action: "project.stage_transitioned",
      actorId: args.actorId,
      changeSummary: args.reason
        ? `Stage moved from ${fromStatus} to ${args.targetStatus}: ${args.reason}`
        : `Stage moved from ${fromStatus} to ${args.targetStatus}`,
      objectId: args.projectId,
      objectType: "project",
      projectId: args.projectId,
      sourceEntry: "web_drag_drop",
    });

    return {
      message: "阶段迁移成功",
      ok: true,
      status: args.targetStatus,
    } as const;
  },
});
