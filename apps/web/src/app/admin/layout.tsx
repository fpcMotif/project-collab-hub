import Link from "next/link";
import { type ReactNode } from "react";

const links = [
  { href: "/admin/templates", label: "模板管理" },
  { href: "/admin/notification-rules", label: "通知规则" },
  { href: "/admin/integration-health", label: "集成健康" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="rounded-xl bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-semibold">Admin Console</h1>
          <nav className="mt-4 flex flex-wrap gap-3 text-sm">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md border border-slate-300 px-3 py-2 hover:bg-slate-100"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </header>
        {children}
      </div>
    </div>
  );
}
