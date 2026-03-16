import {
  APPROVAL_STATUS_LABELS,
  OVERDUE_STATUS_LABELS,
  PRIORITY_LABELS,
  SLA_RISK_STYLES,
} from "../../constants";
import type {
  ApprovalStatusFilter,
  BoardFilterState,
  OverdueStatusFilter,
  Priority,
  SlaRisk,
} from "../../types";

interface ActiveFilterTagsProps {
  filters: BoardFilterState;
  onClear: (key: keyof BoardFilterState) => void;
  onClearAll: () => void;
}

const FILTER_LABELS: Record<keyof BoardFilterState, string> = {
  approvalStatus: "审批",
  customer: "客户",
  department: "部门",
  overdueStatus: "逾期",
  owner: "负责人",
  priority: "优先级",
  slaRisk: "SLA",
  templateType: "模板",
};

const formatFilterValue = <K extends keyof BoardFilterState>(
  key: K,
  value: NonNullable<BoardFilterState[K]>
): string => {
  switch (key) {
    case "priority": {
      return PRIORITY_LABELS[value as Priority];
    }
    case "slaRisk": {
      return SLA_RISK_STYLES[value as SlaRisk].label;
    }
    case "approvalStatus": {
      return APPROVAL_STATUS_LABELS[value as ApprovalStatusFilter];
    }
    case "overdueStatus": {
      return OVERDUE_STATUS_LABELS[value as OverdueStatusFilter];
    }
    default: {
      return value;
    }
  }
};

export const ActiveFilterTags = ({
  filters,
  onClear,
  onClearAll,
}: ActiveFilterTagsProps) => {
  const activeKeys = (
    Object.keys(filters) as (keyof BoardFilterState)[]
  ).filter((key) => filters[key] !== null);

  if (activeKeys.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {activeKeys.map((key) => {
        const value = filters[key];
        if (value === null) {
          return null;
        }

        return (
          <span
            key={key}
            className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
          >
            {FILTER_LABELS[key]}: {formatFilterValue(key, value)}
            <button
              type="button"
              onClick={() => onClear(key)}
              className="ml-0.5 rounded-full p-0.5 hover:bg-blue-200"
              aria-label={`清除${FILTER_LABELS[key]}筛选`}
            >
              <svg
                className="h-3 w-3"
                viewBox="0 0 12 12"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M3.17 3.17a.75.75 0 011.06 0L6 4.94l1.77-1.77a.75.75 0 111.06 1.06L7.06 6l1.77 1.77a.75.75 0 11-1.06 1.06L6 7.06 4.23 8.83a.75.75 0 01-1.06-1.06L4.94 6 3.17 4.23a.75.75 0 010-1.06z" />
              </svg>
            </button>
          </span>
        );
      })}
      {activeKeys.length > 1 && (
        <button
          type="button"
          onClick={onClearAll}
          className="text-xs text-gray-500 underline hover:text-gray-700"
        >
          清除全部
        </button>
      )}
    </div>
  );
};
