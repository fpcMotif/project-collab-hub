"use client";

import { useCallback, useSyncExternalStore } from "react";

import type { BoardFilterState, BoardSavedView } from "../types";

const STORAGE_KEY = "project-collab-hub.board.saved-views";
const STORAGE_EVENT = "project-collab-hub.board.saved-views.updated";

// Stable empty array for SSR snapshot — must be a cached reference.
const EMPTY_VIEWS: BoardSavedView[] = [];

// Cache the last raw string and parsed result so readSavedViews returns
// a stable reference when localStorage hasn't changed, satisfying
// useSyncExternalStore's requirement that getSnapshot be pure/cached.
let _cachedRaw: string | null = undefined as unknown as null;
let _cachedViews: BoardSavedView[] = EMPTY_VIEWS;

function readSavedViews(): BoardSavedView[] {
  if (typeof window === "undefined") {
    return EMPTY_VIEWS;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    // Return the cached snapshot when the raw string hasn't changed.
    if (raw === _cachedRaw) {
      return _cachedViews;
    }

    _cachedRaw = raw;

    if (!raw) {
      _cachedViews = EMPTY_VIEWS;
      return _cachedViews;
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      _cachedViews = EMPTY_VIEWS;
      return _cachedViews;
    }

    _cachedViews = parsed.filter(
      (item): item is BoardSavedView =>
        typeof item?.id === "string" &&
        typeof item?.name === "string" &&
        typeof item?.filters === "object" &&
        item.filters !== null
    );
    return _cachedViews;
  } catch {
    _cachedViews = EMPTY_VIEWS;
    return _cachedViews;
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
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `view-${Date.now()}`;
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

export function useBoardSavedViews() {
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
}
