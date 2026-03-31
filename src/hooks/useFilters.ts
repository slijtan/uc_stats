import { useState, useCallback } from "react";
import type { CampusSlug, SchoolType } from "../types/index.ts";

export interface FilterState {
  campus: CampusSlug;
  year: number | null;
  schoolType: SchoolType | null;
  county: string | null;
}

const DEFAULT_FILTERS: FilterState = {
  campus: "systemwide",
  year: null,
  schoolType: null,
  county: null,
};

interface UseFiltersResult {
  filters: FilterState;
  setFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  resetFilters: () => void;
}

/**
 * Custom hook for managing filter state across the application.
 * Provides campus, year, school type, and county filter values.
 */
export function useFilters(
  initialFilters?: Partial<FilterState>,
): UseFiltersResult {
  const [filters, setFilters] = useState<FilterState>({
    ...DEFAULT_FILTERS,
    ...initialFilters,
  });

  const setFilter = useCallback(
    <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const resetFilters = useCallback(() => {
    setFilters({ ...DEFAULT_FILTERS, ...initialFilters });
  }, [initialFilters]);

  return { filters, setFilter, resetFilters };
}
