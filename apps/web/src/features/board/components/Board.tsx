"use client";

import { useCallback } from "react";

import { useConvexEnabled } from "@/providers/ConvexClientProvider";

import { useBoardFilters } from "../hooks/useBoardFilters";
import { useBoardSavedViews } from "../hooks/useBoardSavedViews";
import { useConvexBoardData } from "../hooks/useConvexBoardData";
import { useMockBoardData } from "../hooks/useMockBoardData";
import { BoardWorkspace } from "./BoardWorkspace";

export function Board() {
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
}

interface SharedBoardState {
  boardState: ReturnType<typeof useBoardFilters>;
  savedViewsState: ReturnType<typeof useBoardSavedViews>;
}

function ConnectedBoard({ boardState, savedViewsState }: SharedBoardState) {
  const data = useConvexBoardData(boardState.filters);

  const handleSaveCurrentView = useCallback(() => {
    const name = window.prompt("请输入视图名称", "我的筛选视图");
    if (!name) {
      return;
    }

    savedViewsState.saveView(name, boardState.filters);
  }, [boardState.filters, savedViewsState]);

  return (
    <BoardWorkspace
      {...data}
      filters={boardState.filters}
      savedViews={savedViewsState.savedViews}
      onFilterChange={boardState.setFilter}
      onApplyView={boardState.replaceFilters}
      onClearFilter={boardState.clearFilter}
      onClearAll={boardState.clearAll}
      onSaveCurrentView={handleSaveCurrentView}
      onDeleteView={savedViewsState.deleteView}
      onMoveProject={data.moveProject}
    />
  );
}

function MockBoard({ boardState, savedViewsState }: SharedBoardState) {
  const data = useMockBoardData(boardState.filters);

  const handleSaveCurrentView = useCallback(() => {
    const name = window.prompt("请输入视图名称", "我的筛选视图");
    if (!name) {
      return;
    }

    savedViewsState.saveView(name, boardState.filters);
  }, [boardState.filters, savedViewsState]);

  return (
    <BoardWorkspace
      {...data}
      filters={boardState.filters}
      savedViews={savedViewsState.savedViews}
      onFilterChange={boardState.setFilter}
      onApplyView={boardState.replaceFilters}
      onClearFilter={boardState.clearFilter}
      onClearAll={boardState.clearAll}
      onSaveCurrentView={handleSaveCurrentView}
      onDeleteView={savedViewsState.deleteView}
      onMoveProject={data.moveProject}
    />
  );
}
