import { useMemo } from "react";
import { BOARD_COLUMNS, canAdvanceStage, getNextProjectStatus } from "../constants";
import { MOCK_PROJECTS } from "../mock-data";
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

function getColumnNameByStatus(status: string | null) {
  return BOARD_COLUMNS.find((column) => column.projectStatus === status)?.name ?? null;
}

function formatBlockedDepartments(blockedTracks: DepartmentTrackSummary[]): string {
  return blockedTracks
    .map((track) =>
      track.blockReason
        ? `${track.departmentName}（${track.blockReason}）`
        : track.departmentName,
    )
    .join("、");
}

function getApprovalStatus(project: BoardProjectRecord): ApprovalStatusFilter {
  return project.pendingApprovalCount > 0 ? "pending" : "clear";
}

function getOverdueStatus(project: BoardProjectRecord): OverdueStatusFilter {
  return project.overdueTaskCount > 0 ? "overdue" : "normal";
}

function buildStageAdvanceState(project: BoardProjectRecord): StageAdvanceState {
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

function sortCards(cards: BoardProjectCard[]): BoardProjectCard[] {
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

/**
 * Single swap-point for the board projection data source.
 * Currently derives a UI view model from mock data; later this can be swapped
 * for a Convex query that returns the same shape.
 */
export function useBoardData(filters: BoardFilterState) {
  const filtered = useMemo(() => {
    let result = MOCK_PROJECTS;

    if (filters.department) {
      result = result.filter((project) =>
        project.departmentTracks.some((track) => track.departmentName === filters.department),
      );
    }
    if (filters.owner) {
      result = result.filter((project) => project.ownerName === filters.owner);
    }
    if (filters.priority) {
      result = result.filter((project) => project.priority === filters.priority);
    }
    if (filters.approvalStatus) {
      result = result.filter(
        (project) => getApprovalStatus(project) === filters.approvalStatus,
      );
    }
    if (filters.overdueStatus) {
      result = result.filter((project) => getOverdueStatus(project) === filters.overdueStatus);
    }
    if (filters.slaRisk) {
      result = result.filter((project) => project.slaRisk === filters.slaRisk);
    }
    if (filters.customer) {
      result = result.filter((project) => project.customerName === filters.customer);
    }
    if (filters.templateType) {
      result = result.filter((project) => project.templateType === filters.templateType);
    }

    return result;
  }, [filters]);

  const enrichedCards = useMemo(
    () =>
      filtered.map((project) => ({
        ...project,
        currentStageName: getColumnNameByStatus(project.status) ?? project.status,
        stageAdvance: buildStageAdvanceState(project),
      })),
    [filtered],
  );

  const columns = useMemo<BoardColumnViewModel[]>(
    () =>
      BOARD_COLUMNS.map((column) => ({
        id: column.id,
        name: column.name,
        entryCriteria: column.entryCriteria,
        exitCriteria: column.exitCriteria,
        cards: sortCards(
          enrichedCards.filter((project) => project.status === column.projectStatus),
        ),
      })),
    [enrichedCards],
  );

  const ownerOptions = useMemo(() => {
    const owners = [...new Set(MOCK_PROJECTS.map((project) => project.ownerName))].sort();
    return owners.map((owner) => ({ value: owner, label: owner }));
  }, []);

  const customerOptions = useMemo(() => {
    const customers = [...new Set(MOCK_PROJECTS.map((project) => project.customerName))].sort();
    return customers.map((customer) => ({ value: customer, label: customer }));
  }, []);

  const departmentOptions = useMemo(() => {
    const departments = [
      ...new Set(
        MOCK_PROJECTS.flatMap((project) =>
          project.departmentTracks.map((track) => track.departmentName),
        ),
      ),
    ].sort();

    return departments.map((department) => ({ value: department, label: department }));
  }, []);

  const templateTypeOptions = useMemo(() => {
    const templateTypes = [...new Set(MOCK_PROJECTS.map((project) => project.templateType))].sort();
    return templateTypes.map((templateType) => ({ value: templateType, label: templateType }));
  }, []);

  return {
    columns,
    ownerOptions,
    customerOptions,
    departmentOptions,
    templateTypeOptions,
    totalProjectCount: MOCK_PROJECTS.length,
    visibleProjectCount: filtered.length,
  } as const;
}
