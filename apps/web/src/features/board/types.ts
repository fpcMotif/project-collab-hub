import type { ProjectStatus } from "@collab-hub/shared";

export type Priority = "low" | "medium" | "high" | "urgent";

export type DeptTrackStatus =
  | "not_required"
  | "not_started"
  | "in_progress"
  | "blocked"
  | "waiting_approval"
  | "done";

export type SlaRisk = "on_time" | "at_risk" | "overdue";

export interface DepartmentTrackSummary {
  departmentName: string;
  status: DeptTrackStatus;
}

export interface BoardProjectCard {
  id: string;
  name: string;
  customerName: string;
  ownerName: string;
  status: ProjectStatus;
  priority: Priority;
  slaRisk: SlaRisk;
  departmentTracks: DepartmentTrackSummary[];
  pendingApprovalCount: number;
  overdueTaskCount: number;
}

export interface BoardFilterState {
  priority: Priority | null;
  slaRisk: SlaRisk | null;
  owner: string | null;
  customer: string | null;
}
