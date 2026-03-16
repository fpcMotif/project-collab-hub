"use client";

import { ProjectCard } from "@/features/project/components/ProjectCard";
import { type BoardProject, type BoardStatus } from "../types";

type Props = {
  title: string;
  status: BoardStatus;
  projects: BoardProject[];
  onOpenProject: (project: BoardProject) => void;
};

export function BoardColumn({ title, projects, onOpenProject }: Props) {
  return (
    <section className="min-w-72 flex-1 rounded-xl bg-zinc-100/70 p-2">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-700">{title}</h3>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs text-zinc-500">
          {projects.length}
        </span>
      </div>
      <div className="space-y-2">
        {projects.map((project) => (
          <ProjectCard key={project._id} project={project} onOpen={onOpenProject} />
        ))}
      </div>
    </section>
  );
}
