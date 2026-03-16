import { Schema } from "effect";

export const BoardColumnId = Schema.Literal(
  "COL-NEW",
  "COL-ASSESS",
  "COL-SOLUTION",
  "COL-READY",
  "COL-EXEC",
  "COL-DELIVER",
  "COL-DONE",
  "COL-CANCEL"
);
export type BoardColumnId = typeof BoardColumnId.Type;

export class BoardColumn extends Schema.Class<BoardColumn>("BoardColumn")({
  entryCriteria: Schema.String,
  exitCriteria: Schema.String,
  id: BoardColumnId,
  name: Schema.String,
  projectStatus: Schema.Literal(
    "new",
    "assessment",
    "solution",
    "ready",
    "executing",
    "delivering",
    "done",
    "cancelled"
  ),
}) {}

/** Maps each board column to its corresponding ProjectStatus */
export const BOARD_COLUMNS: readonly BoardColumn[] = [
  {
    entryCriteria: "客户需求新进入系统",
    exitCriteria: "已确定项目 owner 与必要部门",
    id: "COL-NEW",
    name: "新建/待分诊",
    projectStatus: "new",
  },
  {
    entryCriteria: "已分配 PM/owner",
    exitCriteria: "形成初步方案范围与预计交付方式",
    id: "COL-ASSESS",
    name: "需求评估",
    projectStatus: "assessment",
  },
  {
    entryCriteria: "技术/商务开始评估",
    exitCriteria: "技术方案和商务约束达成一致",
    id: "COL-SOLUTION",
    name: "方案与报价",
    projectStatus: "solution",
  },
  {
    entryCriteria: "已明确采购/技术/物流工作流",
    exitCriteria: "关键启动审批已通过",
    id: "COL-READY",
    name: "待协同启动",
    projectStatus: "ready",
  },
  {
    entryCriteria: "任务已下发到各部门",
    exitCriteria: "所有必需工作流完成且无阻塞",
    id: "COL-EXEC",
    name: "执行中",
    projectStatus: "executing",
  },
  {
    entryCriteria: "执行完成，进入交付门禁",
    exitCriteria: "交付审批通过并完成交付",
    id: "COL-DELIVER",
    name: "待交付/验收",
    projectStatus: "delivering",
  },
  {
    entryCriteria: "项目已交付关闭",
    exitCriteria: "N/A",
    id: "COL-DONE",
    name: "已完成",
    projectStatus: "done",
  },
  {
    entryCriteria: "项目被取消/终止",
    exitCriteria: "N/A",
    id: "COL-CANCEL",
    name: "已取消",
    projectStatus: "cancelled",
  },
] as const;

/** Valid stage transitions — each key lists allowed next stages */
export const STAGE_TRANSITIONS: Record<string, readonly string[]> = {
  assessment: ["solution", "cancelled"],
  cancelled: [],
  delivering: ["done", "executing", "cancelled"],
  done: [],
  executing: ["delivering", "cancelled"],
  new: ["assessment", "cancelled"],
  ready: ["executing", "solution", "cancelled"],
  solution: ["ready", "assessment", "cancelled"],
} as const;

/**
 * Linear happy-path sequence. `cancelled` is intentionally excluded because it
 * is a terminal side-path rather than part of the forward delivery flow.
 */
export const BOARD_FLOW_SEQUENCE = [
  "new",
  "assessment",
  "solution",
  "ready",
  "executing",
  "delivering",
  "done",
] as const;

export const DEPARTMENT_TRACK_STATUSES = [
  "not_required",
  "not_started",
  "in_progress",
  "blocked",
  "waiting_approval",
  "done",
] as const;

/** Statuses that block a project from advancing past a gate */
export const BLOCKING_STATUSES = ["blocked", "waiting_approval"] as const;

export const getNextProjectStatus = (
  currentStatus: string
): (typeof BOARD_FLOW_SEQUENCE)[number] | null => {
  const index = BOARD_FLOW_SEQUENCE.indexOf(
    currentStatus as (typeof BOARD_FLOW_SEQUENCE)[number]
  );

  if (index === -1 || index === BOARD_FLOW_SEQUENCE.length - 1) {
    return null;
  }

  return BOARD_FLOW_SEQUENCE[index + 1];
};

const isForwardStageTransition = (
  currentStatus: string,
  targetStatus: string
): boolean => {
  const currentIndex = BOARD_FLOW_SEQUENCE.indexOf(
    currentStatus as (typeof BOARD_FLOW_SEQUENCE)[number]
  );
  const targetIndex = BOARD_FLOW_SEQUENCE.indexOf(
    targetStatus as (typeof BOARD_FLOW_SEQUENCE)[number]
  );

  return (
    currentIndex !== -1 && targetIndex !== -1 && targetIndex > currentIndex
  );
};

/**
 * Check whether a project can transition to the target stage.
 *
 * Rules:
 * - transition must be explicitly permitted by STAGE_TRANSITIONS
 * - backward transitions / cancellation are allowed once the transition itself
 *   is valid (they are remediation paths)
 * - forward transitions require:
 *   - no blocked / waiting-approval required tracks
 *   - zero pending required approvals
 *   - all required department tracks completed
 */
export const canAdvanceStage = (
  currentStatus: string,
  targetStatus: string,
  requiredTrackStatuses: readonly string[],
  pendingRequiredApprovalCount = 0
): { allowed: boolean; reason?: string } => {
  const allowedTargets = STAGE_TRANSITIONS[currentStatus];
  if (!allowedTargets || !allowedTargets.includes(targetStatus)) {
    return {
      allowed: false,
      reason: `Transition from "${currentStatus}" to "${targetStatus}" is not permitted`,
    };
  }

  if (!isForwardStageTransition(currentStatus, targetStatus)) {
    return { allowed: true };
  }

  const requiredStatuses = requiredTrackStatuses.filter(
    (status) => status !== "not_required"
  );

  const blockingTracks = requiredStatuses.filter((status) =>
    (BLOCKING_STATUSES as readonly string[]).includes(status)
  );

  if (blockingTracks.length > 0) {
    return {
      allowed: false,
      reason: `${blockingTracks.length} required department(s) are blocked or waiting approval`,
    };
  }

  if (pendingRequiredApprovalCount > 0) {
    return {
      allowed: false,
      reason: `${pendingRequiredApprovalCount} required approval(s) are still pending`,
    };
  }

  const incompleteTracks = requiredStatuses.filter(
    (status) => status !== "done"
  );
  if (incompleteTracks.length > 0) {
    return {
      allowed: false,
      reason: `${incompleteTracks.length} required department(s) are not complete`,
    };
  }

  return { allowed: true };
};
