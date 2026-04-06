import { useCallback } from "react";

import type {
  BoardProjectRecord,
  DeptTrackStatus,
} from "@/features/board/types";

import type {
  ProjectDetailApproval,
  ProjectDetailData,
  ProjectDetailDepartmentTrack,
} from "../types";
import { ACTION_ACTOR_ID, createTimelineEvent } from "./mock-utils";
import type { ProjectDetailOverlay } from "./mock-utils";

interface UseMockApprovalActionsProps {
  projectId: string;
  detail: ProjectDetailData | null;
  updateOverlay: (
    updater: (current: ProjectDetailData) => ProjectDetailOverlay
  ) => void;
  updateProjectRecord: (
    updater: (project: BoardProjectRecord) => BoardProjectRecord
  ) => void;
}

export const useMockApprovalActions = ({
  projectId,
  detail,
  updateOverlay,
  updateProjectRecord,
}: UseMockApprovalActionsProps) => {
  const resolveApproval = useCallback(
    (approvalId: string, status: "approved" | "rejected") => {
      if (!detail) {
        return Promise.resolve({ message: "未找到项目详情", ok: false });
      }

      const approval = detail.approvals.find((item) => item.id === approvalId);
      if (!approval) {
        return Promise.resolve({ message: "未找到审批", ok: false });
      }

      updateOverlay((current) => {
        const approvals = current.approvals.map((item) =>
          item.id === approvalId
            ? {
                ...item,
                resolvedAt: Date.now(),
                resolvedBy: ACTION_ACTOR_ID,
                status,
              }
            : item
        );

        const departmentTracks =
          current.departmentTracks.map<ProjectDetailDepartmentTrack>(
            (track) => {
              if (track.departmentName !== approval.departmentName) {
                return track;
              }

              let nextStatus: DeptTrackStatus = "blocked";
              if (status === "approved") {
                nextStatus =
                  track.status === "waiting_approval" ? "done" : track.status;
              }

              return {
                ...track,
                blockReason: status === "approved" ? undefined : "审批被拒绝",
                pendingApprovalCount: 0,
                status: nextStatus,
              };
            }
          );

        return {
          approvals,
          comments: current.comments,
          departmentTracks,
          timeline: [
            createTimelineEvent(
              projectId,
              `approval_gate.${status}`,
              `审批「${approval.title}」${status === "approved" ? "已通过" : "已拒绝"}`
            ),
            ...current.timeline,
          ],
          workItems: current.workItems,
        };
      });

      updateProjectRecord((project) => ({
        ...project,
        departmentTracks: project.departmentTracks.map((track) => {
          if (track.departmentName !== approval.departmentName) {
            return track;
          }

          return status === "approved"
            ? {
                ...track,
                blockReason: undefined,
                status:
                  track.status === "waiting_approval" ? "done" : track.status,
              }
            : {
                ...track,
                blockReason: "审批被拒绝",
                status: "blocked",
              };
        }),
        pendingApprovalCount: Math.max(
          0,
          project.pendingApprovalCount - (approval.status === "pending" ? 1 : 0)
        ),
      }));

      return Promise.resolve({
        message: status === "approved" ? "审批已通过" : "审批已拒绝",
        ok: true,
      });
    },
    [detail, projectId, updateOverlay, updateProjectRecord]
  );

  const requestApproval = useCallback(
    (title: string, approvalCode: string, triggerStage: string) => {
      if (!detail) {
        return Promise.resolve({ message: "未找到项目详情", ok: false });
      }

      const nextApproval: ProjectDetailApproval = {
        applicantId: ACTION_ACTOR_ID,
        approvalCode,
        id: `${projectId}-approval-${Date.now()}`,
        status: "pending",
        title,
        triggerStage,
      };

      updateOverlay((current) => ({
        approvals: [...current.approvals, nextApproval],
        comments: current.comments,
        departmentTracks: current.departmentTracks,
        timeline: [
          createTimelineEvent(
            projectId,
            "approval_gate.created",
            `申请审批：${title}`
          ),
          ...current.timeline,
        ],
        workItems: current.workItems,
      }));

      return Promise.resolve({ message: "审批申请已提交", ok: true });
    },
    [detail, projectId, updateOverlay]
  );

  return { requestApproval, resolveApproval };
};
