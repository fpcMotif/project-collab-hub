import { ProjectBoard } from "@/components/board/ProjectBoard";

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-100 p-6">
      <div className="mx-auto max-w-[1400px] space-y-4">
        <h1 className="text-2xl font-bold text-zinc-900">协作项目看板（MVP）</h1>
        <ProjectBoard />
      </div>
    </main>
  );
}
