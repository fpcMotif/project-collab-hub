import { cn } from "@/lib/cn";
import type { BoardProjectCard } from "../types";
import { ProjectCard } from "./ProjectCard";

interface BoardColumnProps {
  columnId: string;
  columnName: string;
  cards: BoardProjectCard[];
}

export function BoardColumn({ columnId, columnName, cards }: BoardColumnProps) {
  return (
    <section
      className="flex min-w-[260px] flex-col rounded-xl bg-gray-50 p-2"
      aria-label={columnName}
      data-column-id={columnId}
    >
      {/* Column header */}
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold text-gray-700">{columnName}</h2>
        <span
          className={cn(
            "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-medium",
            cards.length > 0 ? "bg-blue-100 text-blue-700" : "bg-gray-200 text-gray-500",
          )}
        >
          {cards.length}
        </span>
      </div>

      {/* Card list */}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
        {cards.map((card) => (
          <ProjectCard key={card.id} card={card} />
        ))}
        {cards.length === 0 && (
          <p className="py-8 text-center text-xs text-gray-400">暂无项目</p>
        )}
      </div>
    </section>
  );
}
