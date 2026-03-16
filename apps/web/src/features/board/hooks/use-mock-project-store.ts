"use client";

import { useCallback, useSyncExternalStore } from "react";

import { MOCK_PROJECTS } from "../mock-data";
import type { BoardProjectRecord } from "../types";

const STORAGE_EVENT = "project-collab-hub.board.mock-projects.updated";
const STORAGE_KEY = "project-collab-hub.board.mock-projects";
const NOOP = () => {
  /* noop */
};

let cachedProjects: BoardProjectRecord[] = MOCK_PROJECTS;
let cachedRaw: null | string | undefined;

const readProjectRecords = (): BoardProjectRecord[] => {
  if (typeof window === "undefined") {
    return MOCK_PROJECTS;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (raw === cachedRaw) {
      return cachedProjects;
    }

    cachedRaw = raw;

    if (!raw) {
      cachedProjects = MOCK_PROJECTS;
      return cachedProjects;
    }

    const parsed = JSON.parse(raw);
    cachedProjects = Array.isArray(parsed)
      ? (parsed as BoardProjectRecord[])
      : MOCK_PROJECTS;

    return cachedProjects;
  } catch {
    cachedProjects = MOCK_PROJECTS;
    return cachedProjects;
  }
};

const writeProjectRecords = (projects: BoardProjectRecord[]) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  window.dispatchEvent(new Event(STORAGE_EVENT));
};

const subscribe = (listener: () => void) => {
  if (typeof window === "undefined") {
    return NOOP;
  }

  const handleChange = () => listener();

  window.addEventListener("storage", handleChange);
  window.addEventListener(STORAGE_EVENT, handleChange);

  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener(STORAGE_EVENT, handleChange);
  };
};

export const useMockProjectStore = () => {
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
};
