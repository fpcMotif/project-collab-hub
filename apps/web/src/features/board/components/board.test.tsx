import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useConvexEnabled } from "@/providers/convex-client-provider";

import { useBoardFilters } from "../hooks/use-board-filters";
import { useBoardSavedViews } from "../hooks/use-board-saved-views";
import { useConvexBoardData } from "../hooks/use-convex-board-data";
import { useMockBoardData } from "../hooks/use-mock-board-data";
import { Board } from "./board";
import { BoardWorkspace } from "./board-workspace";

vi.mock("@/providers/convex-client-provider", () => ({
  useConvexEnabled: vi.fn(),
}));

vi.mock("../hooks/use-board-filters", () => ({
  useBoardFilters: vi.fn(),
}));

vi.mock("../hooks/use-board-saved-views", () => ({
  useBoardSavedViews: vi.fn(),
}));

vi.mock("../hooks/use-convex-board-data", () => ({
  useConvexBoardData: vi.fn(),
}));

vi.mock("../hooks/use-mock-board-data", () => ({
  useMockBoardData: vi.fn(),
}));

vi.mock("./board-workspace", () => ({
  BoardWorkspace: vi.fn(() => <div data-testid="board-workspace" />),
}));

describe("Board", () => {
  const mockBoardFilters = {
    clearAll: vi.fn(),
    clearFilter: vi.fn(),
    filters: { search: "test" },
    replaceFilters: vi.fn(),
    setFilter: vi.fn(),
  };

  const mockSavedViews = {
    deleteView: vi.fn(),
    saveView: vi.fn(),
    savedViews: [{ filters: {}, id: "1", name: "View 1" }],
  };

  const mockConvexData = {
    moveProject: vi.fn(),
    projects: [{ id: "p1", name: "Convex Project" }],
  };

  const mockMockData = {
    moveProject: vi.fn(),
    projects: [{ id: "m1", name: "Mock Project" }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useBoardFilters).mockReturnValue(
      mockBoardFilters as unknown as ReturnType<typeof useBoardFilters>
    );
    vi.mocked(useBoardSavedViews).mockReturnValue(
      mockSavedViews as unknown as ReturnType<typeof useBoardSavedViews>
    );
    vi.mocked(useConvexBoardData).mockReturnValue(
      mockConvexData as unknown as ReturnType<typeof useConvexBoardData>
    );
    vi.mocked(useMockBoardData).mockReturnValue(
      mockMockData as unknown as ReturnType<typeof useMockBoardData>
    );
  });

  afterEach(() => {
    cleanup();
  });

  it("renders ConnectedBoard when convex is enabled", () => {
    vi.mocked(useConvexEnabled).mockReturnValue(true);

    render(<Board />);

    expect(screen.getByTestId("board-workspace")).toBeInTheDocument();

    // Verify hooks were called
    expect(useConvexEnabled).toHaveBeenCalled();
    expect(useBoardFilters).toHaveBeenCalled();
    expect(useBoardSavedViews).toHaveBeenCalled();
    expect(useConvexBoardData).toHaveBeenCalledWith(mockBoardFilters.filters);
    expect(useMockBoardData).not.toHaveBeenCalled();

    // Verify BoardWorkspace was called with correct props
    expect(vi.mocked(BoardWorkspace)).toHaveBeenCalledWith(
      expect.objectContaining({
        ...mockConvexData,
        filters: mockBoardFilters.filters,
        onApplyView: mockBoardFilters.replaceFilters,
        onClearAll: mockBoardFilters.clearAll,
        onClearFilter: mockBoardFilters.clearFilter,
        onDeleteView: mockSavedViews.deleteView,
        onFilterChange: mockBoardFilters.setFilter,
        onMoveProject: mockConvexData.moveProject,
        onSaveCurrentView: expect.any(Function),
        savedViews: mockSavedViews.savedViews,
      }),
      undefined
    );
  });

  it("renders MockBoard when convex is disabled", () => {
    vi.mocked(useConvexEnabled).mockReturnValue(false);

    render(<Board />);

    expect(screen.getByTestId("board-workspace")).toBeInTheDocument();

    // Verify hooks were called
    expect(useConvexEnabled).toHaveBeenCalled();
    expect(useBoardFilters).toHaveBeenCalled();
    expect(useBoardSavedViews).toHaveBeenCalled();
    expect(useMockBoardData).toHaveBeenCalledWith(mockBoardFilters.filters);
    expect(useConvexBoardData).not.toHaveBeenCalled();

    // Verify BoardWorkspace was called with correct props
    expect(vi.mocked(BoardWorkspace)).toHaveBeenCalledWith(
      expect.objectContaining({
        ...mockMockData,
        filters: mockBoardFilters.filters,
        onApplyView: mockBoardFilters.replaceFilters,
        onClearAll: mockBoardFilters.clearAll,
        onClearFilter: mockBoardFilters.clearFilter,
        onDeleteView: mockSavedViews.deleteView,
        onFilterChange: mockBoardFilters.setFilter,
        onMoveProject: mockMockData.moveProject,
        onSaveCurrentView: expect.any(Function),
        savedViews: mockSavedViews.savedViews,
      }),
      undefined
    );
  });

  it("calls saveView when onSaveCurrentView is triggered in ConnectedBoard", () => {
    vi.mocked(useConvexEnabled).mockReturnValue(true);

    render(<Board />);

    const [[workspaceProps]] = vi.mocked(BoardWorkspace).mock.calls;
    workspaceProps.onSaveCurrentView("New View");

    expect(mockSavedViews.saveView).toHaveBeenCalledWith(
      "New View",
      mockBoardFilters.filters
    );
  });

  it("calls saveView when onSaveCurrentView is triggered in MockBoard", () => {
    vi.mocked(useConvexEnabled).mockReturnValue(false);

    render(<Board />);

    const [[workspaceProps]] = vi.mocked(BoardWorkspace).mock.calls;
    workspaceProps.onSaveCurrentView("Another View");

    expect(mockSavedViews.saveView).toHaveBeenCalledWith(
      "Another View",
      mockBoardFilters.filters
    );
  });
});
