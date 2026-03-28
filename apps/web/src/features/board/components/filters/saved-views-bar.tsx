"use client";

import { useState } from "react";

import type { BoardFilterState, BoardSavedView } from "../../types";

interface SavedViewsBarProps {
  activeFilters: BoardFilterState;
  onApplyView: (filters: BoardFilterState) => void;
  onDeleteView: (id: string) => void;
  onSaveCurrentView: (name: string) => boolean;
  savedViews: BoardSavedView[];
}

const isSameFilterValue = (left: BoardFilterState, right: BoardFilterState) =>
  left.approvalStatus === right.approvalStatus &&
  left.customer === right.customer &&
  left.department === right.department &&
  left.overdueStatus === right.overdueStatus &&
  left.owner === right.owner &&
  left.priority === right.priority &&
  left.slaRisk === right.slaRisk &&
  left.templateType === right.templateType;

export const SavedViewsBar = ({
  activeFilters,
  onApplyView,
  onDeleteView,
  onSaveCurrentView,
  savedViews,
}: SavedViewsBarProps) => {
  const [draftName, setDraftName] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = () => {
    const didSave = onSaveCurrentView(draftName);
    if (!didSave) {
      return;
    }

    setDraftName("");
    setIsEditing(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-gray-500">保存视图</span>
      {isEditing ? (
        <div className="flex items-center gap-2">
          <input
            className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs text-gray-700"
            onChange={(event) => setDraftName(event.target.value)}
            placeholder="输入视图名称"
            value={draftName}
          />
          <button
            className="rounded-full border border-blue-300 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:border-blue-400"
            onClick={handleSave}
            type="button"
          >
            保存
          </button>
          <button
            className="rounded-full border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700"
            onClick={() => {
              setDraftName("");
              setIsEditing(false);
            }}
            type="button"
          >
            取消
          </button>
        </div>
      ) : (
        <button
          className="rounded-full border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:border-blue-300 hover:text-blue-700"
          onClick={() => setIsEditing(true)}
          type="button"
        >
          保存当前筛选
        </button>
      )}
      {savedViews.map((view) => {
        const active = isSameFilterValue(activeFilters, view.filters);

        return (
          <span
            className={
              active
                ? "inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700"
                : "inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700"
            }
            key={view.id}
          >
            <button onClick={() => onApplyView(view.filters)} type="button">
              {view.name}
            </button>
            <button
              aria-label={`删除视图 ${view.name}`}
              className="rounded-full p-0.5 hover:bg-black/5"
              onClick={() => onDeleteView(view.id)}
              type="button"
            >
              <svg
                aria-hidden="true"
                className="h-3 w-3"
                fill="currentColor"
                viewBox="0 0 12 12"
              >
                <path d="M3.17 3.17a.75.75 0 011.06 0L6 4.94l1.77-1.77a.75.75 0 111.06 1.06L7.06 6l1.77 1.77a.75.75 0 11-1.06 1.06L6 7.06 4.23 8.83a.75.75 0 01-1.06-1.06L4.94 6 3.17 4.23a.75.75 0 010-1.06z" />
              </svg>
            </button>
          </span>
        );
      })}
      {savedViews.length === 0 && (
        <span className="text-xs text-gray-400">暂无已保存视图</span>
      )}
    </div>
  );
};
