import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { StageAdvanceState } from "../types";
import { StageAdvanceHint } from "./stage-advance-hint";

const readyState: StageAdvanceState = {
  allowed: true,
  detail: "可以进入下一阶段。",
  nextColumnId: "COL-EXEC",
  nextColumnName: "开发中",
  nextStatus: "executing",
  summary: "准备推进",
  tone: "ready",
};

describe("StageAdvanceHint", () => {
  it("renders summary and detail for stage advance state", () => {
    render(<StageAdvanceHint stageAdvance={readyState} />);
    expect(screen.getByText("准备推进")).toBeInTheDocument();
    expect(screen.getByText("可以进入下一阶段。")).toBeInTheDocument();
  });
});
