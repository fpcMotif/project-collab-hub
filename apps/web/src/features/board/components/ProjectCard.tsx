import Link from "next/link";
import { cn } from "@/lib/cn";
import type { BoardProjectCard } from "../types";
import { PriorityBadge } from "./PriorityBadge";
import { DepartmentChip } from "./DepartmentChip";
import { SlaRiskIndicator } from "./SlaRiskIndicator";
import { CardMetaRow } from "./CardMetaRow";
import { StageAdvanceHint } from "./StageAdvanceHint";

interface ProjectCardProps {
  card: BoardProjectCard;
  draggable?: boolean;
  isMoving?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export function ProjectCard({
  card,
  draggable = false,
  isMoving = false,
  onDragStart,
  onDragEnd,
}: ProjectCardProps) {
  return (
    <article
      className={cn(
        "rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md",
        draggable && "cursor-grab active:cursor-grabbing",
        isMoving && "opacity-60",
      )}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
          {card.currentStageName}
        </span>
        <div className="flex items-center gap-2">
          {draggable && (
            <span className="text-xs text-gray-400" aria-hidden="true">
              ⋮⋮
            </span>
          )}
          <PriorityBadge priority={card.priority} />
        </div>
      </div>

      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-gray-900">{card.name}</h3>
        <Link
          href={`/projects/${card.id}`}
          className="shrink-0 rounded-md border border-gray-200 px-2 py-1 text-[11px] font-medium text-gray-600 hover:border-blue-300 hover:text-blue-700"
          onDragStart={(event) => event.preventDefault()}
        >
          详情
        </Link>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
        <span title="客户">{card.customerName}</span>
        <span aria-hidden="true">·</span>
        <span title="负责人">{card.ownerName}</span>
        <span aria-hidden="true">·</span>
        <span title="模板">{card.templateType}</span>
      </div>

      <div className="mb-3 flex flex-wrap gap-1">
        {card.departmentTracks
          .filter((track) => track.status !== "not_required")
          .map((track) => (
            <DepartmentChip key={track.departmentName} track={track} />
          ))}
      </div>

      <div className="mb-3 flex items-center justify-between gap-3">
        <CardMetaRow
          pendingApprovalCount={card.pendingApprovalCount}
          overdueTaskCount={card.overdueTaskCount}
        />
        <SlaRiskIndicator risk={card.slaRisk} />
      </div>

      <StageAdvanceHint stageAdvance={card.stageAdvance} />
    </article>
  );
}
