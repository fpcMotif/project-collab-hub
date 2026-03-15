"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { BoardProjectRecord } from "../types";
import { MOCK_PROJECTS } from "../mock-data";

const STORAGE_KEY = "project-collab-hub.board.mock-projects";
const STORAGE_EVENT = "project-collab-hub.board.mock-projects.updated";

function readProjectRecords() {
  if (typeof window === "undefined") {
    return MOCK_PROJECTS;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return MOCK_PROJECTS;
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as BoardProjectRecord[]) : MOCK_PROJECTS;
  } catch {
    return MOCK_PROJECTS;
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

export function useMockProjectStore() {
  const projects = useSyncExternalStore(subscribe, readProjectRecords, () => MOCK_PROJECTS);

  const replaceProjects = useCallback((nextProjects: BoardProjectRecord[]) => {
    writeProjectRecords(nextProjects);
  }, []);

  const addProject = useCallback((project: BoardProjectRecord) => {
    writeProjectRecords([...projects, project]);
  }, [projects]);

  return {
    projects,
    replaceProjects,
    addProject,
  } as const;
}
