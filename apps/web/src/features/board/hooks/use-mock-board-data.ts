"use client";

import { useCallback, useMemo } from "react";

import {
  buildBoardViewData,
  getProjectMoveDecision,
  getProjectStatusByColumnId,
} from "../lib/view-model";
import type { BoardFilterState, BoardMoveResult } from "../types";
import { useMockProjectStore } from "./use-mock-project-store";

export const useMockBoardData = (filters: BoardFilterState) => {
  const { projects, replaceProjects } = useMockProjectStore();

  const boardData = useMemo(
    () => buildBoardViewData(projects, filters),
    [projects, filters]
  );

  const moveProject = useCallback(
    async (
      projectId: string,
      targetColumnId: string
    ): Promise<BoardMoveResult> => {
      const project = projects.find((item) => item.id === projectId);
      if (!project) {
        return { message: "未找到项目卡片", ok: false };
      }

      const targetStatus = getProjectStatusByColumnId(targetColumnId);
      if (!targetStatus) {
        return { message: "未找到目标阶段", ok: false };
      }

      const decision = getProjectMoveDecision(project, targetStatus);
      if (!decision.ok) {
        return { message: decision.message, ok: false };
      }

      await Promise.resolve();
      replaceProjects(
        projects.map((item) =>
          item.id === projectId ? { ...item, status: targetStatus } : item
        )
      );

      return {
        message: `已移动到「${boardData.columns.find((column) => column.id === targetColumnId)?.name ?? targetColumnId}」`,
        ok: true,
      };
    },
    [boardData.columns, projects, replaceProjects]
  );

  return {
    ...boardData,
    isLoading: false,
    moveProject,
    movingProjectId: null,
  } as const;
};
