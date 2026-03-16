import { cn } from "@/lib/cn";

import { PRIORITY_STYLES, PRIORITY_LABELS } from "../constants";
import type { Priority } from "../types";

interface PriorityBadgeProps {
  priority: Priority;
}

export const PriorityBadge = ({ priority }: PriorityBadgeProps) => {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold",
        PRIORITY_STYLES[priority]
      )}
    >
      {PRIORITY_LABELS[priority]}
    </span>
  );
};
