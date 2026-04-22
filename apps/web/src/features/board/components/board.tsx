import { useCallback } from "react";

import { useConvexEnabled } from "@/providers/convex-client-provider";

import { useBoardFilters } from "../hooks/use-board-filters";
import { useBoardSavedViews } from "../hooks/use-board-saved-views";
import { useConvexBoardData } from "../hooks/use-convex-board-data";
import { useMockBoardData } from "../hooks/use-mock-board-data";
import { BoardWorkspace } from "./board-workspace";

interface SharedBoardState {
  boardState: ReturnType<typeof useBoardFilters>;
  savedViewsState: ReturnType<typeof useBoardSavedViews>;
}

const ConnectedBoard = ({ boardState, savedViewsState }: SharedBoardState) => {
  const data = useConvexBoardData(boardState.filters);
  const handleSaveCurrentView = useCallback(
    (name: string) => savedViewsState.saveView(name, boardState.filters),
    [boardState.filters, savedViewsState]
  );

  return (
    <BoardWorkspace
      {...data}
      filters={boardState.filters}
      savedViews={savedViewsState.savedViews}
      onApplyView={boardState.replaceFilters}
      onClearAll={boardState.clearAll}
      onClearFilter={boardState.clearFilter}
      onDeleteView={savedViewsState.deleteView}
      onFilterChange={boardState.setFilter}
      onMoveProject={data.moveProject}
      onSaveCurrentView={handleSaveCurrentView}
    />
  );
};

const MockBoard = ({ boardState, savedViewsState }: SharedBoardState) => {
  const data = useMockBoardData(boardState.filters);
  const handleSaveCurrentView = useCallback(
    (name: string) => savedViewsState.saveView(name, boardState.filters),
    [boardState.filters, savedViewsState]
  );

  return (
    <BoardWorkspace
      {...data}
      filters={boardState.filters}
      savedViews={savedViewsState.savedViews}
      onApplyView={boardState.replaceFilters}
      onClearAll={boardState.clearAll}
      onClearFilter={boardState.clearFilter}
      onDeleteView={savedViewsState.deleteView}
      onFilterChange={boardState.setFilter}
      onMoveProject={data.moveProject}
      onSaveCurrentView={handleSaveCurrentView}
    />
  );
};

export const Board = () => {
  const convexEnabled = useConvexEnabled();
  const boardState = useBoardFilters();
  const savedViewsState = useBoardSavedViews();

  if (convexEnabled) {
    return (
      <ConnectedBoard
        boardState={boardState}
        savedViewsState={savedViewsState}
      />
    );
  }

  return (
    <MockBoard boardState={boardState} savedViewsState={savedViewsState} />
  );
};
