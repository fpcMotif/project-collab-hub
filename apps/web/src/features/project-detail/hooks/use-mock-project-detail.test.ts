import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useMockProjectStore } from "@/features/board/hooks/use-mock-project-store";

import { getMockProjectDetail } from "../mock-data";
import { useMockProjectDetail } from "./use-mock-project-detail";

// Mock the dependencies
vi.mock("@/features/board/hooks/use-mock-project-store", () => ({
  useMockProjectStore: vi.fn(),
}));

vi.mock("../mock-data", () => ({
  getMockProjectDetail: vi.fn(),
}));

describe("useMockProjectDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return project details when valid projectId is provided", () => {
    const mockProjects = [{ id: "P-1", name: "Project 1" }];
    const mockDetail = {
      comments: [],
      project: { id: "P-1", name: "Project 1" },
    };

    vi.mocked(useMockProjectStore).mockReturnValue({
      addProject: vi.fn(),
      projects: mockProjects as unknown as ReturnType<
        typeof useMockProjectStore
      >["projects"],
      replaceProjects: vi.fn(),
    });

    vi.mocked(getMockProjectDetail).mockReturnValue(
      mockDetail as unknown as ReturnType<typeof getMockProjectDetail>
    );

    const { result } = renderHook(() => useMockProjectDetail("P-1"));

    expect(result.current.detail).toBe(mockDetail);
    expect(result.current.isLoading).toBe(false);
    expect(getMockProjectDetail).toHaveBeenCalledWith("P-1", mockProjects);
  });

  it("should return null detail when invalid projectId is provided", () => {
    const mockProjects = [{ id: "P-1", name: "Project 1" }];

    vi.mocked(useMockProjectStore).mockReturnValue({
      addProject: vi.fn(),
      projects: mockProjects as unknown as ReturnType<
        typeof useMockProjectStore
      >["projects"],
      replaceProjects: vi.fn(),
    });

    vi.mocked(getMockProjectDetail).mockReturnValue(null);

    const { result } = renderHook(() => useMockProjectDetail("INVALID-ID"));

    expect(result.current.detail).toBe(null);
    expect(result.current.isLoading).toBe(false);
    expect(getMockProjectDetail).toHaveBeenCalledWith(
      "INVALID-ID",
      mockProjects
    );
  });

  it("should return null detail when projects store is empty", () => {
    vi.mocked(useMockProjectStore).mockReturnValue({
      addProject: vi.fn(),
      projects: [],
      replaceProjects: vi.fn(),
    });

    vi.mocked(getMockProjectDetail).mockReturnValue(null);

    const { result } = renderHook(() => useMockProjectDetail("P-1"));

    expect(result.current.detail).toBe(null);
    expect(result.current.isLoading).toBe(false);
    expect(getMockProjectDetail).toHaveBeenCalledWith("P-1", []);
  });

  it("should memoize the detail object until dependencies change", () => {
    const mockProjects = [{ id: "P-1", name: "Project 1" }];
    const mockDetail1 = { project: { id: "P-1", name: "Project 1" } };
    const mockDetail2 = { project: { id: "P-2", name: "Project 2" } };

    const currentProjects = mockProjects;

    vi.mocked(useMockProjectStore).mockImplementation(() => ({
      addProject: vi.fn(),
      projects: currentProjects as unknown as ReturnType<
        typeof useMockProjectStore
      >["projects"],
      replaceProjects: vi.fn(),
    }));

    vi.mocked(getMockProjectDetail)
      .mockReturnValueOnce(
        mockDetail1 as unknown as ReturnType<typeof getMockProjectDetail>
      )
      .mockReturnValueOnce(
        mockDetail2 as unknown as ReturnType<typeof getMockProjectDetail>
      );

    const { rerender, result } = renderHook(
      ({ projectId }) => useMockProjectDetail(projectId),
      { initialProps: { projectId: "P-1" } }
    );

    expect(result.current.detail).toBe(mockDetail1);
    expect(getMockProjectDetail).toHaveBeenCalledTimes(1);

    // Rerender with SAME props and store, useMemo should prevent recalculation
    rerender({ projectId: "P-1" });
    expect(getMockProjectDetail).toHaveBeenCalledTimes(1);
    expect(result.current.detail).toBe(mockDetail1);

    // Rerender with DIFFERENT projectId, should recalculate
    rerender({ projectId: "P-2" });
    expect(getMockProjectDetail).toHaveBeenCalledTimes(2);
    expect(result.current.detail).toBe(mockDetail2);
  });
});
