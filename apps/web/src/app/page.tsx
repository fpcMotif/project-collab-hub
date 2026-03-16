"use client";

import { useState } from "react";

function extractReason(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "当前无法拖拽到下一列，请稍后重试。";
}

export default function Home() {
  const [dragErrorReason, setDragErrorReason] = useState<string | null>(null);

  const handleMoveToNextColumn = async () => {
    setDragErrorReason(null);

    try {
      // TODO: 在真实看板接入时，替换为 projects.updateStatus mutation。
      throw new Error(
        "无法迁移阶段：目标阶段存在未通过审批门禁：法务审批、交付验收审批",
      );
    } catch (error) {
      setDragErrorReason(extractReason(error));
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 p-8 text-zinc-900">
      <main className="mx-auto max-w-3xl rounded-xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">项目看板（拖拽错误原因展示）</h1>
        <p className="mt-2 text-sm text-zinc-600">
          当项目拖拽到下一列失败时，会展示后端返回的明确拒绝原因。
        </p>

        <button
          type="button"
          onClick={handleMoveToNextColumn}
          className="mt-6 rounded-md bg-black px-4 py-2 text-white hover:bg-zinc-800"
        >
          模拟拖拽到下一列
        </button>

        {dragErrorReason ? (
          <div className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            <p className="font-medium">无法拖拽到下一列</p>
            <p className="mt-1">{dragErrorReason}</p>
          </div>
        ) : null}
      </main>
    </div>
  );
}
