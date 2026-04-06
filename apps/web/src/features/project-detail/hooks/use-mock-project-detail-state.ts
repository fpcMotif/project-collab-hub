"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

import { useMockProjectStore } from "@/features/board/hooks/use-mock-project-store";
import type { BoardProjectRecord } from "@/features/board/types";

import { getMockProjectDetail } from "../mock-data";
import type { ProjectDetailData } from "../types";
import type { ProjectDetailOverlay } from "./mock-utils";
import { useMockApprovalActions } from "./use-mock-approval-actions";
import { useMockCommentActions } from "./use-mock-comment-actions";
import { useMockWorkItemActions } from "./use-mock-work-item-actions";

const STORAGE_KEY = "project-collab-hub.project-detail.mock-overlays";
const STORAGE_EVENT = "project-collab-hub.project-detail.mock-overlays.updated";

type OverlayStore = Record<string, ProjectDetailOverlay>;

// Stable empty object for SSR and initial cache.
const EMPTY_OVERLAY_STORE: OverlayStore = {};

// Cache the last raw string and parsed result so readOverlayStore returns
// a stable reference when localStorage hasn't changed.
let _cachedRaw: string | null = undefined as unknown as null;
let _cachedParsed: OverlayStore | null = null;

const readOverlayStore = (): OverlayStore => {
  if (typeof window === "undefined") {
    return EMPTY_OVERLAY_STORE;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return EMPTY_OVERLAY_STORE;
    }
    if (raw === _cachedRaw && _cachedParsed) {
      return _cachedParsed;
    }
    const parsed = JSON.parse(raw);
    _cachedRaw = raw;
    _cachedParsed = parsed;
    return parsed;
  } catch {
    return EMPTY_OVERLAY_STORE;
  }
};

const writeOverlayStore = (store: OverlayStore) => {
  if (typeof window === "undefined") {
    return;
  }
  const raw = JSON.stringify(store);
  localStorage.setItem(STORAGE_KEY, raw);
  _cachedRaw = raw;
  _cachedParsed = store;
  window.dispatchEvent(new Event(STORAGE_EVENT));
};

// oxlint-disable-next-line promise/prefer-await-to-callbacks
const subscribe = (callback: () => void) => {
  if (typeof window === "undefined") {
    // oxlint-disable-next-line eslint/no-empty-function
    return () => {
      // noop
    };
  }
  window.addEventListener(STORAGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(STORAGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
};

const mergeDetailWithOverlay = (
  baseDetail: ProjectDetailData | null,
  overlay: ProjectDetailOverlay | undefined
): ProjectDetailData | null => {
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
};

export const useMockProjectDetailState = (projectId: string) => {
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

  const { createComment, deleteComment } = useMockCommentActions({
    detail,
    projectId,
    updateOverlay,
  });

  const { updateWorkItemStatus } = useMockWorkItemActions({
    detail,
    projectId,
    updateOverlay,
    updateProjectRecord,
  });

  const { requestApproval, resolveApproval } = useMockApprovalActions({
    detail,
    projectId,
    updateOverlay,
    updateProjectRecord,
  });

  return {
    createComment,
    deleteComment,
    detail,
    isLoading: false,
    requestApproval,
    resolveApproval,
    updateWorkItemStatus,
  } as const;
};
