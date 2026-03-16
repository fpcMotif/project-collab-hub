"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const detail = useQuery("projects:getDetailOverview" as never, projectId ? ({ id: projectId } as never) : "skip");

  if (!projectId) {
    return <main className="p-6">项目 ID 缺失。</main>;
  }

  if (detail === undefined) {
    return <main className="p-6">加载中...</main>;
  }

  if (!detail) {
    return (
      <main className="p-6 space-y-3">
        <p>项目不存在。</p>
        <Link href="/" className="text-blue-600 hover:underline">
          返回看板
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-100 p-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <Link href="/" className="text-sm text-blue-700 hover:underline">
          ← 返回看板
        </Link>
        <section className="rounded-xl border bg-white p-5">
          <h1 className="text-2xl font-bold">{detail.project.name}</h1>
          <p className="mt-2 text-sm text-zinc-600">{detail.project.description}</p>
          <div className="mt-3 flex gap-4 text-sm text-zinc-500">
            <span>状态：{detail.project.status}</span>
            <span>负责人：{detail.project.ownerId}</span>
            <span>部门：{detail.project.departmentId}</span>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded-xl border bg-white p-4">
            <h2 className="mb-3 text-lg font-semibold">工作流概览</h2>
            <ul className="space-y-2 text-sm">
              {detail.departmentTracks.map((track) => (
                <li key={track._id} className="rounded border p-2">
                  <p className="font-medium">{track.departmentName}</p>
                  <p className="text-zinc-600">状态：{track.status}</p>
                </li>
              ))}
            </ul>
            <h3 className="mt-4 mb-2 font-semibold">审批门禁</h3>
            <ul className="space-y-2 text-sm">
              {detail.approvalGates.map((gate) => (
                <li key={gate._id} className="rounded border p-2">
                  <p>{gate.title}</p>
                  <p className="text-zinc-600">阶段：{gate.triggerStage} · 状态：{gate.status}</p>
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-xl border bg-white p-4">
            <h2 className="mb-3 text-lg font-semibold">评论线程</h2>
            <ul className="space-y-2 text-sm">
              {detail.comments.map((comment) => (
                <li key={comment._id} className="rounded border p-2">
                  <p className="font-medium">{comment.authorId}</p>
                  <p className="text-zinc-700">{comment.isDeleted ? "（已删除）" : comment.body}</p>
                </li>
              ))}
              {detail.comments.length === 0 ? <li className="text-zinc-500">暂无评论</li> : null}
            </ul>
          </article>
        </section>
      </div>
    </main>
  );
}
