import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import type {
  ApprovalStatusFilter,
  BoardFilterState,
  OverdueStatusFilter,
  Priority,
  SlaRisk,
} from "../types";

const APPROVAL_STATUS_VALUES = new Set<ApprovalStatusFilter>([
  "pending",
  "clear",
]);
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
const OVERDUE_STATUS_VALUES = new Set<OverdueStatusFilter>([
  "overdue",
  "normal",
]);
const PRIORITY_VALUES = new Set<Priority>(["urgent", "high", "medium", "low"]);
const SLA_RISK_VALUES = new Set<SlaRisk>(["on_time", "at_risk", "overdue"]);

const parsePriority = (value: string | null): null | Priority => {
  if (!value || !PRIORITY_VALUES.has(value as Priority)) {
    return null;
  }

  return value as Priority;
};

const parseSlaRisk = (value: string | null): null | SlaRisk => {
  if (!value || !SLA_RISK_VALUES.has(value as SlaRisk)) {
    return null;
  }

  return value as SlaRisk;
};

const parseApprovalStatus = (
  value: string | null
): ApprovalStatusFilter | null => {
  if (!value || !APPROVAL_STATUS_VALUES.has(value as ApprovalStatusFilter)) {
    return null;
  }

  return value as ApprovalStatusFilter;
};

const parseOverdueStatus = (
  value: string | null
): null | OverdueStatusFilter => {
  if (!value || !OVERDUE_STATUS_VALUES.has(value as OverdueStatusFilter)) {
    return null;
  }

  return value as OverdueStatusFilter;
};

const parseTextFilter = (value: string | null): null | string => {
  return value && value.trim().length > 0 ? value : null;
};

const parseFilters = (params: URLSearchParams): BoardFilterState => {
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
};

const buildUrl = (pathname: string, params: URLSearchParams): string => {
  const queryString = params.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
};

export const useBoardFilters = () => {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

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
    [pathname, router]
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
    [pathname, router, searchParams]
  );

  const clearFilter = useCallback(
    (key: keyof BoardFilterState) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete(key);
      router.replace(buildUrl(pathname, params), { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const clearAll = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of FILTER_KEYS) {
      params.delete(key);
    }
    router.replace(buildUrl(pathname, params), { scroll: false });
  }, [pathname, router, searchParams]);

  return { clearAll, clearFilter, filters, replaceFilters, setFilter } as const;
};