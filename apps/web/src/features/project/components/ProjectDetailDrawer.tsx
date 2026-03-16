"use client";

import { type BoardProject } from "@/features/board/types";

type Props = {
  project: BoardProject | null;
  onClose: () => void;
};

export function ProjectDetailDrawer({ project, onClose }: Props) {
  if (!project) return null;

  return (
    <aside className="fixed top-0 right-0 z-20 h-full w-full max-w-xl overflow-y-auto border-l border-zinc-200 bg-white p-4 shadow-2xl">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold">{project.name}</h2>
          <p className="text-sm text-zinc-500">项目详情</p>
        </div>
        <button type="button" className="text-sm text-zinc-500" onClick={onClose}>
          关闭
        </button>
      </div>

      <section className="mb-4">
        <h3 className="mb-2 text-sm font-semibold">部门工作流</h3>
        <ul className="space-y-2 text-sm">
          {project.detail.departmentWorkflow.map((item) => (
            <li key={item._id} className="rounded border border-zinc-200 p-2">
              {item.departmentName} · {item.status} · owner {item.ownerId ?? "-"}
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-4">
        <h3 className="mb-2 text-sm font-semibold">行动项</h3>
        <ul className="space-y-2 text-sm">
          {project.detail.actionItems.map((item) => (
            <li key={item._id} className="rounded border border-zinc-200 p-2">
              {item.title} · {item.status} · {item.priority}
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-4 flex gap-2 text-sm">
        <button type="button" className="rounded border border-zinc-300 px-3 py-1">
          评论线程入口 ({project.detail.commentsCount})
        </button>
        <button type="button" className="rounded border border-zinc-300 px-3 py-1">
          时间线入口 ({project.detail.timeline.length})
        </button>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold">最近时间线</h3>
        <ul className="space-y-2 text-xs text-zinc-600">
          {project.detail.timeline.map((item) => (
            <li key={item._id} className="rounded border border-zinc-200 p-2">
              {item.action}: {item.changeSummary}
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
