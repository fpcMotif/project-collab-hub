import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useMockProjectStore } from "@/features/board/hooks/use-mock-project-store";

import { getMockProjectDetail } from "../mock-data";
import { useMockProjectDetail } from "./use-mock-project-detail";

vi.mock("@/features/board/hooks/use-mock-project-store", () => ({
  useMockProjectStore: vi.fn(),
}));

vi.mock("../mock-data", () => ({
  getMockProjectDetail: vi.fn(),
}));

describe("useMockProjectDetail", () => {
  const mockProjects = [{ id: "proj-1", name: "Project 1" }];
  const mockDetail = { description: "Test", id: "proj-1", name: "Project 1" };

  beforeEach(() => {
    vi.resetAllMocks();

    vi.mocked(useMockProjectStore).mockReturnValue({
      addProject: vi.fn(),
      projects: mockProjects,
      replaceProjects: vi.fn(),
    } as unknown as ReturnType<typeof useMockProjectStore>);
  });

  it("returns project detail successfully", () => {
    vi.mocked(getMockProjectDetail).mockReturnValue(
      mockDetail as unknown as ReturnType<typeof getMockProjectDetail>
    );

    const { result } = renderHook(() => useMockProjectDetail("proj-1"));

    expect(useMockProjectStore).toHaveBeenCalled();
    expect(getMockProjectDetail).toHaveBeenCalledWith("proj-1", mockProjects);

    expect(result.current.detail).toEqual(mockDetail);
    expect(result.current.isLoading).toBe(false);
  });

  it("handles non-existent project id by returning undefined", () => {
    vi.mocked(getMockProjectDetail).mockReturnValue(null);

    const { result } = renderHook(() => useMockProjectDetail("non-existent"));

    expect(getMockProjectDetail).toHaveBeenCalledWith(
      "non-existent",
      mockProjects
    );

    expect(result.current.detail).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("memoizes the detail correctly across re-renders", () => {
    vi.mocked(getMockProjectDetail).mockReturnValue(
      mockDetail as unknown as ReturnType<typeof getMockProjectDetail>
    );

    const { result, rerender } = renderHook(
      ({ projectId }) => useMockProjectDetail(projectId),
      {
        initialProps: { projectId: "proj-1" },
      }
    );

    // Initial render
    expect(getMockProjectDetail).toHaveBeenCalledTimes(1);

    // Re-render with the exact same props
    rerender({ projectId: "proj-1" });

    // getMockProjectDetail should not be called again because dependencies (projectId, projects) haven't changed
    expect(getMockProjectDetail).toHaveBeenCalledTimes(1);
    expect(result.current.detail).toBe(mockDetail);

    // Re-render with a different project ID
    rerender({ projectId: "proj-2" });

    // getMockProjectDetail should be called again because projectId changed
    expect(getMockProjectDetail).toHaveBeenCalledTimes(2);
  });
});
