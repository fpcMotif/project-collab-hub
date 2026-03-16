import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";

import type {
  ApprovalStatusFilter,
  BoardFilterState,
  OverdueStatusFilter,
  Priority,
  SlaRisk,
} from "../types";

const FILTER_KEYS: (keyof BoardFilterState)[] = [
  "priority",
  "slaRisk",
  "owner",
  "customer",
  "department",
  "approvalStatus",
  "overdueStatus",
  "templateType",
];
const PRIORITY_VALUES = new Set<Priority>(["urgent", "high", "medium", "low"]);
const SLA_RISK_VALUES = new Set<SlaRisk>(["on_time", "at_risk", "overdue"]);
const APPROVAL_STATUS_VALUES = new Set<ApprovalStatusFilter>([
  "pending",
  "clear",
]);
const OVERDUE_STATUS_VALUES = new Set<OverdueStatusFilter>([
  "overdue",
  "normal",
]);

function parsePriority(value: string | null): Priority | null {
  if (!value || !PRIORITY_VALUES.has(value as Priority)) {
    return null;
  }

  return value as Priority;
}

function parseSlaRisk(value: string | null): SlaRisk | null {
  if (!value || !SLA_RISK_VALUES.has(value as SlaRisk)) {
    return null;
  }

  return value as SlaRisk;
}

function parseApprovalStatus(
  value: string | null
): ApprovalStatusFilter | null {
  if (!value || !APPROVAL_STATUS_VALUES.has(value as ApprovalStatusFilter)) {
    return null;
  }

  return value as ApprovalStatusFilter;
}

function parseOverdueStatus(value: string | null): OverdueStatusFilter | null {
  if (!value || !OVERDUE_STATUS_VALUES.has(value as OverdueStatusFilter)) {
    return null;
  }

  return value as OverdueStatusFilter;
}

function parseTextFilter(value: string | null): string | null {
  return value && value.trim().length > 0 ? value : null;
}

function parseFilters(params: URLSearchParams): BoardFilterState {
  return {
    approvalStatus: parseApprovalStatus(params.get("approvalStatus")),
    customer: parseTextFilter(params.get("customer")),
    department: parseTextFilter(params.get("department")),
    overdueStatus: parseOverdueStatus(params.get("overdueStatus")),
    owner: parseTextFilter(params.get("owner")),
    priority: parsePriority(params.get("priority")),
    slaRisk: parseSlaRisk(params.get("slaRisk")),
    templateType: parseTextFilter(params.get("templateType")),
  };
}

function buildUrl(pathname: string, params: URLSearchParams): string {
  const queryString = params.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}

export function useBoardFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);

  const replaceFilters = useCallback(
    (nextFilters: BoardFilterState) => {
      const params = new URLSearchParams();

      for (const key of FILTER_KEYS) {
        const value = nextFilters[key];
        if (value !== null) {
          params.set(key, value);
        }
      }

      router.replace(buildUrl(pathname, params), { scroll: false });
    },
    [router, pathname]
  );

  const setFilter = useCallback(
    <K extends keyof BoardFilterState>(key: K, value: BoardFilterState[K]) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === null) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      router.replace(buildUrl(pathname, params), { scroll: false });
    },
    [searchParams, router, pathname]
  );

  const clearFilter = useCallback(
    (key: keyof BoardFilterState) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete(key);
      router.replace(buildUrl(pathname, params), { scroll: false });
    },
    [searchParams, router, pathname]
  );

  const clearAll = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of FILTER_KEYS) {
      params.delete(key);
    }
    router.replace(buildUrl(pathname, params), { scroll: false });
  }, [searchParams, router, pathname]);

  return { clearAll, clearFilter, filters, replaceFilters, setFilter } as const;
}
