import Link from "next/link";
import { type ProjectCardData } from "./types";

export function ProjectCard({
  project,
  onDragStart,
}: {
  project: ProjectCardData;
  onDragStart: (projectId: string) => void;
}) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(project._id)}
      className="space-y-2 rounded-lg border border-zinc-200 bg-white p-3 shadow-sm"
    >
      <Link href={`/projects/${project._id}`} className="block text-sm font-semibold text-zinc-900 hover:underline">
        {project.name}
      </Link>
      <p className="line-clamp-2 text-xs text-zinc-600">{project.description}</p>
      <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
        <span>Owner: {project.ownerId}</span>
        <span>Dept: {project.departmentId}</span>
        <span>Priority: {project.priority ?? "-"}</span>
      </div>
    </div>
  );
}
