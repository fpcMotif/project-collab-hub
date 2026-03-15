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
export const DEPT_STATUS_STYLES: Record<DeptTrackStatus, { bg: string; text: string }> = {
  not_required: { bg: "bg-gray-100", text: "text-gray-500" },
  not_started: { bg: "bg-slate-100", text: "text-slate-600" },
  in_progress: { bg: "bg-blue-100", text: "text-blue-700" },
  blocked: { bg: "bg-red-100", text: "text-red-700" },
  waiting_approval: { bg: "bg-amber-100", text: "text-amber-700" },
  done: { bg: "bg-green-100", text: "text-green-700" },
} as const;

export const DEPT_STATUS_LABELS: Record<DeptTrackStatus, string> = {
  not_required: "无需参与",
  not_started: "未开始",
  in_progress: "进行中",
  blocked: "已阻塞",
  waiting_approval: "待审批",
  done: "已完成",
} as const;

// ── Priority styles ─────────────────────────────────────────────────
export const PRIORITY_STYLES: Record<Priority, string> = {
  urgent: "bg-red-600 text-white",
  high: "bg-orange-100 text-orange-700 ring-1 ring-orange-300",
  medium: "bg-blue-50 text-blue-600",
  low: "bg-gray-50 text-gray-500",
} as const;

export const PRIORITY_LABELS: Record<Priority, string> = {
  urgent: "紧急",
  high: "高",
  medium: "中",
  low: "低",
} as const;

// ── SLA risk styles ─────────────────────────────────────────────────
export const SLA_RISK_STYLES: Record<SlaRisk, { dot: string; text: string; label: string }> = {
  on_time: { dot: "bg-green-500", text: "text-green-700", label: "按时" },
  at_risk: { dot: "bg-amber-500", text: "text-amber-700", label: "风险" },
  overdue: { dot: "bg-red-500", text: "text-red-700", label: "逾期" },
} as const;

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatusFilter, string> = {
  pending: "待审批",
  clear: "已放行",
} as const;

export const OVERDUE_STATUS_LABELS: Record<OverdueStatusFilter, string> = {
  overdue: "有逾期",
  normal: "无逾期",
} as const;

// ── Filter option lists ─────────────────────────────────────────────
export const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "urgent", label: "紧急" },
  { value: "high", label: "高" },
  { value: "medium", label: "中" },
  { value: "low", label: "低" },
];

export const SLA_RISK_OPTIONS: { value: SlaRisk; label: string }[] = [
  { value: "on_time", label: "按时" },
  { value: "at_risk", label: "风险" },
  { value: "overdue", label: "逾期" },
];

export const APPROVAL_STATUS_OPTIONS: {
  value: ApprovalStatusFilter;
  label: string;
}[] = [
  { value: "pending", label: "待审批" },
  { value: "clear", label: "已放行" },
];

export const OVERDUE_STATUS_OPTIONS: {
  value: OverdueStatusFilter;
  label: string;
}[] = [
  { value: "overdue", label: "有逾期" },
  { value: "normal", label: "无逾期" },
];
