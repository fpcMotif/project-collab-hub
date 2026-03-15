"use client";

import type { BoardFilterState } from "../types";
import { useMockBoardData } from "./useMockBoardData";

/**
 * Backwards-compatible wrapper kept for incremental refactors.
 * New code should prefer `useMockBoardData` / `useConvexBoardData` directly.
 */
export function useBoardData(filters: BoardFilterState) {
  return useMockBoardData(filters);
}
