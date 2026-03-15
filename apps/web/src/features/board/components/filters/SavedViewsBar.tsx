"use client";

import type { BoardFilterState, BoardSavedView } from "../../types";

interface SavedViewsBarProps {
  savedViews: BoardSavedView[];
  activeFilters: BoardFilterState;
  onApplyView: (filters: BoardFilterState) => void;
  onSaveCurrentView: () => void;
  onDeleteView: (id: string) => void;
}

function isSameFilterValue(left: BoardFilterState, right: BoardFilterState) {
  return (
    left.priority === right.priority &&
    left.slaRisk === right.slaRisk &&
    left.owner === right.owner &&
    left.customer === right.customer &&
    left.department === right.department &&
    left.approvalStatus === right.approvalStatus &&
    left.overdueStatus === right.overdueStatus &&
    left.templateType === right.templateType
  );
}

export function SavedViewsBar({
  savedViews,
  activeFilters,
  onApplyView,
  onSaveCurrentView,
  onDeleteView,
}: SavedViewsBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-gray-500">保存视图</span>
      <button
        type="button"
        onClick={onSaveCurrentView}
        className="rounded-full border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:border-blue-300 hover:text-blue-700"
      >
        保存当前筛选
      </button>
      {savedViews.map((view) => {
        const active = isSameFilterValue(activeFilters, view.filters);

        return (
          <span
            key={view.id}
            className={
              active
                ? "inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700"
                : "inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700"
            }
          >
            <button type="button" onClick={() => onApplyView(view.filters)}>
              {view.name}
            </button>
            <button
              type="button"
              onClick={() => onDeleteView(view.id)}
              className="rounded-full p-0.5 hover:bg-black/5"
              aria-label={`删除视图 ${view.name}`}
            >
              <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                <path d="M3.17 3.17a.75.75 0 011.06 0L6 4.94l1.77-1.77a.75.75 0 111.06 1.06L7.06 6l1.77 1.77a.75.75 0 11-1.06 1.06L6 7.06 4.23 8.83a.75.75 0 01-1.06-1.06L4.94 6 3.17 4.23a.75.75 0 010-1.06z" />
              </svg>
            </button>
          </span>
        );
      })}
      {savedViews.length === 0 && <span className="text-xs text-gray-400">暂无已保存视图</span>}
    </div>
  );
}
