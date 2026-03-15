import type { BoardProjectCard } from "../types";
import { PriorityBadge } from "./PriorityBadge";
import { DepartmentChip } from "./DepartmentChip";
import { SlaRiskIndicator } from "./SlaRiskIndicator";
import { CardMetaRow } from "./CardMetaRow";

interface ProjectCardProps {
  card: BoardProjectCard;
}

export function ProjectCard({ card }: ProjectCardProps) {
  return (
    <article className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md">
      {/* Header: name + priority */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold leading-snug text-gray-900 line-clamp-2">
          {card.name}
        </h3>
        <PriorityBadge priority={card.priority} />
      </div>

      {/* Customer + Owner */}
      <div className="mb-2 flex items-center gap-2 text-xs text-gray-500">
        <span title="客户">{card.customerName}</span>
        <span aria-hidden="true">·</span>
        <span title="负责人">{card.ownerName}</span>
      </div>

      {/* Department chips */}
      <div className="mb-2 flex flex-wrap gap-1">
        {card.departmentTracks
          .filter((t) => t.status !== "not_required")
          .map((track) => (
            <DepartmentChip key={track.departmentName} track={track} />
          ))}
      </div>

      {/* Footer: meta row + SLA */}
      <div className="flex items-center justify-between">
        <CardMetaRow
          pendingApprovalCount={card.pendingApprovalCount}
          overdueTaskCount={card.overdueTaskCount}
        />
        <SlaRiskIndicator risk={card.slaRisk} />
      </div>
    </article>
  );
}
