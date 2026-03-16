import { describe, expect, it } from "vitest";

import {
  BOARD_COLUMNS,
  BOARD_FLOW_SEQUENCE,
  STAGE_TRANSITIONS,
  canAdvanceStage,
  getNextProjectStatus,
} from "./board";

describe("getNextProjectStatus", () => {
  it("returns the next status in the forward flow", () => {
    expect(getNextProjectStatus("new")).toBe("assessment");
    expect(getNextProjectStatus("assessment")).toBe("solution");
    expect(getNextProjectStatus("solution")).toBe("ready");
    expect(getNextProjectStatus("ready")).toBe("executing");
    expect(getNextProjectStatus("executing")).toBe("delivering");
    expect(getNextProjectStatus("delivering")).toBe("done");
  });

  it("returns null for terminal statuses", () => {
    expect(getNextProjectStatus("done")).toBeNull();
    expect(getNextProjectStatus("cancelled")).toBeNull();
  });

  it("returns null for unknown statuses", () => {
    expect(getNextProjectStatus("nonexistent")).toBeNull();
  });
});

describe("canAdvanceStage", () => {
  it("allows valid forward transition when all tracks are done and no pending approvals", () => {
    const result = canAdvanceStage("new", "assessment", ["done", "done"], 0);
    expect(result).toEqual({ allowed: true });
  });

  it("allows backward transitions without checking tracks", () => {
    const result = canAdvanceStage("solution", "assessment", ["blocked"], 5);
    expect(result).toEqual({ allowed: true });
  });

  it("allows cancellation without checking tracks", () => {
    const result = canAdvanceStage("executing", "cancelled", ["blocked"], 3);
    expect(result).toEqual({ allowed: true });
  });

  it("rejects transitions not in STAGE_TRANSITIONS", () => {
    const result = canAdvanceStage("new", "done", ["done"], 0);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("not permitted");
  });

  it("rejects forward transition when tracks are blocked", () => {
    const result = canAdvanceStage("new", "assessment", ["blocked", "done"], 0);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("blocked or waiting approval");
  });

  it("rejects forward transition when tracks are waiting_approval", () => {
    const result = canAdvanceStage(
      "new",
      "assessment",
      ["waiting_approval"],
      0
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("blocked or waiting approval");
  });

  it("rejects forward transition when there are pending approvals", () => {
    const result = canAdvanceStage("new", "assessment", ["done"], 2);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("2 required approval(s)");
  });

  it("rejects forward transition when tracks are incomplete", () => {
    const result = canAdvanceStage(
      "new",
      "assessment",
      ["in_progress", "done"],
      0
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("not complete");
  });

  it("ignores not_required tracks when evaluating forward transitions", () => {
    const result = canAdvanceStage(
      "new",
      "assessment",
      ["not_required", "done"],
      0
    );
    expect(result).toEqual({ allowed: true });
  });

  it("rejects transitions from terminal states", () => {
    const result = canAdvanceStage("done", "new", ["done"], 0);
    expect(result.allowed).toBe(false);
  });
  it("allows reopening from delivering to executing without rechecking gate state", () => {
    const result = canAdvanceStage("delivering", "executing", ["blocked"], 4);
    expect(result).toEqual({ allowed: true });
  });

  it("treats not_started tracks as incomplete for forward transitions", () => {
    const result = canAdvanceStage(
      "new",
      "assessment",
      ["not_started", "done"],
      0
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("not complete");
  });

  it("rejects transitions from cancelled as a terminal state", () => {
    const result = canAdvanceStage("cancelled", "new", ["done"], 0);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("not permitted");
  });
});

describe("BOARD_COLUMNS", () => {
  it("has entries for every status in the flow sequence", () => {
    for (const status of BOARD_FLOW_SEQUENCE) {
      const column = BOARD_COLUMNS.find((col) => col.projectStatus === status);
      expect(column, `missing column for status "${status}"`).toBeDefined();
    }
  });

  it("includes the cancelled column", () => {
    const cancelled = BOARD_COLUMNS.find(
      (col) => col.projectStatus === "cancelled"
    );
    expect(cancelled).toBeDefined();
    expect(cancelled?.id).toBe("COL-CANCEL");
  });

  it("has unique column IDs", () => {
    const ids = BOARD_COLUMNS.map((col) => col.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("STAGE_TRANSITIONS", () => {
  it("defines transitions for all statuses in the flow sequence", () => {
    for (const status of BOARD_FLOW_SEQUENCE) {
      expect(
        STAGE_TRANSITIONS[status],
        `missing transitions for "${status}"`
      ).toBeDefined();
    }
  });

  it("terminal states have no transitions", () => {
    expect(STAGE_TRANSITIONS["done"]).toEqual([]);
    expect(STAGE_TRANSITIONS["cancelled"]).toEqual([]);
  });

  it("every forward status allows cancellation except terminal states", () => {
    for (const status of BOARD_FLOW_SEQUENCE) {
      if (status === "done") {
        continue;
      }
      expect(
        STAGE_TRANSITIONS[status],
        `"${status}" should allow cancellation`
      ).toContain("cancelled");
    }
  });
});
