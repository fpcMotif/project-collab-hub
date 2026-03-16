"use client";

import { useCallback, useSyncExternalStore } from "react";

import type { BoardFilterState, BoardSavedView } from "../types";

const STORAGE_EVENT = "project-collab-hub.board.saved-views.updated";
const STORAGE_KEY = "project-collab-hub.board.saved-views";
const EMPTY_VIEWS: BoardSavedView[] = [];
const NOOP = () => {};

let cachedRaw: null | string | undefined;
let cachedViews: BoardSavedView[] = EMPTY_VIEWS;

const readSavedViews = (): BoardSavedView[] => {
  if (typeof window === "undefined") {
    return EMPTY_VIEWS;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (raw === cachedRaw) {
      return cachedViews;
    }

    cachedRaw = raw;

    if (!raw) {
      cachedViews = EMPTY_VIEWS;
      return cachedViews;
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      cachedViews = EMPTY_VIEWS;
      return cachedViews;
    }

    cachedViews = parsed.filter(
      (item): item is BoardSavedView =>
        typeof item?.filters === "object" &&
        item.filters !== null &&
        typeof item?.id === "string" &&
        typeof item?.name === "string"
    );

    return cachedViews;
  } catch {
    cachedViews = EMPTY_VIEWS;
    return cachedViews;
  }
};

const emitSavedViewsChanged = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(STORAGE_EVENT));
};

const persistSavedViews = (views: BoardSavedView[]) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
  emitSavedViewsChanged();
};

const createViewId = () => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `view-${Date.now()}`;
};

const subscribe = (callback: () => void) => {
  if (typeof window === "undefined") {
    return NOOP;
  }

  const handleChange = () => callback();

  window.addEventListener("storage", handleChange);
  window.addEventListener(STORAGE_EVENT, handleChange);

  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener(STORAGE_EVENT, handleChange);
  };
};

export const useBoardSavedViews = () => {
  const savedViews = useSyncExternalStore(
    subscribe,
    readSavedViews,
    () => EMPTY_VIEWS
  );

  const saveView = useCallback(
    (name: string, filters: BoardFilterState) => {
      const trimmedName = name.trim();
      if (!trimmedName) {
        return false;
      }

      const next = [
        ...savedViews,
        {
          filters,
          id: createViewId(),
          name: trimmedName,
        },
      ];

      persistSavedViews(next);
      return true;
    },
    [savedViews]
  );

  const deleteView = useCallback(
    (id: string) => {
      persistSavedViews(savedViews.filter((view) => view.id !== id));
    },
    [savedViews]
  );

  return {
    deleteView,
    saveView,
    savedViews,
  } as const;
};
