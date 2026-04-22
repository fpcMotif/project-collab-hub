import { useMemo, useState } from "react";

import type {
  BoardColumnViewModel,
  BoardFilterState,
  BoardMoveResult,
  BoardSavedView,
} from "../types";
import { BoardColumn } from "./board-column";
import { FilterBar } from "./filters/filter-bar";
import { SavedViewsBar } from "./filters/saved-views-bar";

interface BoardWorkspaceProps {
  columns: BoardColumnViewModel[];
  ownerOptions: { value: string; label: string }[];
  customerOptions: { value: string; label: string }[];
  departmentOptions: { value: string; label: string }[];
  templateTypeOptions: { value: string; label: string }[];
  totalProjectCount: number;
  visibleProjectCount: number;
  filters: BoardFilterState;
  savedViews: BoardSavedView[];
  isLoading: boolean;
  movingProjectId: string | null;
  onFilterChange: <K extends keyof BoardFilterState>(
    key: K,
    value: BoardFilterState[K]
  ) => void;
  onApplyView: (filters: BoardFilterState) => void;
  onClearFilter: (key: keyof BoardFilterState) => void;
  onClearAll: () => void;
  onSaveCurrentView: (name: string) => boolean;
  onDeleteView: (id: string) => void;
  onMoveProject: (
    projectId: string,
    targetColumnId: string
  ) => Promise<BoardMoveResult>;
}

interface BoardNotice {
  tone: "success" | "error";
  message: string;
}

export const BoardWorkspace = ({
  columns,
  ownerOptions,
  customerOptions,
  departmentOptions,
  templateTypeOptions,
  totalProjectCount,
  visibleProjectCount,
  filters,
  savedViews,
  isLoading,
  movingProjectId,
  onFilterChange,
  onApplyView,
  onClearFilter,
  onClearAll,
  onSaveCurrentView,
  onDeleteView,
  onMoveProject,
}: BoardWorkspaceProps) => {
  const [mobileColumnIdx, setMobileColumnIdx] = useState(0);
  const [draggedProjectId, setDraggedProjectId] = useState<string | null>(null);
  const [dropTargetColumnId, setDropTargetColumnId] = useState<string | null>(
    null
  );
  const [notice, setNotice] = useState<BoardNotice | null>(null);

  const safeMobileColumnIdx = useMemo(() => {
    if (columns.length === 0) {
      return 0;
    }
    return Math.min(mobileColumnIdx, columns.length - 1);
  }, [columns.length, mobileColumnIdx]);

  const resetDragState = () => {
    setDraggedProjectId(null);
    setDropTargetColumnId(null);
  };

  const handleDropOnColumn = async (columnId: string) => {
    if (!draggedProjectId) {
      return;
    }

    const result = await onMoveProject(draggedProjectId, columnId);
    setNotice({
      message: result.message ?? "操作完成",
      tone: result.ok ? "success" : "error",
    });
    resetDragState();
  };

  if (isLoading) {
    return (
      <div className="flex h-full gap-3 overflow-x-auto">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="min-w-[280px] animate-pulse rounded-xl bg-gray-50 p-4"
          >
            <div className="mb-4 h-4 w-24 rounded bg-gray-200" />
            <div className="space-y-3">
              <div className="h-36 rounded-lg bg-gray-200" />
              <div className="h-36 rounded-lg bg-gray-200" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-col gap-2">
        <FilterBar
          filters={filters}
          ownerOptions={ownerOptions}
          customerOptions={customerOptions}
          departmentOptions={departmentOptions}
          templateTypeOptions={templateTypeOptions}
          onFilterChange={onFilterChange}
          onClearFilter={onClearFilter}
          onClearAll={onClearAll}
        />
        <SavedViewsBar
          savedViews={savedViews}
          activeFilters={filters}
          onApplyView={onApplyView}
          onSaveCurrentView={onSaveCurrentView}
          onDeleteView={onDeleteView}
        />
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
          <p>
            当前显示 {visibleProjectCount} / {totalProjectCount} 个项目
          </p>
          <p>桌面端支持拖拽卡片到下一列推进阶段</p>
        </div>
        {notice && (
          <div
            className={
              notice.tone === "success"
                ? "rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700"
                : "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            }
          >
            {notice.message}
          </div>
        )}
      </div>

      <div className="md:hidden">
        <select
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700"
          value={safeMobileColumnIdx}
          onChange={(event) => setMobileColumnIdx(Number(event.target.value))}
        >
          {columns.map((column, index) => (
            <option key={column.id} value={index}>
              {column.name} ({column.cards.length})
            </option>
          ))}
        </select>
      </div>

      <div className="hidden flex-1 gap-3 overflow-x-auto pb-2 md:flex">
        {columns.map((column) => (
          <BoardColumn
            key={column.id}
            column={column}
            dropActive={dropTargetColumnId === column.id}
            movingProjectId={movingProjectId}
            onDragOver={(event) => {
              event.preventDefault();
              setDropTargetColumnId(column.id);
            }}
            onDragLeave={() => {
              if (dropTargetColumnId === column.id) {
                setDropTargetColumnId(null);
              }
            }}
            onDrop={() => {
              handleDropOnColumn(column.id);
            }}
            onCardDragStart={setDraggedProjectId}
            onCardDragEnd={resetDragState}
          />
        ))}
      </div>

      <div className="flex-1 md:hidden">
        {columns[safeMobileColumnIdx] && (
          <BoardColumn
            column={columns[safeMobileColumnIdx]}
            dropActive={false}
            movingProjectId={movingProjectId}
          />
        )}
      </div>
    </div>
  );
};
