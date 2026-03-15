import { Schema } from "effect";

export const BoardColumnId = Schema.Literal(
  "COL-NEW",
  "COL-ASSESS",
  "COL-SOLUTION",
  "COL-READY",
  "COL-EXEC",
  "COL-DELIVER",
  "COL-DONE",
  "COL-CANCEL",
);
export type BoardColumnId = typeof BoardColumnId.Type;

export class BoardColumn extends Schema.Class<BoardColumn>("BoardColumn")({
  id: BoardColumnId,
  name: Schema.String,
  entryCriteria: Schema.String,
  exitCriteria: Schema.String,
  projectStatus: Schema.Literal(
    "new",
    "assessment",
    "solution",
    "ready",
    "executing",
    "delivering",
    "done",
    "cancelled",
  ),
}) {}

/** Maps each board column to its corresponding ProjectStatus */
export const BOARD_COLUMNS: readonly BoardColumn[] = [
  {
    id: "COL-NEW",
    name: "新建/待分诊",
    entryCriteria: "客户需求新进入系统",
    exitCriteria: "已确定项目 owner 与必要部门",
    projectStatus: "new",
  },
  {
    id: "COL-ASSESS",
    name: "需求评估",
    entryCriteria: "已分配 PM/owner",
    exitCriteria: "形成初步方案范围与预计交付方式",
    projectStatus: "assessment",
  },
  {
    id: "COL-SOLUTION",
    name: "方案与报价",
    entryCriteria: "技术/商务开始评估",
    exitCriteria: "技术方案和商务约束达成一致",
    projectStatus: "solution",
  },
  {
    id: "COL-READY",
    name: "待协同启动",
    entryCriteria: "已明确采购/技术/物流工作流",
    exitCriteria: "关键启动审批已通过",
    projectStatus: "ready",
  },
  {
    id: "COL-EXEC",
    name: "执行中",
    entryCriteria: "任务已下发到各部门",
    exitCriteria: "所有必需工作流完成且无阻塞",
    projectStatus: "executing",
  },
  {
    id: "COL-DELIVER",
    name: "待交付/验收",
    entryCriteria: "执行完成，进入交付门禁",
    exitCriteria: "交付审批通过并完成交付",
    projectStatus: "delivering",
  },
  {
    id: "COL-DONE",
    name: "已完成",
    entryCriteria: "项目已交付关闭",
    exitCriteria: "N/A",
    projectStatus: "done",
  },
  {
    id: "COL-CANCEL",
    name: "已取消",
    entryCriteria: "项目被取消/终止",
    exitCriteria: "N/A",
    projectStatus: "cancelled",
  },
] as const;

/** Valid stage transitions — each key lists allowed next stages */
export const STAGE_TRANSITIONS: Record<string, readonly string[]> = {
  new: ["assessment", "cancelled"],
  assessment: ["solution", "cancelled"],
  solution: ["ready", "assessment", "cancelled"],
  ready: ["executing", "solution", "cancelled"],
  executing: ["delivering", "cancelled"],
  delivering: ["done", "executing", "cancelled"],
  done: [],
  cancelled: [],
} as const;

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

/**
 * Check whether a project can transition to the next stage.
 * A project cannot advance if any required department track
 * is in a blocking status.
 */
export function canAdvanceStage(
  currentStatus: string,
  targetStatus: string,
  requiredTrackStatuses: readonly string[],
): { allowed: boolean; reason?: string } {
  const allowed = STAGE_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(targetStatus)) {
    return {
      allowed: false,
      reason: `Transition from "${currentStatus}" to "${targetStatus}" is not permitted`,
    };
  }

  const blockingTracks = requiredTrackStatuses.filter((s) =>
    (BLOCKING_STATUSES as readonly string[]).includes(s),
  );

  if (blockingTracks.length > 0) {
    return {
      allowed: false,
      reason: `${blockingTracks.length} required department(s) are blocked or waiting approval`,
    };
  }

  return { allowed: true };
}
