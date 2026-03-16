import { cn } from "@/lib/cn";

import { DEPT_STATUS_STYLES, DEPT_STATUS_LABELS } from "../constants";
import type { DepartmentTrackSummary } from "../types";

interface DepartmentChipProps {
  track: DepartmentTrackSummary;
}

export const DepartmentChip = ({ track }: DepartmentChipProps) => {
  const style = DEPT_STATUS_STYLES[track.status];
  const label = DEPT_STATUS_LABELS[track.status];
  const title = track.blockReason
    ? `${track.departmentName}: ${label} · ${track.blockReason}`
    : `${track.departmentName}: ${label}`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        style.bg,
        style.text
      )}
      title={title}
    >
      {track.departmentName}
    </span>
  );
};
