import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { BoardFilterState } from "../types";

const FILTER_KEYS: (keyof BoardFilterState)[] = ["priority", "slaRisk", "owner", "customer"];

function parseFilters(params: URLSearchParams): BoardFilterState {
  return {
    priority: (params.get("priority") as BoardFilterState["priority"]) ?? null,
    slaRisk: (params.get("slaRisk") as BoardFilterState["slaRisk"]) ?? null,
    owner: params.get("owner") ?? null,
    customer: params.get("customer") ?? null,
  };
}

export function useBoardFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);

  const setFilter = useCallback(
    <K extends keyof BoardFilterState>(key: K, value: BoardFilterState[K]) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === null) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname],
  );

  const clearFilter = useCallback(
    (key: keyof BoardFilterState) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete(key);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname],
  );

  const clearAll = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of FILTER_KEYS) {
      params.delete(key);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [searchParams, router, pathname]);

  return { filters, setFilter, clearFilter, clearAll } as const;
}
