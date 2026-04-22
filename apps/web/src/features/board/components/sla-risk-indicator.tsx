import { cn } from "@/lib/cn";

import { SLA_RISK_STYLES } from "../constants";
import type { SlaRisk } from "../types";

interface SlaRiskIndicatorProps {
  risk: SlaRisk;
}

export const SlaRiskIndicator = ({ risk }: SlaRiskIndicatorProps) => {
  const style = SLA_RISK_STYLES[risk];

  if (!style) {
    return null;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        style.text
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", style.dot)}
        aria-hidden="true"
      />
      {style.label}
    </span>
  );
};
