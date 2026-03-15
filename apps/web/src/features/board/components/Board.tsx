"use client";

import { useCallback, useState } from "react";
import { useBoardFilters } from "../hooks/useBoardFilters";
import { useBoardData } from "../hooks/useBoardData";
import { useBoardSavedViews } from "../hooks/useBoardSavedViews";
import { BoardColumn } from "./BoardColumn";
import { FilterBar } from "./filters/FilterBar";
import { SavedViewsBar } from "./filters/SavedViewsBar";

export function Board() {
  const { filters, replaceFilters, setFilter, clearFilter, clearAll } = useBoardFilters();
  const {
    columns,
    ownerOptions,
    customerOptions,
    departmentOptions,
    templateTypeOptions,
    totalProjectCount,
    visibleProjectCount,
  } = useBoardData(filters);
  const { savedViews, saveView, deleteView } = useBoardSavedViews();

  const [mobileColumnIdx, setMobileColumnIdx] = useState(0);

  const handleSaveCurrentView = useCallback(() => {
    const name = window.prompt("请输入视图名称", "我的筛选视图");
    if (!name) {
      return;
    }

    saveView(name, filters);
  }, [filters, saveView]);

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-col gap-2">
        <FilterBar
          filters={filters}
          ownerOptions={ownerOptions}
          customerOptions={customerOptions}
          departmentOptions={departmentOptions}
          templateTypeOptions={templateTypeOptions}
          onFilterChange={setFilter}
          onClearFilter={clearFilter}
          onClearAll={clearAll}
        />
        <SavedViewsBar
          savedViews={savedViews}
          activeFilters={filters}
          onApplyView={replaceFilters}
          onSaveCurrentView={handleSaveCurrentView}
          onDeleteView={deleteView}
        />
        <p className="text-xs text-gray-500">
          当前显示 {visibleProjectCount} / {totalProjectCount} 个项目
        </p>
      </div>

      <div className="md:hidden">
        <select
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700"
          value={mobileColumnIdx}
          onChange={(event) => setMobileColumnIdx(Number(event.target.value))}
        >
          {columns.map((column, idx) => (
            <option key={column.id} value={idx}>
              {column.name} ({column.cards.length})
            </option>
          ))}
        </select>
      </div>

      <div className="hidden flex-1 gap-3 overflow-x-auto pb-2 md:flex">
        {columns.map((column) => (
          <BoardColumn key={column.id} column={column} />
        ))}
      </div>

      <div className="flex-1 md:hidden">
        {columns[mobileColumnIdx] && <BoardColumn column={columns[mobileColumnIdx]} />}
      </div>
    </div>
  );
}
