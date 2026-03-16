"use client";

import dynamic from "next/dynamic";

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

export const Board = dynamic(
  () =>
    import("./board").then((m) => ({
      default: m.Board,
    })),
  { loading: BoardSkeleton, ssr: false }
);
