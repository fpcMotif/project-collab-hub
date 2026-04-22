import type { BoardFilterState } from "../types";
import { useMockBoardData } from "./use-mock-board-data";

/**
 * Backwards-compatible wrapper kept for incremental refactors.
 * New code should prefer `useMockBoardData` / `useConvexBoardData` directly.
 */
export const useBoardData = (filters: BoardFilterState) =>
  useMockBoardData(filters);
