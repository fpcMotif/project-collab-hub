import { useCallback } from "react";

import type { BoardProjectRecord } from "@/features/board/types";

import type { ProjectDetailData, WorkItemStatus } from "../types";
import {
  createTimelineEvent,
  deriveSlaRisk,
  getNextTrackStatusFromWorkItems,
} from "./mock-utils";
import type { ProjectDetailOverlay } from "./mock-utils";

interface UseMockWorkItemActionsProps {
  projectId: string;
  detail: ProjectDetailData | null;
  updateOverlay: (
    updater: (current: ProjectDetailData) => ProjectDetailOverlay
  ) => void;
  updateProjectRecord: (
    updater: (project: BoardProjectRecord) => BoardProjectRecord
  ) => void;
}

export const useMockWorkItemActions = ({
  projectId,
  detail,
  updateOverlay,
  updateProjectRecord,
}: UseMockWorkItemActionsProps) => {
  const updateWorkItemStatus = useCallback(
    (workItemId: string, status: WorkItemStatus) => {
      if (!detail) {
        return Promise.resolve({ message: "未找到项目详情", ok: false });
      }

      const existingItem = detail.workItems.find(
        (item) => item.id === workItemId
      );
      if (!existingItem) {
        return Promise.resolve({ message: "未找到行动项", ok: false });
      }

      updateOverlay((current) => {
        const workItems = current.workItems.map((item) =>
          item.id === workItemId
            ? {
                ...item,
                completedAt: status === "done" ? Date.now() : undefined,
                status,
              }
            : item
        );

        const departmentTracks = current.departmentTracks.map((track) => ({
          ...track,
          status: getNextTrackStatusFromWorkItems(track, workItems),
        }));

        return {
          approvals: current.approvals,
          comments: current.comments,
          departmentTracks,
          timeline: [
            createTimelineEvent(
              projectId,
              "work_item.status_changed",
              `行动项「${existingItem.title}」更新为 ${status}`
            ),
            ...current.timeline,
          ],
          workItems,
        };
      });

      updateProjectRecord((project) => {
        const overdueTaskCount = detail.workItems.filter((item) => {
          const nextStatus = item.id === workItemId ? status : item.status;
          return (
            nextStatus !== "done" &&
            item.dueDate !== undefined &&
            item.dueDate < Date.now()
          );
        }).length;

        const departmentTracks = detail.departmentTracks.map((track) => ({
          blockReason: track.blockReason,
          departmentName: track.departmentName,
          status:
            track.id === existingItem.departmentTrackId
              ? getNextTrackStatusFromWorkItems(
                  track,
                  detail.workItems.map((item) =>
                    item.id === workItemId
                      ? {
                          ...item,
                          completedAt:
                            status === "done" ? Date.now() : undefined,
                          status,
                        }
                      : item
                  )
                )
              : track.status,
        }));

        return {
          ...project,
          departmentTracks,
          overdueTaskCount,
          slaRisk: deriveSlaRisk(project.slaRisk, overdueTaskCount),
        };
      });

      return Promise.resolve({ message: "行动项状态已更新", ok: true });
    },
    [detail, projectId, updateOverlay, updateProjectRecord]
  );

  return { updateWorkItemStatus };
};
