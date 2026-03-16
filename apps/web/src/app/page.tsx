export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 p-10 text-zinc-900">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-semibold">Project Collab Hub</h1>
        <p className="text-zinc-600">
          协作平台后台已预留角色配置入口，可用于统一管理权限角色与绑定。
        </p>

        <section className="rounded-xl border border-zinc-200 p-5">
          <h2 className="text-xl font-medium">管理后台入口（预留）</h2>
          <p className="mt-2 text-sm text-zinc-600">
            当前支持的平台角色模板：Platform Admin / Workspace Admin / Owner / Contributor / Viewer。
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              "Platform Admin",
              "Workspace Admin",
              "Owner",
              "Contributor",
              "Viewer",
            ].map((role) => (
              <span
                key={role}
                className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-700"
              >
                {role}
              </span>
            ))}
          </div>
          <button
            type="button"
            className="mt-6 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
          >
            打开角色配置（即将上线）
          </button>
        </section>
      </main>
    </div>
  );
}
