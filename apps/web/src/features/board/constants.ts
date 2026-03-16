import type {
  ApprovalStatusFilter,
  DeptTrackStatus,
  OverdueStatusFilter,
  Priority,
  SlaRisk,
} from "./types";

export {
  BOARD_COLUMNS,
  STAGE_TRANSITIONS,
  BOARD_FLOW_SEQUENCE,
  getNextProjectStatus,
  canAdvanceStage,
} from "@collab-hub/shared";

// ── Department track status colors ──────────────────────────────────
export const DEPT_STATUS_STYLES: Record<
  DeptTrackStatus,
  { bg: string; text: string }
> = {
  blocked: { bg: "bg-red-100", text: "text-red-700" },
  done: { bg: "bg-green-100", text: "text-green-700" },
  in_progress: { bg: "bg-blue-100", text: "text-blue-700" },
  not_required: { bg: "bg-gray-100", text: "text-gray-500" },
  not_started: { bg: "bg-slate-100", text: "text-slate-600" },
  waiting_approval: { bg: "bg-amber-100", text: "text-amber-700" },
} as const;

export const DEPT_STATUS_LABELS: Record<DeptTrackStatus, string> = {
  blocked: "已阻塞",
  done: "已完成",
  in_progress: "进行中",
  not_required: "无需参与",
  not_started: "未开始",
  waiting_approval: "待审批",
} as const;

// ── Priority styles ─────────────────────────────────────────────────
export const PRIORITY_STYLES: Record<Priority, string> = {
  high: "bg-orange-100 text-orange-700 ring-1 ring-orange-300",
  low: "bg-gray-50 text-gray-500",
  medium: "bg-blue-50 text-blue-600",
  urgent: "bg-red-600 text-white",
} as const;

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: "高",
  low: "低",
  medium: "中",
  urgent: "紧急",
} as const;

// ── SLA risk styles ─────────────────────────────────────────────────
export const SLA_RISK_STYLES: Record<
  SlaRisk,
  { dot: string; text: string; label: string }
> = {
  at_risk: { dot: "bg-amber-500", text: "text-amber-700", label: "风险" },
  on_time: { dot: "bg-green-500", text: "text-green-700", label: "按时" },
  overdue: { dot: "bg-red-500", text: "text-red-700", label: "逾期" },
} as const;

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatusFilter, string> = {
  clear: "已放行",
  pending: "待审批",
} as const;

export const OVERDUE_STATUS_LABELS: Record<OverdueStatusFilter, string> = {
  normal: "无逾期",
  overdue: "有逾期",
} as const;

// ── Filter option lists ─────────────────────────────────────────────
export const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { label: "紧急", value: "urgent" },
  { label: "高", value: "high" },
  { label: "中", value: "medium" },
  { label: "低", value: "low" },
];

export const SLA_RISK_OPTIONS: { value: SlaRisk; label: string }[] = [
  { label: "按时", value: "on_time" },
  { label: "风险", value: "at_risk" },
  { label: "逾期", value: "overdue" },
];

export const APPROVAL_STATUS_OPTIONS: {
  value: ApprovalStatusFilter;
  label: string;
}[] = [
  { label: "待审批", value: "pending" },
  { label: "已放行", value: "clear" },
];

export const OVERDUE_STATUS_OPTIONS: {
  value: OverdueStatusFilter;
  label: string;
}[] = [
  { label: "有逾期", value: "overdue" },
  { label: "无逾期", value: "normal" },
];
