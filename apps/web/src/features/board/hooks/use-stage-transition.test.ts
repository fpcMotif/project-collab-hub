import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { canAdvanceStage } from "../constants";
import { useStageTransition } from "./use-stage-transition";

vi.mock("../constants", () => ({
  canAdvanceStage: vi.fn(),
}));

describe("useStageTransition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should delegate canAdvance to canAdvanceStage with default pendingRequiredApprovalCount", () => {
    const mockResult = { allowed: true };
    vi.mocked(canAdvanceStage).mockReturnValue(mockResult);

    const { result } = renderHook(() => useStageTransition());

    const response = result.current.canAdvance("new", "assessment", [
      "done",
      "not_required",
    ]);

    expect(canAdvanceStage).toHaveBeenCalledTimes(1);
    expect(canAdvanceStage).toHaveBeenCalledWith(
      "new",
      "assessment",
      ["done", "not_required"],
      0
    );
    expect(response).toEqual(mockResult);
  });

  it("should delegate canAdvance to canAdvanceStage with provided pendingRequiredApprovalCount", () => {
    const mockResult = { allowed: false, reason: "pending approvals" };
    vi.mocked(canAdvanceStage).mockReturnValue(mockResult);

    const { result } = renderHook(() => useStageTransition());

    const response = result.current.canAdvance(
      "assessment",
      "solution",
      ["in_progress"],
      2
    );

    expect(canAdvanceStage).toHaveBeenCalledTimes(1);
    expect(canAdvanceStage).toHaveBeenCalledWith(
      "assessment",
      "solution",
      ["in_progress"],
      2
    );
    expect(response).toEqual(mockResult);
  });
});
