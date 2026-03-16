import { canAdvanceStage } from "../constants";

/**
 * Stub hook wrapping shared stage-gating logic.
 * Will be connected to Convex mutations later.
 */
export const useStageTransition = () => ({
  canAdvance: (
    currentStatus: string,
    targetStatus: string,
    trackStatuses: readonly string[],
    pendingRequiredApprovalCount = 0
  ) =>
    canAdvanceStage(
      currentStatus,
      targetStatus,
      trackStatuses,
      pendingRequiredApprovalCount
    ),
});
