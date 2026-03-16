import { ProjectCard } from "./ProjectCard";
import { type ProjectCardData, type ProjectStatus } from "./types";

export function BoardColumn({
  title,
  status,
  projects,
  onDragStart,
  onDropProject,
}: {
  title: string;
  status: ProjectStatus;
  projects: ProjectCardData[];
  onDragStart: (projectId: string) => void;
  onDropProject: (status: ProjectStatus) => void;
}) {
  return (
    <section
      className="min-h-72 rounded-xl border border-zinc-200 bg-zinc-50 p-3"
      onDragOver={(event) => event.preventDefault()}
      onDrop={() => onDropProject(status)}
    >
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs text-zinc-600">{projects.length}</span>
      </header>
      <div className="space-y-2">
        {projects.map((project) => (
          <ProjectCard key={project._id} project={project} onDragStart={onDragStart} />
        ))}
      </div>
    </section>
  );
}
