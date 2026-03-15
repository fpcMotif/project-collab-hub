import { Suspense } from "react";
import { Board } from "@/features/board/components/Board";

export const metadata = {
  title: "看板 - Project Collab Hub",
};

export default function BoardPage() {
  return (
    <div className="flex h-screen flex-col bg-gray-100">
      {/* Top bar */}
      <header className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <h1 className="text-lg font-bold text-gray-900">项目看板</h1>
      </header>

      {/* Board area */}
      <main className="flex-1 overflow-hidden p-4">
        <Suspense fallback={<BoardSkeleton />}>
          <Board />
        </Suspense>
      </main>
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div className="flex h-full gap-3 overflow-x-auto">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="min-w-[260px] animate-pulse rounded-xl bg-gray-50 p-4">
          <div className="mb-4 h-4 w-24 rounded bg-gray-200" />
          <div className="space-y-3">
            <div className="h-28 rounded-lg bg-gray-200" />
            <div className="h-28 rounded-lg bg-gray-200" />
          </div>
        </div>
      ))}
    </div>
  );
}
