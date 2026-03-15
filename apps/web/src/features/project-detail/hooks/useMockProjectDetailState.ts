"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { BoardProjectRecord, DeptTrackStatus, SlaRisk } from "@/features/board/types";
import { useMockProjectStore } from "@/features/board/hooks/useMockProjectStore";
import { getMockProjectDetail } from "../mock-data";
import type {
  ProjectDetailComment,
  ProjectDetailData,
  ProjectDetailDepartmentTrack,
  ProjectDetailTimelineEvent,
  ProjectDetailWorkItem,
  WorkItemStatus,
} from "../types";

const STORAGE_KEY = "project-collab-hub.project-detail.mock-overlays";
const STORAGE_EVENT = "project-collab-hub.project-detail.mock-overlays.updated";
const COMMENT_AUTHOR_ID = "web_app.user";
const ACTION_ACTOR_ID = "web_app.user";

type ProjectDetailOverlay = Pick<
  ProjectDetailData,
  "departmentTracks" | "workItems" | "approvals" | "comments" | "timeline"
>;

type OverlayStore = Record<string, ProjectDetailOverlay>;

function readOverlayStore(): OverlayStore {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as OverlayStore) : {};
  } catch {
    return {};
  }
}

function writeOverlayStore(nextStore: OverlayStore) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextStore));
  window.dispatchEvent(new Event(STORAGE_EVENT));
}

function subscribe(callback: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleChange = () => callback();
  window.addEventListener("storage", handleChange);
  window.addEventListener(STORAGE_EVENT, handleChange);

  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener(STORAGE_EVENT, handleChange);
  };
}

function mergeDetailWithOverlay(
  baseDetail: ProjectDetailData | null,
  overlay: ProjectDetailOverlay | undefined,
): ProjectDetailData | null {
  if (!baseDetail) {
    return null;
  }

  if (!overlay) {
    return baseDetail;
  }

  return {
    ...baseDetail,
    departmentTracks: overlay.departmentTracks,
    workItems: overlay.workItems,
    approvals: overlay.approvals,
    comments: overlay.comments,
    timeline: overlay.timeline,
  };
}

function getNextTrackStatusFromWorkItems(
  track: ProjectDetailDepartmentTrack,
  workItems: ProjectDetailWorkItem[],
): DeptTrackStatus {
  if (track.status === "blocked" || track.status === "waiting_approval") {
    return track.status;
  }

  const relatedItems = workItems.filter((item) => item.departmentTrackId === track.id);
  if (relatedItems.length === 0) {
    return track.status;
  }

  if (relatedItems.every((item) => item.status === "done")) {
    return "done";
  }

  if (relatedItems.some((item) => item.status === "in_progress" || item.status === "in_review")) {
    return "in_progress";
  }

  return "not_started";
}

function deriveSlaRisk(currentRisk: SlaRisk, overdueTaskCount: number): SlaRisk {
  if (overdueTaskCount > 0) {
    return "overdue";
  }

  return currentRisk === "overdue" ? "on_time" : currentRisk;
}

function createTimelineEvent(
  projectId: string,
  action: string,
  changeSummary: string,
): ProjectDetailTimelineEvent {
  return {
    id: `${projectId}-timeline-${Date.now()}`,
    actorId: ACTION_ACTOR_ID,
    action,
    objectType: "project",
    objectId: projectId,
    changeSummary,
    sourceEntry: "web",
    createdAt: Date.now(),
  };
}

export function useMockProjectDetailState(projectId: string) {
  const overlayStore = useSyncExternalStore<OverlayStore>(subscribe, readOverlayStore, () => ({}));
  const { projects, replaceProjects } = useMockProjectStore();

  const baseDetail = useMemo(() => getMockProjectDetail(projectId, projects), [projectId, projects]);
  const detail = useMemo(
    () => mergeDetailWithOverlay(baseDetail, overlayStore[projectId]),
    [baseDetail, overlayStore, projectId],
  );

  const updateOverlay = useCallback(
    (updater: (current: ProjectDetailData) => ProjectDetailOverlay) => {
      if (!detail) {
        return;
      }

      writeOverlayStore({
        ...overlayStore,
        [projectId]: updater(detail),
      });
    },
    [detail, overlayStore, projectId],
  );

  const updateProjectRecord = useCallback(
    (updater: (project: BoardProjectRecord) => BoardProjectRecord) => {
      replaceProjects(
        projects.map((project) =>
          project.id === projectId ? updater(project) : project,
        ),
      );
    },
    [projectId, projects, replaceProjects],
  );

  const createComment = useCallback(
    async (body: string, mentionedUserIds: string[]) => {
      if (!detail || !body.trim()) {
        return { ok: false, message: "评论内容不能为空" } as const;
      }

      const nextComment: ProjectDetailComment = {
        id: `${projectId}-comment-${Date.now()}`,
        authorId: COMMENT_AUTHOR_ID,
        body: body.trim(),
        targetScope: "project",
        isDeleted: false,
        parentCommentId: null,
        mentionedUserIds,
        createdAt: Date.now(),
      };

      updateOverlay((current) => ({
        departmentTracks: current.departmentTracks,
        workItems: current.workItems,
        approvals: current.approvals,
        comments: [...current.comments, nextComment],
        timeline: [
          createTimelineEvent(projectId, "comment.created", `新增评论：${body.trim().slice(0, 40)}`),
          ...current.timeline,
        ],
      }));

      return { ok: true, message: "评论已保存" } as const;
    },
    [detail, projectId, updateOverlay],
  );

  const deleteComment = useCallback(
    async (commentId: string) => {
      if (!detail) {
        return { ok: false, message: "未找到项目详情" } as const;
      }

      updateOverlay((current) => ({
        departmentTracks: current.departmentTracks,
        workItems: current.workItems,
        approvals: current.approvals,
        comments: current.comments.map((comment) =>
          comment.id === commentId ? { ...comment, isDeleted: true } : comment,
        ),
        timeline: [
          createTimelineEvent(projectId, "comment.deleted", "评论已删除"),
          ...current.timeline,
        ],
      }));

      return { ok: true, message: "评论已删除" } as const;
    },
    [detail, projectId, updateOverlay],
  );

  const updateWorkItemStatus = useCallback(
    async (workItemId: string, status: WorkItemStatus) => {
      if (!detail) {
        return { ok: false, message: "未找到项目详情" } as const;
      }

      const existingItem = detail.workItems.find((item) => item.id === workItemId);
      if (!existingItem) {
        return { ok: false, message: "未找到行动项" } as const;
      }

      updateOverlay((current) => {
        const workItems = current.workItems.map((item) =>
          item.id === workItemId
            ? {
                ...item,
                status,
                completedAt: status === "done" ? Date.now() : undefined,
              }
            : item,
        );

        const departmentTracks = current.departmentTracks.map((track) => ({
          ...track,
          status: getNextTrackStatusFromWorkItems(track, workItems),
        }));

        return {
          departmentTracks,
          workItems,
          approvals: current.approvals,
          comments: current.comments,
          timeline: [
            createTimelineEvent(projectId, "work_item.status_changed", `行动项「${existingItem.title}」更新为 ${status}`),
            ...current.timeline,
          ],
        };
      });

      updateProjectRecord((project) => {
        const overdueTaskCount = detail.workItems.filter((item) => {
          const nextStatus = item.id === workItemId ? status : item.status;
          return nextStatus !== "done" && item.dueDate !== undefined && item.dueDate < Date.now();
        }).length;

        const departmentTracks = detail.departmentTracks.map((track) => ({
          departmentName: track.departmentName,
          status:
            track.id === existingItem.departmentTrackId
              ? getNextTrackStatusFromWorkItems(track, detail.workItems.map((item) =>
                  item.id === workItemId
                    ? {
                        ...item,
                        status,
                        completedAt: status === "done" ? Date.now() : undefined,
                      }
                    : item,
                ))
              : track.status,
          blockReason: track.blockReason,
        }));

        return {
          ...project,
          departmentTracks,
          overdueTaskCount,
          slaRisk: deriveSlaRisk(project.slaRisk, overdueTaskCount),
        };
      });

      return { ok: true, message: "行动项状态已更新" } as const;
    },
    [detail, projectId, updateOverlay, updateProjectRecord],
  );

  const resolveApproval = useCallback(
    async (approvalId: string, status: "approved" | "rejected") => {
      if (!detail) {
        return { ok: false, message: "未找到项目详情" } as const;
      }

      const approval = detail.approvals.find((item) => item.id === approvalId);
      if (!approval) {
        return { ok: false, message: "未找到审批" } as const;
      }

      updateOverlay((current) => {
        const approvals = current.approvals.map((item) =>
          item.id === approvalId
            ? {
                ...item,
                status,
                resolvedAt: Date.now(),
                resolvedBy: ACTION_ACTOR_ID,
              }
            : item,
        );

        const departmentTracks = current.departmentTracks.map<ProjectDetailDepartmentTrack>((track) => {
          if (track.departmentName !== approval.departmentName) {
            return track;
          }

          const nextStatus: DeptTrackStatus =
            status === "approved"
              ? track.status === "waiting_approval"
                ? "done"
                : track.status
              : "blocked";

          return {
            ...track,
            status: nextStatus,
            blockReason: status === "approved" ? undefined : "审批被拒绝",
            pendingApprovalCount: 0,
          };
        });

        return {
          departmentTracks,
          workItems: current.workItems,
          approvals,
          comments: current.comments,
          timeline: [
            createTimelineEvent(projectId, `approval_gate.${status}`, `审批「${approval.title}」${status === "approved" ? "已通过" : "已拒绝"}`),
            ...current.timeline,
          ],
        };
      });

      updateProjectRecord((project) => ({
        ...project,
        pendingApprovalCount: Math.max(0, project.pendingApprovalCount - (approval.status === "pending" ? 1 : 0)),
        departmentTracks: project.departmentTracks.map((track) => {
          if (track.departmentName !== approval.departmentName) {
            return track;
          }

          return status === "approved"
            ? {
                ...track,
                status: track.status === "waiting_approval" ? "done" : track.status,
                blockReason: undefined,
              }
            : {
                ...track,
                status: "blocked",
                blockReason: "审批被拒绝",
              };
        }),
      }));

      return { ok: true, message: status === "approved" ? "审批已通过" : "审批已拒绝" } as const;
    },
    [detail, projectId, updateOverlay, updateProjectRecord],
  );

  return {
    detail,
    isLoading: false,
    createComment,
    deleteComment,
    updateWorkItemStatus,
    resolveApproval,
  } as const;
}
