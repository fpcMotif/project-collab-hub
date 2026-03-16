import { cn } from "@/lib/cn";

import type { StageAdvanceState, StageAdvanceTone } from "../types";

const TONE_STYLES: Record<
  StageAdvanceTone,
  { container: string; summary: string; detail: string; dot: string }
> = {
  attention: {
    container: "border border-amber-200 bg-amber-50",
    detail: "text-amber-700",
    dot: "bg-amber-500",
    summary: "text-amber-800",
  },
  blocked: {
    container: "border border-red-200 bg-red-50",
    detail: "text-red-700",
    dot: "bg-red-500",
    summary: "text-red-800",
  },
  ready: {
    container: "border border-green-200 bg-green-50",
    detail: "text-green-700",
    dot: "bg-green-500",
    summary: "text-green-800",
  },
  terminal: {
    container: "border border-gray-200 bg-gray-50",
    detail: "text-gray-600",
    dot: "bg-gray-400",
    summary: "text-gray-700",
  },
};

interface StageAdvanceHintProps {
  stageAdvance: StageAdvanceState;
}

export const StageAdvanceHint = ({ stageAdvance }: StageAdvanceHintProps) => {
  const styles = TONE_STYLES[stageAdvance.tone];

  return (
    <div className={cn("rounded-md px-2.5 py-2", styles.container)}>
      <p
        className={cn(
          "flex items-center gap-1.5 text-[11px] font-semibold",
          styles.summary
        )}
      >
        <span
          className={cn("h-1.5 w-1.5 rounded-full", styles.dot)}
          aria-hidden="true"
        />
        {stageAdvance.summary}
      </p>
      <p className={cn("mt-1 text-[11px] leading-4", styles.detail)}>
        {stageAdvance.detail}
      </p>
    </div>
  );
};
