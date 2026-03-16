import type { DragEventHandler } from "react";

import { cn } from "@/lib/cn";

import type { BoardColumnViewModel } from "../types";
import { ProjectCard } from "./ProjectCard";

interface BoardColumnProps {
  column: BoardColumnViewModel;
  dropActive?: boolean;
  movingProjectId?: string | null;
  onDragOver?: DragEventHandler<HTMLElement>;
  onDragLeave?: DragEventHandler<HTMLElement>;
  onDrop?: DragEventHandler<HTMLElement>;
  onCardDragStart?: (projectId: string) => void;
  onCardDragEnd?: () => void;
}

export function BoardColumn({
  column,
  dropActive = false,
  movingProjectId = null,
  onDragOver,
  onDragLeave,
  onDrop,
  onCardDragStart,
  onCardDragEnd,
}: BoardColumnProps) {
  return (
    <section
      className={cn(
        "flex min-w-[280px] flex-col rounded-xl bg-gray-50 p-2 transition-colors",
        dropActive && "ring-2 ring-blue-300 ring-offset-2 ring-offset-gray-100"
      )}
      aria-label={column.name}
      data-column-id={column.id}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold text-gray-700">{column.name}</h2>
        <span
          className={cn(
            "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-medium",
            column.cards.length > 0
              ? "bg-blue-100 text-blue-700"
              : "bg-gray-200 text-gray-500"
          )}
        >
          {column.cards.length}
        </span>
      </div>

      <div className="mb-3 rounded-lg border border-white/70 bg-white/70 px-2 py-2 text-[11px] leading-4 text-gray-500">
        <p>
          <span className="font-semibold text-gray-600">入口：</span>
          {column.entryCriteria}
        </p>
        <p className="mt-1">
          <span className="font-semibold text-gray-600">出口：</span>
          {column.exitCriteria}
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
        {column.cards.map((card) => (
          <ProjectCard
            key={card.id}
            card={card}
            draggable={Boolean(onCardDragStart)}
            isMoving={movingProjectId === card.id}
            onDragStart={() => onCardDragStart?.(card.id)}
            onDragEnd={onCardDragEnd}
          />
        ))}
        {column.cards.length === 0 && (
          <p className="py-8 text-center text-xs text-gray-400">暂无项目</p>
        )}
      </div>
    </section>
  );
}
