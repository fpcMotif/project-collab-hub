import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BoardFilterState } from "../types";
import { useBoardSavedViews } from "./use-board-saved-views";

const STORAGE_KEY = "project-collab-hub.board.saved-views";
const STORAGE_EVENT = "project-collab-hub.board.saved-views.updated";

const defaultFilters: BoardFilterState = {
  approvalStatus: null,
  customer: null,
  department: null,
  overdueStatus: null,
  owner: null,
  priority: null,
  slaRisk: null,
  templateType: null,
};

describe("useBoardSavedViews", () => {
  let cryptoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    window.localStorage.clear();
    cryptoSpy = vi
      .spyOn(window.crypto, "randomUUID")
      .mockReturnValue("mock-uuid");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return empty views initially", () => {
    const { result } = renderHook(() => useBoardSavedViews());
    expect(result.current.savedViews).toEqual([]);
  });

  it("should save a valid view", () => {
    const { result } = renderHook(() => useBoardSavedViews());

    act(() => {
      const success = result.current.saveView("My View", defaultFilters);
      expect(success).toBe(true);
    });

    expect(result.current.savedViews).toEqual([
      {
        filters: defaultFilters,
        id: "mock-uuid",
        name: "My View",
      },
    ]);

    const stored = window.localStorage.getItem(STORAGE_KEY);
    expect(stored).toBeDefined();
    expect(JSON.parse(stored ?? "[]")).toEqual([
      {
        filters: defaultFilters,
        id: "mock-uuid",
        name: "My View",
      },
    ]);
  });

  it("should fail to save a view with an empty name", () => {
    const { result } = renderHook(() => useBoardSavedViews());

    act(() => {
      const success = result.current.saveView("   ", defaultFilters);
      expect(success).toBe(false);
    });

    expect(result.current.savedViews).toEqual([]);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("should delete a view", () => {
    const { result } = renderHook(() => useBoardSavedViews());

    act(() => {
      result.current.saveView("View 1", defaultFilters);
    });

    cryptoSpy.mockReturnValue("mock-uuid-2");

    act(() => {
      result.current.saveView("View 2", defaultFilters);
    });

    expect(result.current.savedViews).toHaveLength(2);

    act(() => {
      result.current.deleteView("mock-uuid");
    });

    expect(result.current.savedViews).toEqual([
      {
        filters: defaultFilters,
        id: "mock-uuid-2",
        name: "View 2",
      },
    ]);
  });

  it("should handle cross-tab storage synchronization", () => {
    const { result } = renderHook(() => useBoardSavedViews());

    act(() => {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([
          {
            filters: defaultFilters,
            id: "external-uuid",
            name: "External View",
          },
        ])
      );
      window.dispatchEvent(new Event("storage"));
    });

    expect(result.current.savedViews).toEqual([
      {
        filters: defaultFilters,
        id: "external-uuid",
        name: "External View",
      },
    ]);
  });

  it("should handle custom storage event synchronization", () => {
    const { result } = renderHook(() => useBoardSavedViews());

    act(() => {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([
          {
            filters: defaultFilters,
            id: "custom-uuid",
            name: "Custom View",
          },
        ])
      );
      window.dispatchEvent(new Event(STORAGE_EVENT));
    });

    expect(result.current.savedViews).toEqual([
      {
        filters: defaultFilters,
        id: "custom-uuid",
        name: "Custom View",
      },
    ]);
  });

  it("should handle corrupted JSON gracefully", () => {
    window.localStorage.setItem(STORAGE_KEY, "{ corrupted JSON");
    const { result } = renderHook(() => useBoardSavedViews());
    expect(result.current.savedViews).toEqual([]);
  });

  it("should handle non-array JSON gracefully", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ name: "Not an array" })
    );
    const { result } = renderHook(() => useBoardSavedViews());
    expect(result.current.savedViews).toEqual([]);
  });

  it("should filter out malformed view items", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { filters: defaultFilters, id: "1", name: "Valid" },
        // missing name and filters
        { id: "2" },
        { filters: defaultFilters, name: "Missing ID" },
        { id: "4", name: "Missing Filters" },
        "not an object",
      ])
    );
    const { result } = renderHook(() => useBoardSavedViews());

    expect(result.current.savedViews).toEqual([
      { filters: defaultFilters, id: "1", name: "Valid" },
    ]);
  });
});
