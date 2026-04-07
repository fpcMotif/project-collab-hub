"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

import { useMockProjectStore } from "@/features/board/hooks/use-mock-project-store";
import type { BoardProjectRecord } from "@/features/board/types";

import { getMockProjectDetail } from "../mock-data";
import type { ProjectDetailData } from "../types";
import { useMockProjectApprovals } from "./use-mock-project-approvals";
import { useMockProjectComments } from "./use-mock-project-comments";
import type { ProjectDetailOverlay } from "./use-mock-project-comments";
import { useMockProjectWorkItems } from "./use-mock-project-work-items";

const STORAGE_KEY = "project-collab-hub.project-detail.mock-overlays";
const STORAGE_EVENT = "project-collab-hub.project-detail.mock-overlays.updated";

type OverlayStore = Record<string, ProjectDetailOverlay>;

// Stable empty object for SSR and initial cache.
const EMPTY_OVERLAY_STORE: OverlayStore = {};

// Cache the last raw string and parsed result so readOverlayStore returns
// a stable reference when localStorage hasn't changed.
let _cachedRaw: string | null = undefined as unknown as null;
let _cachedStore: OverlayStore = EMPTY_OVERLAY_STORE;

const readOverlayStore = (): OverlayStore => {
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
};

const writeOverlayStore = (nextStore: OverlayStore) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextStore));
  window.dispatchEvent(new Event(STORAGE_EVENT));
};

const subscribe = (onChange: () => void) => {
  if (typeof window === "undefined") {
    return () => {
      /* noop */
    };
  }

  const handleChange = () => onChange();
  window.addEventListener("storage", handleChange);
  window.addEventListener(STORAGE_EVENT, handleChange);

  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener(STORAGE_EVENT, handleChange);
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

  const { createComment, deleteComment } = useMockProjectComments(
    projectId,
    detail,
    updateOverlay
  );
  const { updateWorkItemStatus } = useMockProjectWorkItems(
    projectId,
    detail,
    updateOverlay,
    updateProjectRecord
  );
  const { resolveApproval, requestApproval } = useMockProjectApprovals(
    projectId,
    detail,
    updateOverlay,
    updateProjectRecord
  );

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
