"use client";

import { useMutation, useQuery } from "convex/react";
import { useCallback } from "react";

import { convexFunctionRefs } from "@/lib/convex-function-refs";

import type { WorkItemStatus } from "../types";

const ACTOR_ID = "web_app.user";

export const useConvexProjectDetail = (projectId: string) => {
  const detail = useQuery(convexFunctionRefs.getProjectDetail, { projectId });
  const createCommentMutation = useMutation(convexFunctionRefs.createComment);
  const deleteCommentMutation = useMutation(convexFunctionRefs.deleteComment);
  const updateWorkItemStatusMutation = useMutation(
    convexFunctionRefs.updateWorkItemStatus
  );
  const resolveApprovalGateMutation = useMutation(
    convexFunctionRefs.resolveApprovalGate
  );

  const createComment = useCallback(
    async (body: string, mentionedUserIds: string[]) => {
      if (!body.trim()) {
        return { message: "评论内容不能为空", ok: false } as const;
      }

      await createCommentMutation({
        authorId: ACTOR_ID,
        body: body.trim(),
        mentionedUserIds,
        projectId,
        targetScope: "project",
      });

      return { message: "评论已保存", ok: true } as const;
    },
    [createCommentMutation, projectId]
  );

  const deleteComment = useCallback(
    async (commentId: string) => {
      await deleteCommentMutation({
        actorId: ACTOR_ID,
        id: commentId,
      });

      return { message: "评论已删除", ok: true } as const;
    },
    [deleteCommentMutation]
  );

  const updateWorkItemStatus = useCallback(
    async (workItemId: string, status: WorkItemStatus) => {
      await updateWorkItemStatusMutation({
        actorId: ACTOR_ID,
        id: workItemId,
        status,
      });

      return { message: "行动项状态已更新", ok: true } as const;
    },
    [updateWorkItemStatusMutation]
  );

  const resolveApproval = useCallback(
    async (approvalId: string, status: "approved" | "rejected") => {
      const approval = detail?.approvals.find((item) => item.id === approvalId);
      if (!approval) {
        return { message: "未找到审批", ok: false } as const;
      }

      await resolveApprovalGateMutation({
        id: approvalId,
        idempotencyKey: `${approvalId}-${status}-${Date.now()}`,
        instanceCode: approval.instanceCode ?? `MANUAL-${approvalId}`,
        resolvedBy: ACTOR_ID,
        status,
      });

      return {
        message: status === "approved" ? "审批已通过" : "审批已拒绝",
        ok: true,
      } as const;
    },
    [detail?.approvals, resolveApprovalGateMutation]
  );

  return {
    createComment,
    deleteComment,
    detail: detail ?? null,
    isLoading: detail === undefined,
    resolveApproval,
    updateWorkItemStatus,
  } as const;
};
