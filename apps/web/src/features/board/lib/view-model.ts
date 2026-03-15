import {
  BOARD_COLUMNS,
  canAdvanceStage,
  getNextProjectStatus,
} from "../constants";
import type {
  ApprovalStatusFilter,
  BoardColumnViewModel,
  BoardFilterState,
  BoardProjectCard,
  BoardProjectRecord,
  DepartmentTrackSummary,
  OverdueStatusFilter,
  Priority,
  SlaRisk,
  StageAdvanceState,
  StageAdvanceTone,
} from "../types";

const PRIORITY_SORT_WEIGHT: Record<Priority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const SLA_SORT_WEIGHT: Record<SlaRisk, number> = {
  overdue: 0,
  at_risk: 1,
  on_time: 2,
};

const STAGE_TONE_SORT_WEIGHT: Record<StageAdvanceTone, number> = {
  blocked: 0,
  attention: 1,
  ready: 2,
  terminal: 3,
};

export function getColumnNameByStatus(status: string | null) {
  return BOARD_COLUMNS.find((column) => column.projectStatus === status)?.name ?? null;
}

export function getProjectStatusByColumnId(columnId: string) {
  return BOARD_COLUMNS.find((column) => column.id === columnId)?.projectStatus ?? null;
}

export function getApprovalStatus(project: BoardProjectRecord): ApprovalStatusFilter {
  return project.pendingApprovalCount > 0 ? "pending" : "clear";
}

export function getOverdueStatus(project: BoardProjectRecord): OverdueStatusFilter {
  return project.overdueTaskCount > 0 ? "overdue" : "normal";
}

function formatBlockedDepartments(blockedTracks: DepartmentTrackSummary[]) {
  return blockedTracks
    .map((track) =>
      track.blockReason
        ? `${track.departmentName}（${track.blockReason}）`
        : track.departmentName,
    )
    .join("、");
}

export function buildStageAdvanceState(project: BoardProjectRecord): StageAdvanceState {
  const nextStatus = getNextProjectStatus(project.status);
  const nextColumnName = getColumnNameByStatus(nextStatus);
  const nextColumnId =
    BOARD_COLUMNS.find((column) => column.projectStatus === nextStatus)?.id ?? null;

  if (!nextStatus || !nextColumnName) {
    return {
      nextStatus: null,
      nextColumnId: null,
      nextColumnName: null,
      allowed: false,
      tone: "terminal",
      summary: project.status === "done" ? "流程已完成" : "项目已取消",
      detail:
        project.status === "done"
          ? "项目已处于最终完成状态，无需继续推进。"
          : "项目已终止，当前无需继续推进。",
    };
  }

  const requiredTracks = project.departmentTracks.filter(
    (track) => track.status !== "not_required",
  );
  const blockingTracks = requiredTracks.filter(
    (track) => track.status === "blocked" || track.status === "waiting_approval",
  );
  const incompleteTracks = requiredTracks.filter((track) => track.status !== "done");

  const stageDecision = canAdvanceStage(
    project.status,
    nextStatus,
    requiredTracks.map((track) => track.status),
    project.pendingApprovalCount,
  );

  if (stageDecision.allowed) {
    return {
      nextStatus,
      nextColumnId,
      nextColumnName,
      allowed: true,
      tone: "ready",
      summary: `可推进到「${nextColumnName}」`,
      detail: "必需部门已完成，且当前没有待处理审批。",
    };
  }

  if (blockingTracks.length > 0) {
    return {
      nextStatus,
      nextColumnId,
      nextColumnName,
      allowed: false,
      tone: "blocked",
      summary: `推进到「${nextColumnName}」受阻`,
      detail: `阻塞部门：${formatBlockedDepartments(blockingTracks)}`,
    };
  }

  if (project.pendingApprovalCount > 0) {
    return {
      nextStatus,
      nextColumnId,
      nextColumnName,
      allowed: false,
      tone: "attention",
      summary: `推进到「${nextColumnName}」待审批`,
      detail: `还有 ${project.pendingApprovalCount} 个审批事项待处理。`,
    };
  }

  if (incompleteTracks.length > 0) {
    return {
      nextStatus,
      nextColumnId,
      nextColumnName,
      allowed: false,
      tone: "attention",
      summary: `推进到「${nextColumnName}」待协同完成`,
      detail: `待完成部门：${incompleteTracks.map((track) => track.departmentName).join("、")}`,
    };
  }

  return {
    nextStatus,
    nextColumnId,
    nextColumnName,
    allowed: false,
    tone: "blocked",
    summary: `当前不可推进到「${nextColumnName}」`,
    detail: stageDecision.reason ?? "请检查阶段配置与审批规则。",
  };
}

export function getProjectMoveDecision(project: BoardProjectRecord, targetStatus: string) {
  if (project.status === targetStatus) {
    return { ok: true, message: "项目已处于目标阶段" } as const;
  }

  const requiredTracks = project.departmentTracks
    .filter((track) => track.status !== "not_required")
    .map((track) => track.status);

  const decision = canAdvanceStage(
    project.status,
    targetStatus,
    requiredTracks,
    project.pendingApprovalCount,
  );

  return {
    ok: decision.allowed,
    message: decision.allowed ? "阶段迁移成功" : decision.reason,
  } as const;
}

function sortCards(cards: BoardProjectCard[]) {
  return [...cards].sort((left, right) => {
    return (
      STAGE_TONE_SORT_WEIGHT[left.stageAdvance.tone] -
        STAGE_TONE_SORT_WEIGHT[right.stageAdvance.tone] ||
      SLA_SORT_WEIGHT[left.slaRisk] - SLA_SORT_WEIGHT[right.slaRisk] ||
      right.overdueTaskCount - left.overdueTaskCount ||
      right.pendingApprovalCount - left.pendingApprovalCount ||
      PRIORITY_SORT_WEIGHT[left.priority] - PRIORITY_SORT_WEIGHT[right.priority] ||
      left.name.localeCompare(right.name, "zh-Hans-CN")
    );
  });
}

export function buildBoardViewData(projects: BoardProjectRecord[], filters: BoardFilterState) {
  let filtered = projects;

  if (filters.department) {
    filtered = filtered.filter((project) =>
      project.departmentTracks.some((track) => track.departmentName === filters.department),
    );
  }
  if (filters.owner) {
    filtered = filtered.filter((project) => project.ownerName === filters.owner);
  }
  if (filters.priority) {
    filtered = filtered.filter((project) => project.priority === filters.priority);
  }
  if (filters.approvalStatus) {
    filtered = filtered.filter(
      (project) => getApprovalStatus(project) === filters.approvalStatus,
    );
  }
  if (filters.overdueStatus) {
    filtered = filtered.filter((project) => getOverdueStatus(project) === filters.overdueStatus);
  }
  if (filters.slaRisk) {
    filtered = filtered.filter((project) => project.slaRisk === filters.slaRisk);
  }
  if (filters.customer) {
    filtered = filtered.filter((project) => project.customerName === filters.customer);
  }
  if (filters.templateType) {
    filtered = filtered.filter((project) => project.templateType === filters.templateType);
  }

  const cards = filtered.map<BoardProjectCard>((project) => ({
    ...project,
    currentStageName: getColumnNameByStatus(project.status) ?? project.status,
    stageAdvance: buildStageAdvanceState(project),
  }));

  const columns: BoardColumnViewModel[] = BOARD_COLUMNS.map((column) => ({
    id: column.id,
    name: column.name,
    projectStatus: column.projectStatus,
    entryCriteria: column.entryCriteria,
    exitCriteria: column.exitCriteria,
    cards: sortCards(cards.filter((project) => project.status === column.projectStatus)),
  }));

  const ownerOptions = [...new Set(projects.map((project) => project.ownerName))]
    .sort()
    .map((owner) => ({ value: owner, label: owner }));

  const customerOptions = [...new Set(projects.map((project) => project.customerName))]
    .sort()
    .map((customer) => ({ value: customer, label: customer }));

  const departmentOptions = [
    ...new Set(
      projects.flatMap((project) =>
        project.departmentTracks.map((track) => track.departmentName),
      ),
    ),
  ]
    .sort()
    .map((department) => ({ value: department, label: department }));

  const templateTypeOptions = [...new Set(projects.map((project) => project.templateType))]
    .sort()
    .map((templateType) => ({ value: templateType, label: templateType }));

  return {
    columns,
    ownerOptions,
    customerOptions,
    departmentOptions,
    templateTypeOptions,
    totalProjectCount: projects.length,
    visibleProjectCount: filtered.length,
  } as const;
}
