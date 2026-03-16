import type { BoardColumnId, ProjectStatus } from "@collab-hub/shared";

export type Priority = "low" | "medium" | "high" | "urgent";

export type DeptTrackStatus =
  | "not_required"
  | "not_started"
  | "in_progress"
  | "blocked"
  | "waiting_approval"
  | "done";

export type SlaRisk = "on_time" | "at_risk" | "overdue";
export type ApprovalStatusFilter = "pending" | "clear";
export type OverdueStatusFilter = "overdue" | "normal";

export interface DepartmentTrackSummary {
  departmentName: string;
  status: DeptTrackStatus;
  blockReason?: string;
}

export type StageAdvanceTone = "ready" | "attention" | "blocked" | "terminal";

export interface StageAdvanceState {
  nextStatus: ProjectStatus | null;
  nextColumnId: BoardColumnId | null;
  nextColumnName: string | null;
  allowed: boolean;
  tone: StageAdvanceTone;
  summary: string;
  detail: string;
}

/**
 * Raw board projection before UI-only derived state is attached.
 * This shape is intentionally close to the eventual Convex aggregation result.
 */
export interface BoardProjectRecord {
  id: string;
  name: string;
  customerName: string;
  ownerName: string;
  status: ProjectStatus;
  priority: Priority;
  slaRisk: SlaRisk;
  templateType: string;
  departmentTracks: DepartmentTrackSummary[];
  pendingApprovalCount: number;
  overdueTaskCount: number;
}

export interface BoardProjectCard extends BoardProjectRecord {
  currentStageName: string;
  stageAdvance: StageAdvanceState;
}

export interface BoardColumnViewModel {
  id: BoardColumnId;
  name: string;
  projectStatus: ProjectStatus;
  entryCriteria: string;
  exitCriteria: string;
  cards: BoardProjectCard[];
}

export interface BoardMoveResult {
  ok: boolean;
  message?: string;
}

export interface BoardFilterState {
  priority: Priority | null;
  slaRisk: SlaRisk | null;
  owner: string | null;
  customer: string | null;
  department: string | null;
  approvalStatus: ApprovalStatusFilter | null;
  overdueStatus: OverdueStatusFilter | null;
  templateType: string | null;
}

export interface BoardSavedView {
  id: string;
  name: string;
  filters: BoardFilterState;
}
