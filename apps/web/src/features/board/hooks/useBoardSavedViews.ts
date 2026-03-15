"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { BoardFilterState, BoardSavedView } from "../types";

const STORAGE_KEY = "project-collab-hub.board.saved-views";
const STORAGE_EVENT = "project-collab-hub.board.saved-views.updated";

function readSavedViews(): BoardSavedView[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (item): item is BoardSavedView =>
        typeof item?.id === "string" &&
        typeof item?.name === "string" &&
        typeof item?.filters === "object" &&
        item.filters !== null,
    );
  } catch {
    return [];
  }
}

function emitSavedViewsChanged() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(STORAGE_EVENT));
}

function persistSavedViews(views: BoardSavedView[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
  emitSavedViewsChanged();
}

function createViewId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `view-${Date.now()}`;
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

export function useBoardSavedViews() {
  const savedViews = useSyncExternalStore(subscribe, readSavedViews, () => []);

  const saveView = useCallback((name: string, filters: BoardFilterState) => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      return false;
    }

    const next = [
      ...savedViews,
      {
        id: createViewId(),
        name: trimmedName,
        filters,
      },
    ];

    persistSavedViews(next);
    return true;
  }, [savedViews]);

  const deleteView = useCallback(
    (id: string) => {
      persistSavedViews(savedViews.filter((view) => view.id !== id));
    },
    [savedViews],
  );

  return {
    savedViews,
    saveView,
    deleteView,
  } as const;
}
