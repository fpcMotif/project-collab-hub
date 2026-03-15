import type { BoardFilterState, Priority, SlaRisk } from "../../types";
import { PRIORITY_OPTIONS, SLA_RISK_OPTIONS } from "../../constants";
import { FilterSelect } from "./FilterSelect";
import { ActiveFilterTags } from "./ActiveFilterTags";

interface FilterBarProps {
  filters: BoardFilterState;
  ownerOptions: { value: string; label: string }[];
  customerOptions: { value: string; label: string }[];
  onFilterChange: <K extends keyof BoardFilterState>(key: K, value: BoardFilterState[K]) => void;
  onClearFilter: (key: keyof BoardFilterState) => void;
  onClearAll: () => void;
}

export function FilterBar({
  filters,
  ownerOptions,
  customerOptions,
  onFilterChange,
  onClearFilter,
  onClearAll,
}: FilterBarProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <FilterSelect
          label="优先级"
          value={filters.priority}
          options={PRIORITY_OPTIONS}
          onChange={(v) => onFilterChange("priority", v as Priority | null)}
        />
        <FilterSelect
          label="SLA"
          value={filters.slaRisk}
          options={SLA_RISK_OPTIONS}
          onChange={(v) => onFilterChange("slaRisk", v as SlaRisk | null)}
        />
        <FilterSelect
          label="负责人"
          value={filters.owner}
          options={ownerOptions}
          onChange={(v) => onFilterChange("owner", v)}
        />
        <FilterSelect
          label="客户"
          value={filters.customer}
          options={customerOptions}
          onChange={(v) => onFilterChange("customer", v)}
        />
      </div>
      <ActiveFilterTags filters={filters} onClear={onClearFilter} onClearAll={onClearAll} />
    </div>
  );
}
