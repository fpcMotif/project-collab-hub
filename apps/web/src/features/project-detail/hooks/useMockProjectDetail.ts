"use client";

import { useMemo } from "react";
import { useMockProjectStore } from "@/features/board/hooks/useMockProjectStore";
import { getMockProjectDetail } from "../mock-data";

export function useMockProjectDetail(projectId: string) {
  const { projects } = useMockProjectStore();

  const detail = useMemo(() => getMockProjectDetail(projectId, projects), [projectId, projects]);

  return {
    detail,
    isLoading: false,
  } as const;
}
