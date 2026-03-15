"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { convexFunctionRefs } from "@/lib/convex-function-refs";
import type { BoardFilterState, BoardMoveResult } from "../types";
import { buildBoardViewData, getProjectMoveDecision, getProjectStatusByColumnId } from "../lib/view-model";

const BOARD_ACTOR_ID = "web_app.board_drag_drop";

export function useConvexBoardData(filters: BoardFilterState) {
  const remoteProjects = useQuery(convexFunctionRefs.listBoardProjects, {});
  const transitionProjectStage = useMutation(convexFunctionRefs.transitionProjectStage);
  const [movingProjectId, setMovingProjectId] = useState<string | null>(null);

  const projects = remoteProjects ?? [];
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

      setMovingProjectId(projectId);
      try {
        const result = await transitionProjectStage({
          projectId,
          targetStatus,
          actorId: BOARD_ACTOR_ID,
          reason: `drag ${project.status} -> ${targetStatus}`,
        });

        return {
          ok: result.ok,
          message:
            result.message ??
            (result.ok
              ? `已移动到「${boardData.columns.find((column) => column.id === targetColumnId)?.name ?? targetColumnId}」`
              : "阶段迁移失败"),
        };
      } catch (error) {
        return {
          ok: false,
          message: error instanceof Error ? error.message : String(error),
        };
      } finally {
        setMovingProjectId(null);
      }
    },
    [boardData.columns, projects, transitionProjectStage],
  );

  return {
    ...boardData,
    isLoading: remoteProjects === undefined,
    movingProjectId,
    moveProject,
  } as const;
}
