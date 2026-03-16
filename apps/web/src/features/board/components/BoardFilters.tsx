"use client";

import { type BoardFilters, type BoardResponse, type SavedView } from "../types";

type Props = {
  options: BoardResponse["options"];
  filters: BoardFilters;
  onChange: (next: BoardFilters) => void;
  savedViews: SavedView[];
  onSaveView: (name: string) => void;
  onApplyView: (id: string) => void;
};

const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
const APPROVALS = ["pending", "approved", "rejected"] as const;

function toggle<T extends string>(current: T[], value: T) {
  return current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value];
}

export function BoardFiltersPanel({
  options,
  filters,
  onChange,
  savedViews,
  onSaveView,
  onApplyView,
}: Props) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          className="rounded border border-zinc-300 px-2 py-1 text-sm"
          placeholder="视图名称"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              const value = event.currentTarget.value.trim();
              if (!value) return;
              onSaveView(value);
              event.currentTarget.value = "";
            }
          }}
        />
        <span className="text-xs text-zinc-500">回车保存当前过滤视图</span>
        <select
          className="rounded border border-zinc-300 px-2 py-1 text-sm"
          defaultValue=""
          onChange={(event) => {
            if (!event.target.value) return;
            onApplyView(event.target.value);
          }}
        >
          <option value="">选择已保存视图</option>
          {savedViews.map((view) => (
            <option key={view.id} value={view.id}>
              {view.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <FilterGroup
          title="Department"
          values={options.departments}
          selected={filters.departments}
          onToggle={(value) =>
            onChange({ ...filters, departments: toggle(filters.departments, value) })
          }
        />
        <FilterGroup
          title="Owner"
          values={options.owners}
          selected={filters.owners}
          onToggle={(value) =>
            onChange({ ...filters, owners: toggle(filters.owners, value) })
          }
        />
        <FilterGroup
          title="Priority"
          values={[...PRIORITIES]}
          selected={filters.priorities}
          onToggle={(value) =>
            onChange({ ...filters, priorities: toggle(filters.priorities, value) })
          }
        />
        <FilterGroup
          title="Approval"
          values={[...APPROVALS]}
          selected={filters.approvalStatuses}
          onToggle={(value) =>
            onChange({
              ...filters,
              approvalStatuses: toggle(filters.approvalStatuses, value),
            })
          }
        />
        <FilterGroup
          title="Customer"
          values={options.customers}
          selected={filters.customers}
          onToggle={(value) =>
            onChange({ ...filters, customers: toggle(filters.customers, value) })
          }
        />
        <FilterGroup
          title="Template"
          values={options.templateTypes}
          selected={filters.templateTypes}
          onToggle={(value) =>
            onChange({ ...filters, templateTypes: toggle(filters.templateTypes, value) })
          }
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filters.overdueOnly}
            onChange={(event) =>
              onChange({ ...filters, overdueOnly: event.target.checked })
            }
          />
          仅看逾期项目
        </label>
      </div>
    </section>
  );
}

function FilterGroup({
  title,
  values,
  selected,
  onToggle,
}: {
  title: string;
  values: readonly string[];
  selected: readonly string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-zinc-500">{title}</p>
      <div className="flex flex-wrap gap-1">
        {values.map((value) => {
          const active = selected.includes(value);
          return (
            <button
              key={value}
              type="button"
              className={`rounded-full border px-2 py-1 text-xs ${
                active
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-zinc-300 text-zinc-600"
              }`}
              onClick={() => onToggle(value)}
            >
              {value}
            </button>
          );
        })}
      </div>
    </div>
  );
}
