import {
  APPROVAL_STATUS_OPTIONS,
  OVERDUE_STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  SLA_RISK_OPTIONS,
} from "../../constants";
import type {
  ApprovalStatusFilter,
  BoardFilterState,
  OverdueStatusFilter,
  Priority,
  SlaRisk,
} from "../../types";
import { ActiveFilterTags } from "./active-filter-tags";
import { FilterSelect } from "./filter-select";

interface FilterBarProps {
  filters: BoardFilterState;
  ownerOptions: { value: string; label: string }[];
  customerOptions: { value: string; label: string }[];
  departmentOptions: { value: string; label: string }[];
  templateTypeOptions: { value: string; label: string }[];
  onFilterChange: <K extends keyof BoardFilterState>(
    key: K,
    value: BoardFilterState[K]
  ) => void;
  onClearFilter: (key: keyof BoardFilterState) => void;
  onClearAll: () => void;
}

export function FilterBar({
  filters,
  ownerOptions,
  customerOptions,
  departmentOptions,
  templateTypeOptions,
  onFilterChange,
  onClearFilter,
  onClearAll,
}: FilterBarProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <FilterSelect
          label="部门"
          value={filters.department}
          options={departmentOptions}
          onChange={(value) => onFilterChange("department", value)}
        />
        <FilterSelect
          label="负责人"
          value={filters.owner}
          options={ownerOptions}
          onChange={(value) => onFilterChange("owner", value)}
        />
        <FilterSelect
          label="优先级"
          value={filters.priority}
          options={PRIORITY_OPTIONS}
          onChange={(value) =>
            onFilterChange("priority", value as Priority | null)
          }
        />
        <FilterSelect
          label="审批"
          value={filters.approvalStatus}
          options={APPROVAL_STATUS_OPTIONS}
          onChange={(value) =>
            onFilterChange(
              "approvalStatus",
              value as ApprovalStatusFilter | null
            )
          }
        />
        <FilterSelect
          label="逾期"
          value={filters.overdueStatus}
          options={OVERDUE_STATUS_OPTIONS}
          onChange={(value) =>
            onFilterChange("overdueStatus", value as OverdueStatusFilter | null)
          }
        />
        <FilterSelect
          label="SLA"
          value={filters.slaRisk}
          options={SLA_RISK_OPTIONS}
          onChange={(value) =>
            onFilterChange("slaRisk", value as SlaRisk | null)
          }
        />
        <FilterSelect
          label="客户"
          value={filters.customer}
          options={customerOptions}
          onChange={(value) => onFilterChange("customer", value)}
        />
        <FilterSelect
          label="模板"
          value={filters.templateType}
          options={templateTypeOptions}
          onChange={(value) => onFilterChange("templateType", value)}
        />
      </div>
      <ActiveFilterTags
        filters={filters}
        onClear={onClearFilter}
        onClearAll={onClearAll}
      />
    </div>
  );
}
