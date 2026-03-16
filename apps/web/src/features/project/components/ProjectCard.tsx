"use client";

import { type BoardProject } from "@/features/board/types";

type Props = {
  project: BoardProject;
  onOpen: (project: BoardProject) => void;
};

export function ProjectCard({ project, onOpen }: Props) {
  return (
    <button
      type="button"
      onClick={() => onOpen(project)}
      className="w-full rounded-lg border border-zinc-200 bg-white p-3 text-left shadow-sm transition hover:border-blue-300"
    >
      <p className="text-sm font-semibold">{project.name}</p>
      <p className="text-xs text-zinc-500">客户：{project.customerName ?? "-"}</p>
      <p className="text-xs text-zinc-500">Owner：{project.ownerId}</p>
      <p className="text-xs text-zinc-500">阶段：{project.status}</p>
      <p className="text-xs text-zinc-600">
        部门状态：{project.summary.departmentStatus.done}/{project.summary.departmentStatus.total} 完成，
        {project.summary.departmentStatus.blocked} 阻塞
      </p>
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <Tag label={`待审批 ${project.summary.pendingApprovals}`} />
        <Tag label={`逾期 ${project.summary.overdueTasks}`} tone="warn" />
        <Tag label={`优先级 ${project.priority ?? "medium"}`} />
        <Tag label={`SLA ${project.summary.slaRisk}`} tone={project.summary.slaRisk === "critical" ? "danger" : "normal"} />
      </div>
    </button>
  );
}

function Tag({
  label,
  tone = "normal",
}: {
  label: string;
  tone?: "normal" | "warn" | "danger";
}) {
  const toneClass =
    tone === "danger"
      ? "border-red-200 bg-red-50 text-red-700"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-zinc-200 bg-zinc-50 text-zinc-600";

  return <span className={`rounded border px-1.5 py-0.5 ${toneClass}`}>{label}</span>;
}
