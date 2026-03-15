"use client";

import { useState } from "react";
import { useBoardFilters } from "../hooks/useBoardFilters";
import { useBoardData } from "../hooks/useBoardData";
import { BoardColumn } from "./BoardColumn";
import { FilterBar } from "./filters/FilterBar";

export function Board() {
  const { filters, setFilter, clearFilter, clearAll } = useBoardFilters();
  const { columns, ownerOptions, customerOptions } = useBoardData(filters);

  // Mobile: single-column selector
  const [mobileColumnIdx, setMobileColumnIdx] = useState(0);

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Filter bar */}
      <FilterBar
        filters={filters}
        ownerOptions={ownerOptions}
        customerOptions={customerOptions}
        onFilterChange={setFilter}
        onClearFilter={clearFilter}
        onClearAll={clearAll}
      />

      {/* Mobile column selector */}
      <div className="md:hidden">
        <select
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700"
          value={mobileColumnIdx}
          onChange={(e) => setMobileColumnIdx(Number(e.target.value))}
        >
          {columns.map((col, idx) => (
            <option key={col.id} value={idx}>
              {col.name} ({col.cards.length})
            </option>
          ))}
        </select>
      </div>

      {/* Desktop: horizontal scroll of all columns */}
      <div className="hidden flex-1 gap-3 overflow-x-auto pb-2 md:flex">
        {columns.map((col) => (
          <BoardColumn
            key={col.id}
            columnId={col.id}
            columnName={col.name}
            cards={col.cards}
          />
        ))}
      </div>

      {/* Mobile: single column view */}
      <div className="flex-1 md:hidden">
        {columns[mobileColumnIdx] && (
          <BoardColumn
            columnId={columns[mobileColumnIdx].id}
            columnName={columns[mobileColumnIdx].name}
            cards={columns[mobileColumnIdx].cards}
          />
        )}
      </div>
    </div>
  );
}
