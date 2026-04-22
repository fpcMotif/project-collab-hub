import { createFileRoute, Link } from "@tanstack/react-router";
import { Suspense, lazy } from "react";

const Board = lazy(async () => {
  const m = await import("@/features/board/components/board");
  return { default: m.Board };
});

const BoardSkeleton = () => (
  <div className="flex h-full gap-3 overflow-x-auto">
    {Array.from({ length: 8 }).map((_, i) => (
      <div
        key={i}
        className="min-w-[260px] animate-pulse rounded-xl bg-gray-50 p-4"
      >
        <div className="mb-4 h-4 w-24 rounded bg-gray-200" />
        <div className="space-y-3">
          <div className="h-28 rounded-lg bg-gray-200" />
          <div className="h-28 rounded-lg bg-gray-200" />
        </div>
      </div>
    ))}
  </div>
);

const BoardPage = () => (
  <div className="flex h-screen flex-col bg-gray-100">
    <header className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
      <h1 className="text-lg font-bold text-gray-900">项目看板</h1>
      <Link
        to="/projects/new"
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        新建项目
      </Link>
    </header>
    <main className="flex-1 overflow-hidden p-4">
      <Suspense fallback={<BoardSkeleton />}>
        <Board />
      </Suspense>
    </main>
  </div>
);

export const Route = createFileRoute("/board")({
  component: BoardPage,
  head: () => ({
    meta: [{ title: "项目看板 - Project Collab Hub" }],
  }),
});
