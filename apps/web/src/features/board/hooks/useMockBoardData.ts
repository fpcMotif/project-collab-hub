"use client";

import { useCallback, useMemo } from "react";
import type { BoardFilterState, BoardMoveResult } from "../types";
import { useMockProjectStore } from "./useMockProjectStore";
import { buildBoardViewData, getProjectMoveDecision, getProjectStatusByColumnId } from "../lib/view-model";

export function useMockBoardData(filters: BoardFilterState) {
  const { projects, replaceProjects } = useMockProjectStore();

  const boardData = useMemo(() => buildBoardViewData(projects, filters), [projects, filters]);

  const moveProject = useCallback(
    async (projectId: string, targetColumnId: string): Promise<BoardMoveResult> => {
      const project = projects.find((item) => item.id === projectId);
      if (!project) {
        return { ok: false, message: "未找到项目卡片" };
      }

      const targetStatus = getProjectStatusByColumnId(targetColumnId);
      if (!targetStatus) {
        return { ok: false, message: "未找到目标阶段" };
      }

      const decision = getProjectMoveDecision(project, targetStatus);
      if (!decision.ok) {
        return { ok: false, message: decision.message };
      }

      replaceProjects(
        projects.map((item) =>
          item.id === projectId ? { ...item, status: targetStatus } : item,
        ),
      );

      return { ok: true, message: `已移动到「${boardData.columns.find((column) => column.id === targetColumnId)?.name ?? targetColumnId}」` };
    },
    [boardData.columns, projects, replaceProjects],
  );

  return {
    ...boardData,
    isLoading: false,
    movingProjectId: null,
    moveProject,
  } as const;
}
