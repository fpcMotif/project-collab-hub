import { useCallback } from "react";

import type { ProjectDetailComment, ProjectDetailData } from "../types";
import { COMMENT_AUTHOR_ID, createTimelineEvent } from "./mock-utils";
import type { ProjectDetailOverlay } from "./mock-utils";

interface UseMockCommentActionsProps {
  projectId: string;
  detail: ProjectDetailData | null;
  updateOverlay: (
    updater: (current: ProjectDetailData) => ProjectDetailOverlay
  ) => void;
}

export const useMockCommentActions = ({
  projectId,
  detail,
  updateOverlay,
}: UseMockCommentActionsProps) => {
  const createComment = useCallback(
    (body: string, mentionedUserIds: string[]) => {
      if (!detail || !body.trim()) {
        return Promise.resolve({ message: "评论内容不能为空", ok: false });
      }

      const nextComment: ProjectDetailComment = {
        authorId: COMMENT_AUTHOR_ID,
        body: body.trim(),
        createdAt: Date.now(),
        id: `${projectId}-comment-${Date.now()}`,
        isDeleted: false,
        mentionedUserIds,
        parentCommentId: null,
        targetScope: "project",
      };

      updateOverlay((current) => ({
        approvals: current.approvals,
        comments: [...current.comments, nextComment],
        departmentTracks: current.departmentTracks,
        timeline: [
          createTimelineEvent(
            projectId,
            "comment.created",
            `新增评论：${body.trim().slice(0, 40)}`
          ),
          ...current.timeline,
        ],
        workItems: current.workItems,
      }));

      return Promise.resolve({ message: "评论已保存", ok: true });
    },
    [detail, projectId, updateOverlay]
  );

  const deleteComment = useCallback(
    (commentId: string) => {
      if (!detail) {
        return Promise.resolve({ message: "未找到项目详情", ok: false });
      }

      updateOverlay((current) => ({
        approvals: current.approvals,
        comments: current.comments.map((comment) =>
          comment.id === commentId ? { ...comment, isDeleted: true } : comment
        ),
        departmentTracks: current.departmentTracks,
        timeline: [
          createTimelineEvent(projectId, "comment.deleted", "评论已删除"),
          ...current.timeline,
        ],
        workItems: current.workItems,
      }));

      return Promise.resolve({ message: "评论已删除", ok: true });
    },
    [detail, projectId, updateOverlay]
  );

  return { createComment, deleteComment };
};
