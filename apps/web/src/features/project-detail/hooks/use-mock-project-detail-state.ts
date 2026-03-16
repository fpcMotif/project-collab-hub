"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

import { useMockProjectStore } from "@/features/board/hooks/useMockProjectStore";
import type {
  BoardProjectRecord,
  DeptTrackStatus,
  SlaRisk,
} from "@/features/board/types";

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

// Stable empty object for SSR and initial cache.
const EMPTY_OVERLAY_STORE: OverlayStore = {};

// Cache the last raw string and parsed result so readOverlayStore returns
// a stable reference when localStorage hasn't changed.
let _cachedRaw: string | null = undefined as unknown as null;
let _cachedStore: OverlayStore = EMPTY_OVERLAY_STORE;

function readOverlayStore(): OverlayStore {
  if (typeof window === "undefined") {
    return EMPTY_OVERLAY_STORE;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (raw === _cachedRaw) {
      return _cachedStore;
    }

    _cachedRaw = raw;

    if (!raw) {
      _cachedStore = EMPTY_OVERLAY_STORE;
      return _cachedStore;
    }

    const parsed = JSON.parse(raw);
    _cachedStore =
      parsed && typeof parsed === "object"
        ? (parsed as OverlayStore)
        : EMPTY_OVERLAY_STORE;
    return _cachedStore;
  } catch {
    _cachedStore = EMPTY_OVERLAY_STORE;
    return _cachedStore;
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
    return () => {};
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
  overlay: ProjectDetailOverlay | undefined
): ProjectDetailData | null {
  if (!baseDetail) {
    return null;
  }

  if (!overlay) {
    return baseDetail;
  }

  return {
    ...baseDetail,
    approvals: overlay.approvals,
    comments: overlay.comments,
    departmentTracks: overlay.departmentTracks,
    timeline: overlay.timeline,
    workItems: overlay.workItems,
  };
}

function getNextTrackStatusFromWorkItems(
  track: ProjectDetailDepartmentTrack,
  workItems: ProjectDetailWorkItem[]
): DeptTrackStatus {
  if (track.status === "blocked" || track.status === "waiting_approval") {
    return track.status;
  }

  const relatedItems = workItems.filter(
    (item) => item.departmentTrackId === track.id
  );
  if (relatedItems.length === 0) {
    return track.status;
  }

  if (relatedItems.every((item) => item.status === "done")) {
    return "done";
  }

  if (
    relatedItems.some(
      (item) => item.status === "in_progress" || item.status === "in_review"
    )
  ) {
    return "in_progress";
  }

  return "not_started";
}

function deriveSlaRisk(
  currentRisk: SlaRisk,
  overdueTaskCount: number
): SlaRisk {
  if (overdueTaskCount > 0) {
    return "overdue";
  }

  return currentRisk === "overdue" ? "on_time" : currentRisk;
}

function createTimelineEvent(
  projectId: string,
  action: string,
  changeSummary: string
): ProjectDetailTimelineEvent {
  return {
    action,
    actorId: ACTION_ACTOR_ID,
    changeSummary,
    createdAt: Date.now(),
    id: `${projectId}-timeline-${Date.now()}`,
    objectId: projectId,
    objectType: "project",
    sourceEntry: "web",
  };
}

export function useMockProjectDetailState(projectId: string) {
  const overlayStore = useSyncExternalStore<OverlayStore>(
    subscribe,
    readOverlayStore,
    () => EMPTY_OVERLAY_STORE
  );
  const { projects, replaceProjects } = useMockProjectStore();

  const baseDetail = useMemo(
    () => getMockProjectDetail(projectId, projects),
    [projectId, projects]
  );
  const detail = useMemo(
    () => mergeDetailWithOverlay(baseDetail, overlayStore[projectId]),
    [baseDetail, overlayStore, projectId]
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
    [detail, overlayStore, projectId]
  );

  const updateProjectRecord = useCallback(
    (updater: (project: BoardProjectRecord) => BoardProjectRecord) => {
      replaceProjects(
        projects.map((project) =>
          project.id === projectId ? updater(project) : project
        )
      );
    },
    [projectId, projects, replaceProjects]
  );

  const createComment = useCallback(
    async (body: string, mentionedUserIds: string[]) => {
      if (!detail || !body.trim()) {
        return { message: "评论内容不能为空", ok: false } as const;
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

      return { message: "评论已保存", ok: true } as const;
    },
    [detail, projectId, updateOverlay]
  );

  const deleteComment = useCallback(
    async (commentId: string) => {
      if (!detail) {
        return { message: "未找到项目详情", ok: false } as const;
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

      return { message: "评论已删除", ok: true } as const;
    },
    [detail, projectId, updateOverlay]
  );

  const updateWorkItemStatus = useCallback(
    async (workItemId: string, status: WorkItemStatus) => {
      if (!detail) {
        return { message: "未找到项目详情", ok: false } as const;
      }

      const existingItem = detail.workItems.find(
        (item) => item.id === workItemId
      );
      if (!existingItem) {
        return { message: "未找到行动项", ok: false } as const;
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

      return { message: "行动项状态已更新", ok: true } as const;
    },
    [detail, projectId, updateOverlay, updateProjectRecord]
  );

  const resolveApproval = useCallback(
    async (approvalId: string, status: "approved" | "rejected") => {
      if (!detail) {
        return { message: "未找到项目详情", ok: false } as const;
      }

      const approval = detail.approvals.find((item) => item.id === approvalId);
      if (!approval) {
        return { message: "未找到审批", ok: false } as const;
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

              const nextStatus: DeptTrackStatus =
                status === "approved"
                  ? (track.status === "waiting_approval"
                    ? "done"
                    : track.status)
                  : "blocked";

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

      return {
        message: status === "approved" ? "审批已通过" : "审批已拒绝",
        ok: true,
      } as const;
    },
    [detail, projectId, updateOverlay, updateProjectRecord]
  );

  return {
    createComment,
    deleteComment,
    detail,
    isLoading: false,
    resolveApproval,
    updateWorkItemStatus,
  } as const;
}
