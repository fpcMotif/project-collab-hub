import { BOARD_COLUMNS, canAdvanceStage, getNextProjectStatus } from "../constants";
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
  high: 1,
  low: 3,
  medium: 2,
  urgent: 0,
};

const SLA_SORT_WEIGHT: Record<SlaRisk, number> = {
  at_risk: 1,
  on_time: 2,
  overdue: 0,
};

const STAGE_TONE_SORT_WEIGHT: Record<StageAdvanceTone, number> = {
  attention: 1,
  blocked: 0,
  ready: 2,
  terminal: 3,
};

export const getColumnNameByStatus = (status: string | null) =>
  BOARD_COLUMNS.find((column) => column.projectStatus === status)?.name ?? null;

export const getProjectStatusByColumnId = (columnId: string) =>
  BOARD_COLUMNS.find((column) => column.id === columnId)?.projectStatus ?? null;

export const getApprovalStatus = (project: BoardProjectRecord): ApprovalStatusFilter =>
  project.pendingApprovalCount > 0 ? "pending" : "clear";

export const getOverdueStatus = (project: BoardProjectRecord): OverdueStatusFilter =>
  project.overdueTaskCount > 0 ? "overdue" : "normal";

const formatBlockedDepartments = (blockedTracks: DepartmentTrackSummary[]) =>
  blockedTracks
    .map((track) =>
      track.blockReason ? `${track.departmentName}（${track.blockReason}）` : track.departmentName,
    )
    .join("、");

export const buildStageAdvanceState = (project: BoardProjectRecord): StageAdvanceState => {
  const nextStatus = getNextProjectStatus(project.status);
  const nextColumnName = getColumnNameByStatus(nextStatus);
  const nextColumnId =
    BOARD_COLUMNS.find((column) => column.projectStatus === nextStatus)?.id ?? null;

  if (!nextStatus || !nextColumnName) {
    return {
      allowed: false,
      detail:
        project.status === "done"
          ? "项目已处于最终完成状态，无需继续推进。"
          : "项目已终止，当前无需继续推进。",
      nextColumnId: null,
      nextColumnName: null,
      nextStatus: null,
      summary: project.status === "done" ? "流程已完成" : "项目已取消",
      tone: "terminal",
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
      allowed: true,
      detail: "必需部门已完成，且当前没有待处理审批。",
      nextColumnId,
      nextColumnName,
      nextStatus,
      summary: `可推进到「${nextColumnName}」`,
      tone: "ready",
    };
  }

  if (blockingTracks.length > 0) {
    return {
      allowed: false,
      detail: `阻塞部门：${formatBlockedDepartments(blockingTracks)}`,
      nextColumnId,
      nextColumnName,
      nextStatus,
      summary: `推进到「${nextColumnName}」受阻`,
      tone: "blocked",
    };
  }

  if (project.pendingApprovalCount > 0) {
    return {
      allowed: false,
      detail: `还有 ${project.pendingApprovalCount} 个审批事项待处理。`,
      nextColumnId,
      nextColumnName,
      nextStatus,
      summary: `推进到「${nextColumnName}」待审批`,
      tone: "attention",
    };
  }

  if (incompleteTracks.length > 0) {
    return {
      allowed: false,
      detail: `待完成部门：${incompleteTracks.map((track) => track.departmentName).join("、")}`,
      nextColumnId,
      nextColumnName,
      nextStatus,
      summary: `推进到「${nextColumnName}」待协同完成`,
      tone: "attention",
    };
  }

  return {
    allowed: false,
    detail: stageDecision.reason ?? "请检查阶段配置与审批规则。",
    nextColumnId,
    nextColumnName,
    nextStatus,
    summary: `当前不可推进到「${nextColumnName}」`,
    tone: "blocked",
  };
};

export const getProjectMoveDecision = (project: BoardProjectRecord, targetStatus: string) => {
  if (project.status === targetStatus) {
    return { message: "项目已处于目标阶段", ok: true } as const;
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
    message: decision.allowed ? "阶段迁移成功" : decision.reason,
    ok: decision.allowed,
  } as const;
};

const sortCards = (cards: BoardProjectCard[]) =>
  [...cards].toSorted(
    (left, right) =>
      STAGE_TONE_SORT_WEIGHT[left.stageAdvance.tone] -
        STAGE_TONE_SORT_WEIGHT[right.stageAdvance.tone] ||
      SLA_SORT_WEIGHT[left.slaRisk] - SLA_SORT_WEIGHT[right.slaRisk] ||
      right.overdueTaskCount - left.overdueTaskCount ||
      right.pendingApprovalCount - left.pendingApprovalCount ||
      PRIORITY_SORT_WEIGHT[left.priority] - PRIORITY_SORT_WEIGHT[right.priority] ||
      left.name.localeCompare(right.name, "zh-Hans-CN"),
  );

export const buildBoardViewData = (projects: BoardProjectRecord[], filters: BoardFilterState) => {
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
    filtered = filtered.filter((project) => getApprovalStatus(project) === filters.approvalStatus);
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
    cards: sortCards(cards.filter((project) => project.status === column.projectStatus)),
    entryCriteria: column.entryCriteria,
    exitCriteria: column.exitCriteria,
    id: column.id,
    name: column.name,
    projectStatus: column.projectStatus,
  }));

  const ownerOptions = [...new Set(projects.map((project) => project.ownerName))]
    .toSorted()
    .map((owner) => ({ label: owner, value: owner }));

  const customerOptions = [...new Set(projects.map((project) => project.customerName))]
    .toSorted()
    .map((customer) => ({ label: customer, value: customer }));

  const departmentOptions = [
    ...new Set(
      projects.flatMap((project) => project.departmentTracks.map((track) => track.departmentName)),
    ),
  ]
    .toSorted()
    .map((department) => ({ label: department, value: department }));

  const templateTypeOptions = [...new Set(projects.map((project) => project.templateType))]
    .toSorted()
    .map((templateType) => ({ label: templateType, value: templateType }));

  return {
    columns,
    customerOptions,
    departmentOptions,
    ownerOptions,
    templateTypeOptions,
    totalProjectCount: projects.length,
    visibleProjectCount: filtered.length,
  } as const;
};
