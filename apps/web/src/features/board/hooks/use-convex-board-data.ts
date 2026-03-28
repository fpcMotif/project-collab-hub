"use client";

import { useMutation, useQuery } from "convex/react";
import { useCallback, useMemo, useState } from "react";

import { convexFunctionRefs } from "@/lib/convex-function-refs";

import {
  buildBoardViewData,
  getProjectMoveDecision,
  getProjectStatusByColumnId,
} from "../lib/view-model";
import type { BoardFilterState, BoardMoveResult } from "../types";

const BOARD_ACTOR_ID = "web_app.board_drag_drop";

export const useConvexBoardData = (filters: BoardFilterState) => {
  const remoteProjects = useQuery(convexFunctionRefs.listBoardProjects, {});
  const transitionProjectStage = useMutation(
    convexFunctionRefs.transitionProjectStage
  );
  const [movingProjectId, setMovingProjectId] = useState<string | null>(null);

  const projects = remoteProjects ?? [];
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

      setMovingProjectId(projectId);
      try {
        const result = await transitionProjectStage({
          actorId: BOARD_ACTOR_ID,
          projectId,
          reason: `drag ${project.status} -> ${targetStatus}`,
          targetStatus,
        });

        return {
          message:
            result.message ??
            (result.ok
              ? `已移动到「${boardData.columns.find((column) => column.id === targetColumnId)?.name ?? targetColumnId}」`
              : "阶段迁移失败"),
          ok: result.ok,
        };
      } catch (error) {
        return {
          message: error instanceof Error ? error.message : String(error),
          ok: false,
        };
      } finally {
        setMovingProjectId(null);
      }
    },
    [boardData.columns, projects, transitionProjectStage]
  );

  return {
    ...boardData,
    isLoading: remoteProjects === undefined,
    moveProject,
    movingProjectId,
  } as const;
};
