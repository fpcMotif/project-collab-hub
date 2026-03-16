"use client";

import { useCallback, useSyncExternalStore } from "react";

import { MOCK_PROJECTS } from "../mock-data";
import type { BoardProjectRecord } from "../types";

const STORAGE_KEY = "project-collab-hub.board.mock-projects";
const STORAGE_EVENT = "project-collab-hub.board.mock-projects.updated";

// Cache the last raw string and parsed result so readProjectRecords returns
// a stable reference when localStorage hasn't changed.
let _cachedRaw: string | null = undefined as unknown as null;
let _cachedProjects: BoardProjectRecord[] = MOCK_PROJECTS;

function readProjectRecords(): BoardProjectRecord[] {
  if (typeof window === "undefined") {
    return MOCK_PROJECTS;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (raw === _cachedRaw) {
      return _cachedProjects;
    }

    _cachedRaw = raw;

    if (!raw) {
      _cachedProjects = MOCK_PROJECTS;
      return _cachedProjects;
    }

    const parsed = JSON.parse(raw);
    _cachedProjects = Array.isArray(parsed)
      ? (parsed as BoardProjectRecord[])
      : MOCK_PROJECTS;
    return _cachedProjects;
  } catch {
    _cachedProjects = MOCK_PROJECTS;
    return _cachedProjects;
  }
}

function writeProjectRecords(projects: BoardProjectRecord[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
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

export function useMockProjectStore() {
  const projects = useSyncExternalStore(
    subscribe,
    readProjectRecords,
    () => MOCK_PROJECTS
  );

  const replaceProjects = useCallback((nextProjects: BoardProjectRecord[]) => {
    writeProjectRecords(nextProjects);
  }, []);

  const addProject = useCallback(
    (project: BoardProjectRecord) => {
      writeProjectRecords([...projects, project]);
    },
    [projects]
  );

  return {
    addProject,
    projects,
    replaceProjects,
  } as const;
}
