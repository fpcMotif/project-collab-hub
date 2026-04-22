import { Link } from "@tanstack/react-router";

export const NotFound = () => (
  <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-4">
    <p className="text-lg text-gray-600">页面未找到</p>
    <Link
      to="/"
      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
    >
      返回首页
    </Link>
  </div>
);
