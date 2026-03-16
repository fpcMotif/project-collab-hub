import Link from "next/link";

import { Board } from "@/features/board/components/board-client-wrapper";

export const metadata = {
  title: "看板 - Project Collab Hub",
};

const BoardPage = () => (
  <div className="flex h-screen flex-col bg-gray-100">
    <header className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
      <h1 className="text-lg font-bold text-gray-900">项目看板</h1>
      <Link
        href="/projects/new"
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        新建项目
      </Link>
    </header>
    <main className="flex-1 overflow-hidden p-4">
      <Board />
    </main>
  </div>
);

export default BoardPage;
