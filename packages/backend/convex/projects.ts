import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const PROJECT_STATUSES = [
  "new",
  "assessment",
  "solution",
  "ready",
  "executing",
  "delivering",
  "done",
  "cancelled",
] as const;

type ProjectStatus = (typeof PROJECT_STATUSES)[number];

const ALLOWED_STATUS_TRANSITIONS: Record<ProjectStatus, readonly ProjectStatus[]> = {
  new: ["assessment", "cancelled"],
  assessment: ["solution", "cancelled"],
  solution: ["ready", "cancelled"],
  ready: ["executing", "cancelled"],
  executing: ["delivering", "cancelled"],
  delivering: ["done", "cancelled"],
  done: [],
  cancelled: [],
};

const DENY_REASONS = {
  invalid_transition: "invalid_transition",
  blocked_department_tracks: "blocked_department_tracks",
  required_approval_not_passed: "required_approval_not_passed",
} as const;

const statusValue = v.union(...PROJECT_STATUSES.map((status) => v.literal(status)));

const serializeStatusChangeAudit = (payload: {
  from_stage: ProjectStatus;
  to_stage: ProjectStatus;
  deny_reason?: string;
  blocked_tracks?: Array<{
    trackId: string;
    departmentName: string;
    status: string;
    reason?: string;
  }>;
  pending_approval_gates?: Array<{
    gateId: string;
    title: string;
    status: string;
  }>;
}) => JSON.stringify(payload);

const ensureValidTransition = (from: ProjectStatus, to: ProjectStatus) => {
  if (from === to) {
    return;
  }

  const allowedTargets = ALLOWED_STATUS_TRANSITIONS[from] ?? [];
  if (!allowedTargets.includes(to)) {
    throw new Error(
      `Status transition not allowed: ${from} -> ${to}. Allowed: ${allowedTargets.join(", ") || "none"}`,
    );
  }
};

export const list = query({
  args: {
    status: v.optional(statusValue),
  },
  handler: async (ctx, args) => {
    if (args.status) {
      return ctx.db
        .query("projects")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .collect();
    }
    return ctx.db.query("projects").collect();
  },
});

export const getById = query({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    ownerId: v.string(),
    departmentId: v.string(),
    customerName: v.optional(v.string()),
    templateId: v.optional(v.string()),
    templateVersion: v.optional(v.number()),
    priority: v.optional(
      v.union(
        v.literal("low"),
        v.literal("medium"),
        v.literal("high"),
        v.literal("urgent"),
      ),
    ),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    slaDeadline: v.optional(v.number()),
    createdBy: v.string(),
    sourceEntry: v.union(
      v.literal("workbench"),
      v.literal("message_shortcut"),
      v.literal("api"),
    ),
  },
  handler: async (ctx, args) => {
    const projectId = await ctx.db.insert("projects", {
      ...args,
      status: "new",
    });

    await ctx.db.insert("auditEvents", {
      projectId,
      actorId: args.createdBy,
      action: "project.created",
      objectType: "project",
      objectId: projectId,
      changeSummary: `Project "${args.name}" created via ${args.sourceEntry}`,
      sourceEntry: args.sourceEntry,
    });

    return projectId;
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("projects"),
    status: statusValue,
    actorId: v.string(),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.id);
    if (!project) {
      throw new Error(`Project ${args.id} not found`);
    }

    const fromStatus = project.status;
    const toStatus = args.status;

    try {
      ensureValidTransition(fromStatus, toStatus);
    } catch (error) {
      await ctx.db.insert("auditEvents", {
        projectId: args.id,
        actorId: args.actorId,
        action: "project.status_change_denied",
        objectType: "project",
        objectId: args.id,
        changeSummary: serializeStatusChangeAudit({
          from_stage: fromStatus,
          to_stage: toStatus,
          deny_reason: DENY_REASONS.invalid_transition,
        }),
      });
      throw error;
    }

    const departmentTracks = await ctx.db
      .query("departmentTracks")
      .withIndex("by_project", (q) => q.eq("projectId", args.id))
      .collect();
    const blockingRequiredTracks = departmentTracks.filter(
      (track) =>
        track.isRequired &&
        (track.status === "blocked" || track.status === "waiting_approval"),
    );
    if (blockingRequiredTracks.length > 0) {
      const detail = blockingRequiredTracks.map((track) => ({
        trackId: track._id,
        departmentName: track.departmentName,
        status: track.status,
        reason: track.blockReason,
      }));
      const detailJson = JSON.stringify(detail);

      await ctx.db.insert("auditEvents", {
        projectId: args.id,
        actorId: args.actorId,
        action: "project.status_change_denied",
        objectType: "project",
        objectId: args.id,
        changeSummary: serializeStatusChangeAudit({
          from_stage: fromStatus,
          to_stage: toStatus,
          deny_reason: DENY_REASONS.blocked_department_tracks,
          blocked_tracks: detail,
        }),
      });

      throw new Error(`Migration blocked by required department tracks: ${detailJson}`);
    }

    const stageGates = (await ctx.db
      .query("approvalGates")
      .withIndex("by_project", (q) => q.eq("projectId", args.id))
      .collect())
      .filter((gate) => gate.triggerStage === toStatus);
    const unapprovedGates = stageGates.filter((gate) => gate.status !== "approved");
    if (unapprovedGates.length > 0) {
      const detail = unapprovedGates.map((gate) => ({
        gateId: gate._id,
        title: gate.title,
        status: gate.status,
      }));
      const detailJson = JSON.stringify(detail);

      await ctx.db.insert("auditEvents", {
        projectId: args.id,
        actorId: args.actorId,
        action: "project.status_change_denied",
        objectType: "project",
        objectId: args.id,
        changeSummary: serializeStatusChangeAudit({
          from_stage: fromStatus,
          to_stage: toStatus,
          deny_reason: DENY_REASONS.required_approval_not_passed,
          pending_approval_gates: detail,
        }),
      });

      throw new Error(`Migration blocked by approval gates: ${detailJson}`);
    }

    await ctx.db.patch(args.id, { status: toStatus });

    await ctx.db.insert("auditEvents", {
      projectId: args.id,
      actorId: args.actorId,
      action: "project.status_changed",
      objectType: "project",
      objectId: args.id,
      changeSummary: serializeStatusChangeAudit({
        from_stage: fromStatus,
        to_stage: toStatus,
      }),
    });
  },
});
