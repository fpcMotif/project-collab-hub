import { canAdvanceStage } from "../constants";

/**
 * Stub hook wrapping canAdvanceStage from shared.
 * Will be connected to Convex mutations later.
 */
export function useStageTransition() {
  return {
    canAdvance: (
      currentStatus: string,
      targetStatus: string,
      trackStatuses: readonly string[],
    ) => canAdvanceStage(currentStatus, targetStatus, trackStatuses),
  } as const;
}
