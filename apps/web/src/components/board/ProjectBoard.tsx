"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { BoardColumn } from "./BoardColumn";
import { BOARD_COLUMNS, type ProjectCardData, type ProjectStatus } from "./types";
import { BoardFilters, type BoardFilterState } from "./BoardFilters";

const DEFAULT_FILTERS: BoardFilterState = {
  ownerId: "",
  departmentId: "",
  priority: "",
  approvalStatus: "",
  overdueOnly: false,
};

export function ProjectBoard() {
  const data = useQuery("dashboard:projectBoardData" as never, {});
  const updateStatus = useMutation("projects:updateStatus" as never);
  const [filters, setFilters] = useState<BoardFilterState>(DEFAULT_FILTERS);
  const [draggingProjectId, setDraggingProjectId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const projects = (data?.projects ?? []) as ProjectCardData[];
  const ownerOptions = useMemo(
    () => [...new Set(projects.map((project) => project.ownerId))].sort(),
    [projects],
  );
  const departmentOptions = useMemo(
    () => [...new Set(projects.map((project) => project.departmentId))].sort(),
    [projects],
  );

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      if (filters.ownerId && project.ownerId !== filters.ownerId) return false;
      if (filters.departmentId && project.departmentId !== filters.departmentId) return false;
      if (filters.priority && (project.priority ?? "") !== filters.priority) return false;

      const approvalStatus = data?.latestApprovalStatusByProject?.[project._id] ?? "";
      if (filters.approvalStatus && approvalStatus !== filters.approvalStatus) return false;

      const isOverdue = (data?.overdueProjectIds ?? []).includes(project._id);
      if (filters.overdueOnly && !isOverdue) return false;

      return true;
    });
  }, [data?.latestApprovalStatusByProject, data?.overdueProjectIds, filters, projects]);

  const handleDrop = async (status: ProjectStatus) => {
    if (!draggingProjectId) return;

    const current = projects.find((project) => project._id === draggingProjectId);
    if (!current || current.status === status) return;

    try {
      setErrorMessage("");
      await updateStatus({ id: draggingProjectId, status, actorId: "web-user" } as never);
    } catch (error) {
      const message = error instanceof Error ? error.message : "状态更新失败";
      if (message.includes("GATE_BLOCKED:")) {
        setErrorMessage(message.replace("GATE_BLOCKED:", ""));
      } else {
        setErrorMessage(`迁移失败：${message}`);
      }
    } finally {
      setDraggingProjectId(null);
    }
  };

  return (
    <div className="space-y-4">
      <section className="grid gap-3 md:grid-cols-4">
        <MetricCard label="项目总数" value={projects.length} />
        <MetricCard label="待审批" value={data?.pendingApprovalCount ?? 0} />
        <MetricCard label="逾期任务" value={data?.overdueTaskCount ?? 0} />
        <MetricCard label="部门状态总类" value={Object.keys(data?.departmentStatusSummary ?? {}).length} />
      </section>

      <BoardFilters
        value={filters}
        onChange={setFilters}
        ownerOptions={ownerOptions}
        departmentOptions={departmentOptions}
      />

      {errorMessage ? <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">{errorMessage}</p> : null}

      <section className="grid gap-3 xl:grid-cols-4 md:grid-cols-2">
        {BOARD_COLUMNS.map((column) => (
          <BoardColumn
            key={column.status}
            title={column.title}
            status={column.status}
            projects={filteredProjects.filter((project) => project.status === column.status)}
            onDragStart={setDraggingProjectId}
            onDropProject={handleDrop}
          />
        ))}
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-zinc-900">{value}</p>
    </div>
  );
}
