import {
  ErrorComponent,
  Link,
  rootRouteId,
  useMatch,
  useRouter,
} from "@tanstack/react-router";
import type { ErrorComponentProps } from "@tanstack/react-router";

export const DefaultCatchBoundary = ({ error }: ErrorComponentProps) => {
  const router = useRouter();
  const isRoot = useMatch({
    select: (state) => state.id === rootRouteId,
    strict: false,
  });

  return (
    <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-6 p-4">
      <ErrorComponent error={error} />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => router.invalidate()}
          className="rounded bg-gray-600 px-2 py-1 text-sm font-bold text-white uppercase"
        >
          重试
        </button>
        {isRoot ? (
          <Link
            to="/"
            className="rounded bg-gray-600 px-2 py-1 text-sm font-bold text-white uppercase"
          >
            首页
          </Link>
        ) : (
          <Link
            to="/"
            className="rounded bg-gray-600 px-2 py-1 text-sm font-bold text-white uppercase"
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              window.history.back();
            }}
          >
            返回
          </Link>
        )}
      </div>
    </div>
  );
};
