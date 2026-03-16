import { describe, expect, it } from "vitest";

import { BOARD_COLUMNS } from "../constants";
import type { BoardFilterState, BoardProjectRecord } from "../types";
import {
  buildBoardViewData,
  buildStageAdvanceState,
  getApprovalStatus,
  getColumnNameByStatus,
  getOverdueStatus,
  getProjectMoveDecision,
  getProjectStatusByColumnId,
} from "./view-model";

// ── Fixtures ───────────────────────────────────────────────────────

const makeProject = (
  overrides: Partial<BoardProjectRecord> = {}
): BoardProjectRecord => ({
  customerName: "客户A",
  departmentTracks: [],
  id: "proj-1",
  name: "测试项目",
  overdueTaskCount: 0,
  ownerName: "张三",
  pendingApprovalCount: 0,
  priority: "medium",
  slaRisk: "on_time",
  status: "new",
  templateType: "标准模板",
  ...overrides,
});

const requireColumn = (
  columns: ReturnType<typeof buildBoardViewData>["columns"],
  status: BoardProjectRecord["status"]
) => {
  const column = columns.find((item) => item.projectStatus === status);
  if (!column) {
    throw new Error(`Missing column for status ${status}`);
  }
  return column;
};

const EMPTY_FILTERS: BoardFilterState = {
  approvalStatus: null,
  customer: null,
  department: null,
  overdueStatus: null,
  owner: null,
  priority: null,
  slaRisk: null,
  templateType: null,
};

// ── getColumnNameByStatus ──────────────────────────────────────────

describe("getColumnNameByStatus", () => {
  it("returns the column name for a valid status", () => {
    expect(getColumnNameByStatus("new")).toBe("新建/待分诊");
    expect(getColumnNameByStatus("done")).toBe("已完成");
  });

  it("returns null for an unknown status", () => {
    expect(getColumnNameByStatus("unknown")).toBeNull();
    expect(getColumnNameByStatus(null)).toBeNull();
  });
});

// ── getProjectStatusByColumnId ─────────────────────────────────────

describe("getProjectStatusByColumnId", () => {
  it("returns the project status for a valid column ID", () => {
    expect(getProjectStatusByColumnId("COL-NEW")).toBe("new");
    expect(getProjectStatusByColumnId("COL-EXEC")).toBe("executing");
  });

  it("returns null for an unknown column ID", () => {
    expect(getProjectStatusByColumnId("COL-UNKNOWN")).toBeNull();
  });
});

// ── getApprovalStatus / getOverdueStatus ───────────────────────────

describe("getApprovalStatus", () => {
  it("returns 'pending' when there are pending approvals", () => {
    expect(getApprovalStatus(makeProject({ pendingApprovalCount: 3 }))).toBe(
      "pending"
    );
  });

  it("returns 'clear' when there are no pending approvals", () => {
    expect(getApprovalStatus(makeProject({ pendingApprovalCount: 0 }))).toBe(
      "clear"
    );
  });
});

describe("getOverdueStatus", () => {
  it("returns 'overdue' when there are overdue tasks", () => {
    expect(getOverdueStatus(makeProject({ overdueTaskCount: 1 }))).toBe(
      "overdue"
    );
  });

  it("returns 'normal' when there are no overdue tasks", () => {
    expect(getOverdueStatus(makeProject({ overdueTaskCount: 0 }))).toBe(
      "normal"
    );
  });
});

// ── buildStageAdvanceState ─────────────────────────────────────────

describe("buildStageAdvanceState", () => {
  it("returns terminal tone for 'done' status", () => {
    const project = makeProject({ status: "done" });
    const state = buildStageAdvanceState(project);
    expect(state.tone).toBe("terminal");
    expect(state.allowed).toBe(false);
    expect(state.nextStatus).toBeNull();
  });

  it("returns terminal tone for 'cancelled' status", () => {
    const project = makeProject({ status: "cancelled" });
    const state = buildStageAdvanceState(project);
    expect(state.tone).toBe("terminal");
    expect(state.allowed).toBe(false);
  });

  it("returns 'ready' tone when all tracks are done and no pending approvals", () => {
    const project = makeProject({
      departmentTracks: [{ departmentName: "技术部", status: "done" }],
      pendingApprovalCount: 0,
      status: "new",
    });
    const state = buildStageAdvanceState(project);
    expect(state.tone).toBe("ready");
    expect(state.allowed).toBe(true);
    expect(state.nextStatus).toBe("assessment");
  });

  it("returns 'blocked' tone when required tracks are blocked", () => {
    const project = makeProject({
      departmentTracks: [
        { blockReason: "缺物料", departmentName: "采购部", status: "blocked" },
      ],
      status: "new",
    });
    const state = buildStageAdvanceState(project);
    expect(state.tone).toBe("blocked");
    expect(state.allowed).toBe(false);
    expect(state.detail).toContain("采购部");
    expect(state.detail).toContain("缺物料");
  });

  it("returns 'attention' tone when approvals are pending", () => {
    const project = makeProject({
      departmentTracks: [{ departmentName: "技术部", status: "done" }],
      pendingApprovalCount: 2,
      status: "new",
    });
    const state = buildStageAdvanceState(project);
    expect(state.tone).toBe("attention");
    expect(state.allowed).toBe(false);
    expect(state.detail).toContain("2");
  });

  it("returns 'attention' tone when tracks are incomplete but not blocked", () => {
    const project = makeProject({
      departmentTracks: [
        { departmentName: "技术部", status: "in_progress" },
        { departmentName: "物流部", status: "not_started" },
      ],
      status: "new",
    });
    const state = buildStageAdvanceState(project);
    expect(state.tone).toBe("attention");
    expect(state.allowed).toBe(false);
  });
  it("returns 'blocked' tone when tracks are waiting approval", () => {
    const project = makeProject({
      departmentTracks: [
        { departmentName: "法务部", status: "waiting_approval" },
      ],
      status: "new",
    });
    const state = buildStageAdvanceState(project);
    expect(state.tone).toBe("blocked");
    expect(state.allowed).toBe(false);
    expect(state.detail).toContain("法务部");
  });
});

// ── getProjectMoveDecision ─────────────────────────────────────────

describe("getProjectMoveDecision", () => {
  it("returns ok when project is already at target status", () => {
    const project = makeProject({ status: "new" });
    const decision = getProjectMoveDecision(project, "new");
    expect(decision.ok).toBe(true);
  });

  it("returns ok for allowed forward transition with all tracks done", () => {
    const project = makeProject({
      departmentTracks: [{ departmentName: "技术部", status: "done" }],
      status: "new",
    });
    const decision = getProjectMoveDecision(project, "assessment");
    expect(decision.ok).toBe(true);
  });

  it("returns not ok for disallowed transition", () => {
    const project = makeProject({ status: "new" });
    const decision = getProjectMoveDecision(project, "done");
    expect(decision.ok).toBe(false);
  });
});

// ── buildBoardViewData ─────────────────────────────────────────────

describe("buildBoardViewData", () => {
  it("returns columns matching BOARD_COLUMNS", () => {
    const data = buildBoardViewData([], EMPTY_FILTERS);
    expect(data.columns).toHaveLength(BOARD_COLUMNS.length);
    expect(data.columns.map((c) => c.id)).toEqual(
      BOARD_COLUMNS.map((c) => c.id)
    );
  });

  it("places projects into correct columns by status", () => {
    const projects = [
      makeProject({ id: "p1", status: "new" }),
      makeProject({ id: "p2", status: "executing" }),
    ];
    const data = buildBoardViewData(projects, EMPTY_FILTERS);
    const newColumn = requireColumn(data.columns, "new");
    const execColumn = requireColumn(data.columns, "executing");
    expect(newColumn.cards).toHaveLength(1);
    expect(newColumn.cards[0].id).toBe("p1");
    expect(execColumn.cards).toHaveLength(1);
    expect(execColumn.cards[0].id).toBe("p2");
  });

  it("filters by priority", () => {
    const projects = [
      makeProject({ id: "p1", priority: "urgent" }),
      makeProject({ id: "p2", priority: "low" }),
    ];
    const data = buildBoardViewData(projects, {
      ...EMPTY_FILTERS,
      priority: "urgent",
    });
    expect(data.visibleProjectCount).toBe(1);
    expect(data.totalProjectCount).toBe(2);
  });

  it("filters by owner", () => {
    const projects = [
      makeProject({ id: "p1", ownerName: "张三" }),
      makeProject({ id: "p2", ownerName: "李四" }),
    ];
    const data = buildBoardViewData(projects, {
      ...EMPTY_FILTERS,
      owner: "张三",
    });
    expect(data.visibleProjectCount).toBe(1);
  });

  it("filters by department", () => {
    const projects = [
      makeProject({
        departmentTracks: [{ departmentName: "技术部", status: "done" }],
        id: "p1",
      }),
      makeProject({
        departmentTracks: [{ departmentName: "物流部", status: "done" }],
        id: "p2",
      }),
    ];
    const data = buildBoardViewData(projects, {
      ...EMPTY_FILTERS,
      department: "技术部",
    });
    expect(data.visibleProjectCount).toBe(1);
  });

  it("computes unique filter options from all projects", () => {
    const projects = [
      makeProject({
        customerName: "客户A",
        ownerName: "张三",
        templateType: "标准",
      }),
      makeProject({
        customerName: "客户B",
        ownerName: "李四",
        templateType: "快速",
      }),
      makeProject({
        customerName: "客户A",
        ownerName: "张三",
        templateType: "标准",
      }),
    ];
    const data = buildBoardViewData(projects, EMPTY_FILTERS);
    expect(data.ownerOptions).toHaveLength(2);
    expect(data.customerOptions).toHaveLength(2);
    expect(data.templateTypeOptions).toHaveLength(2);
  });

  it("sorts cards by tone → sla → overdue → approvals → priority → name", () => {
    const projects = [
      makeProject({
        id: "low-priority",
        name: "B项目",
        priority: "low",
        slaRisk: "on_time",
      }),
      makeProject({
        id: "urgent-overdue",
        name: "A项目",
        overdueTaskCount: 3,
        priority: "urgent",
        slaRisk: "overdue",
      }),
    ];
    const data = buildBoardViewData(projects, EMPTY_FILTERS);
    const newColumn = requireColumn(data.columns, "new");
    // Both are tone "ready" (no tracks), so sort by slaRisk: overdue < on_time
    expect(newColumn.cards[0].id).toBe("urgent-overdue");
    expect(newColumn.cards[1].id).toBe("low-priority");
  });
  it("sorts blocked cards by overdue count before pending approvals", () => {
    const projects = [
      makeProject({
        departmentTracks: [{ departmentName: "采购部", status: "blocked" }],
        id: "higher-overdue",
        overdueTaskCount: 3,
        pendingApprovalCount: 0,
        slaRisk: "at_risk",
      }),
      makeProject({
        departmentTracks: [{ departmentName: "采购部", status: "blocked" }],
        id: "higher-approvals",
        overdueTaskCount: 1,
        pendingApprovalCount: 5,
        slaRisk: "at_risk",
      }),
      makeProject({
        departmentTracks: [{ departmentName: "采购部", status: "blocked" }],
        id: "lower-approvals",
        overdueTaskCount: 1,
        pendingApprovalCount: 1,
        slaRisk: "at_risk",
      }),
    ];
    const data = buildBoardViewData(projects, EMPTY_FILTERS);
    const newColumn = requireColumn(data.columns, "new");
    expect(newColumn.cards.map((card) => card.id)).toEqual([
      "higher-overdue",
      "higher-approvals",
      "lower-approvals",
    ]);
  });

  it("sorts fully tied ready cards by priority then name", () => {
    const projects = [
      makeProject({ id: "low-b", name: "B项目", priority: "low" }),
      makeProject({ id: "high-c", name: "C项目", priority: "high" }),
      makeProject({ id: "low-a", name: "A项目", priority: "low" }),
    ];
    const data = buildBoardViewData(projects, EMPTY_FILTERS);
    const newColumn = requireColumn(data.columns, "new");
    expect(newColumn.cards.map((card) => card.id)).toEqual([
      "high-c",
      "low-a",
      "low-b",
    ]);
  });
});
