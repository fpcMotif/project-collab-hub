import { useMemo } from "react";
import { BOARD_COLUMNS } from "../constants";
import { MOCK_PROJECTS } from "../mock-data";
import type { BoardFilterState } from "../types";

/**
 * Single swap-point for data source.
 * Currently returns mock data; will be replaced with a Convex query.
 */
export function useBoardData(filters: BoardFilterState) {
  const filtered = useMemo(() => {
    let result = MOCK_PROJECTS;

    if (filters.priority) {
      result = result.filter((p) => p.priority === filters.priority);
    }
    if (filters.slaRisk) {
      result = result.filter((p) => p.slaRisk === filters.slaRisk);
    }
    if (filters.owner) {
      result = result.filter((p) => p.ownerName === filters.owner);
    }
    if (filters.customer) {
      result = result.filter((p) => p.customerName === filters.customer);
    }

    return result;
  }, [filters]);

  const columns = useMemo(
    () =>
      BOARD_COLUMNS.map((col) => ({
        id: col.id,
        name: col.name,
        cards: filtered.filter((p) => p.status === col.projectStatus),
      })),
    [filtered],
  );

  /** Unique owner names for filter dropdown */
  const ownerOptions = useMemo(() => {
    const owners = [...new Set(MOCK_PROJECTS.map((p) => p.ownerName))].sort();
    return owners.map((o) => ({ value: o, label: o }));
  }, []);

  /** Unique customer names for filter dropdown */
  const customerOptions = useMemo(() => {
    const customers = [...new Set(MOCK_PROJECTS.map((p) => p.customerName))].sort();
    return customers.map((c) => ({ value: c, label: c }));
  }, []);

  return { columns, ownerOptions, customerOptions } as const;
}
