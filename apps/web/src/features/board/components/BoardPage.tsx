"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { BOARD_COLUMNS } from "../constants";
import {
  EMPTY_FILTERS,
  type BoardFilters,
  type BoardProject,
  type BoardResponse,
  type SavedView,
} from "../types";
import { BoardColumn } from "./BoardColumn";
import { BoardFiltersPanel } from "./BoardFilters";
import { ProjectDetailDrawer } from "@/features/project/components/ProjectDetailDrawer";

const SAVED_VIEW_KEY = "board_saved_views";

export function BoardPage() {
  const [filters, setFilters] = useState<BoardFilters>(EMPTY_FILTERS);
  const [activeProject, setActiveProject] = useState<BoardProject | null>(null);
  const [savedViews, setSavedViews] = useState<SavedView[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(SAVED_VIEW_KEY);
      return raw ? (JSON.parse(raw) as SavedView[]) : [];
    } catch {
      return [];
    }
  });

  const data = useQuery("board:getBoardData" as never, {
    filters,
  }) as BoardResponse | undefined;

  const grouped = useMemo(() => {
    const projects = data?.projects ?? [];
    return BOARD_COLUMNS.map((column) => ({
      ...column,
      projects: projects.filter((item) => item.status === column.status),
    }));
  }, [data?.projects]);

  const persistViews = (views: SavedView[]) => {
    setSavedViews(views);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SAVED_VIEW_KEY, JSON.stringify(views));
    }
  };

  return (
    <main className="min-h-screen bg-zinc-50 p-4">
      <h1 className="mb-3 text-2xl font-bold">项目协作看板</h1>

      <BoardFiltersPanel
        options={data?.options ?? { departments: [], owners: [], customers: [], templateTypes: [] }}
        filters={filters}
        onChange={setFilters}
        savedViews={savedViews}
        onSaveView={(name) => {
          const next = [
            ...savedViews,
            { id: crypto.randomUUID(), name, filters: structuredClone(filters) },
          ];
          persistViews(next);
        }}
        onApplyView={(id) => {
          const found = savedViews.find((item) => item.id === id);
          if (found) setFilters(found.filters);
        }}
      />

      <section className="mt-4 flex gap-3 overflow-x-auto pb-4">
        {grouped.map((column) => (
          <BoardColumn
            key={column.status}
            title={column.title}
            status={column.status}
            projects={column.projects}
            onOpenProject={setActiveProject}
          />
        ))}
      </section>

      <ProjectDetailDrawer project={activeProject} onClose={() => setActiveProject(null)} />
    </main>
  );
}
