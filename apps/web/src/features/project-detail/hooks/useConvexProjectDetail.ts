"use client";

import { useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { convexFunctionRefs } from "@/lib/convex-function-refs";
import type { WorkItemStatus } from "../types";

const ACTOR_ID = "web_app.user";

export function useConvexProjectDetail(projectId: string) {
  const detail = useQuery(convexFunctionRefs.getProjectDetail, { projectId });
  const createCommentMutation = useMutation(convexFunctionRefs.createComment);
  const deleteCommentMutation = useMutation(convexFunctionRefs.deleteComment);
  const updateWorkItemStatusMutation = useMutation(convexFunctionRefs.updateWorkItemStatus);
  const resolveApprovalGateMutation = useMutation(convexFunctionRefs.resolveApprovalGate);

  const createComment = useCallback(
    async (body: string, mentionedUserIds: string[]) => {
      if (!body.trim()) {
        return { ok: false, message: "评论内容不能为空" } as const;
      }

      await createCommentMutation({
        projectId,
        authorId: ACTOR_ID,
        body: body.trim(),
        targetScope: "project",
        mentionedUserIds,
      });

      return { ok: true, message: "评论已保存" } as const;
    },
    [createCommentMutation, projectId],
  );

  const deleteComment = useCallback(
    async (commentId: string) => {
      await deleteCommentMutation({
        id: commentId,
        actorId: ACTOR_ID,
      });

      return { ok: true, message: "评论已删除" } as const;
    },
    [deleteCommentMutation],
  );

  const updateWorkItemStatus = useCallback(
    async (workItemId: string, status: WorkItemStatus) => {
      await updateWorkItemStatusMutation({
        id: workItemId,
        status,
        actorId: ACTOR_ID,
      });

      return { ok: true, message: "行动项状态已更新" } as const;
    },
    [updateWorkItemStatusMutation],
  );

  const resolveApproval = useCallback(
    async (approvalId: string, status: "approved" | "rejected") => {
      const approval = detail?.approvals.find((item) => item.id === approvalId);
      if (!approval) {
        return { ok: false, message: "未找到审批" } as const;
      }

      await resolveApprovalGateMutation({
        id: approvalId,
        status,
        resolvedBy: ACTOR_ID,
        instanceCode: approval.instanceCode ?? `MANUAL-${approvalId}`,
        idempotencyKey: `${approvalId}-${status}-${Date.now()}`,
      });

      return { ok: true, message: status === "approved" ? "审批已通过" : "审批已拒绝" } as const;
    },
    [detail?.approvals, resolveApprovalGateMutation],
  );

  return {
    detail: detail ?? null,
    isLoading: detail === undefined,
    createComment,
    deleteComment,
    updateWorkItemStatus,
    resolveApproval,
  } as const;
}
