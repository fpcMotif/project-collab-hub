//
// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useBoardFilters } from "./use-board-filters";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}));

describe("useBoardFilters", () => {
  const mockRouter = {
    replace: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      mockRouter
    );
    (usePathname as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      "/board"
    );
  });

  const setupMockSearchParams = (
    params: Record<string, string | null> = {}
  ) => {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== null) {
        searchParams.set(key, value);
      }
    }
    (useSearchParams as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      searchParams
    );
    return searchParams;
  };

  describe("initial state parsing", () => {
    it("should parse empty search params correctly", () => {
      setupMockSearchParams();
      const { result } = renderHook(() => useBoardFilters());

      expect(result.current.filters).toEqual({
        approvalStatus: null,
        customer: null,
        department: null,
        overdueStatus: null,
        owner: null,
        priority: null,
        slaRisk: null,
        templateType: null,
      });
    });

    it("should parse valid search params correctly", () => {
      setupMockSearchParams({
        approvalStatus: "pending",
        customer: "Acme",
        department: "Sales",
        overdueStatus: "overdue",
        owner: "John",
        priority: "high",
        slaRisk: "at_risk",
        templateType: "standard",
      });

      const { result } = renderHook(() => useBoardFilters());

      expect(result.current.filters).toEqual({
        approvalStatus: "pending",
        customer: "Acme",
        department: "Sales",
        overdueStatus: "overdue",
        owner: "John",
        priority: "high",
        slaRisk: "at_risk",
        templateType: "standard",
      });
    });

    it("should ignore invalid enum values", () => {
      setupMockSearchParams({
        approvalStatus: "invalid_status",
        overdueStatus: "invalid_overdue",
        priority: "invalid_priority",
        slaRisk: "invalid_sla",
      });

      const { result } = renderHook(() => useBoardFilters());

      expect(result.current.filters).toEqual({
        approvalStatus: null,
        customer: null,
        department: null,
        overdueStatus: null,
        owner: null,
        priority: null,
        slaRisk: null,
        templateType: null,
      });
    });

    it("should ignore empty string values for text filters", () => {
      setupMockSearchParams({
        customer: "   ",
        department: "",
        owner: "  ",
        templateType: "",
      });

      const { result } = renderHook(() => useBoardFilters());

      expect(result.current.filters).toEqual({
        approvalStatus: null,
        customer: null,
        department: null,
        overdueStatus: null,
        owner: null,
        priority: null,
        slaRisk: null,
        templateType: null,
      });
    });
  });

  describe("replaceFilters", () => {
    it("should replace all filters in URL", () => {
      setupMockSearchParams({ priority: "low" });
      const { result } = renderHook(() => useBoardFilters());

      act(() => {
        result.current.replaceFilters({
          approvalStatus: "clear",
          customer: "Corp",
          department: null,
          overdueStatus: null,
          owner: null,
          priority: "urgent",
          slaRisk: null,
          templateType: null,
        });
      });

      expect(mockRouter.replace).toHaveBeenCalledWith(
        "/board?priority=urgent&customer=Corp&approvalStatus=clear",
        { scroll: false }
      );
    });

    it("should handle empty filters", () => {
      setupMockSearchParams({ priority: "low" });
      const { result } = renderHook(() => useBoardFilters());

      act(() => {
        result.current.replaceFilters({
          approvalStatus: null,
          customer: null,
          department: null,
          overdueStatus: null,
          owner: null,
          priority: null,
          slaRisk: null,
          templateType: null,
        });
      });

      expect(mockRouter.replace).toHaveBeenCalledWith("/board", {
        scroll: false,
      });
    });
  });

  describe("setFilter", () => {
    it("should set a new filter value", () => {
      setupMockSearchParams({ owner: "Jane" });
      const { result } = renderHook(() => useBoardFilters());

      act(() => {
        result.current.setFilter("priority", "high");
      });

      expect(mockRouter.replace).toHaveBeenCalledWith(
        "/board?owner=Jane&priority=high",
        {
          scroll: false,
        }
      );
    });

    it("should update an existing filter value", () => {
      setupMockSearchParams({ priority: "low" });
      const { result } = renderHook(() => useBoardFilters());

      act(() => {
        result.current.setFilter("priority", "high");
      });

      expect(mockRouter.replace).toHaveBeenCalledWith("/board?priority=high", {
        scroll: false,
      });
    });

    it("should remove a filter when value is null", () => {
      setupMockSearchParams({ owner: "Jane", priority: "low" });
      const { result } = renderHook(() => useBoardFilters());

      act(() => {
        result.current.setFilter("priority", null);
      });

      expect(mockRouter.replace).toHaveBeenCalledWith("/board?owner=Jane", {
        scroll: false,
      });
    });

    it("should remove the last filter when value is null", () => {
      setupMockSearchParams({ priority: "low" });
      const { result } = renderHook(() => useBoardFilters());

      act(() => {
        result.current.setFilter("priority", null);
      });

      expect(mockRouter.replace).toHaveBeenCalledWith("/board", {
        scroll: false,
      });
    });
  });

  describe("clearFilter", () => {
    it("should clear a specific filter", () => {
      setupMockSearchParams({ owner: "Jane", priority: "low" });
      const { result } = renderHook(() => useBoardFilters());

      act(() => {
        result.current.clearFilter("priority");
      });

      expect(mockRouter.replace).toHaveBeenCalledWith("/board?owner=Jane", {
        scroll: false,
      });
    });
  });

  describe("clearAll", () => {
    it("should clear all filters but keep non-filter query parameters", () => {
      // Unrelated query parameters below
      setupMockSearchParams({
        owner: "Jane",
        page: "2",
        priority: "low",
        sort: "asc",
      });
      const { result } = renderHook(() => useBoardFilters());

      act(() => {
        result.current.clearAll();
      });

      expect(mockRouter.replace).toHaveBeenCalledWith(
        "/board?page=2&sort=asc",
        {
          scroll: false,
        }
      );
    });
  });
});
