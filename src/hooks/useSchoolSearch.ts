import { useState, useEffect, useMemo, useCallback } from "react";
import Fuse from "fuse.js";
import type { IFuseOptions } from "fuse.js";
import type { School, SchoolIndex } from "../types/index.ts";
import { getSchoolIndex } from "../services/dataService.ts";

interface UseSchoolSearchResult {
  /** Perform a fuzzy search over the school index */
  search: (query: string) => School[];
  /** Whether the school index is still loading */
  loading: boolean;
  /** Error that occurred during loading, if any */
  error: string | null;
  /** The full school index, once loaded */
  schools: School[];
}

const FUSE_OPTIONS: IFuseOptions<School> = {
  keys: [
    { name: "name", weight: 0.6 },
    { name: "city", weight: 0.2 },
    { name: "county", weight: 0.2 },
  ],
  threshold: 0.4,
  includeScore: true,
  minMatchCharLength: 2,
};

/**
 * Custom hook that initializes Fuse.js over the school index
 * and provides a search function for fuzzy matching.
 */
export function useSchoolSearch(): UseSchoolSearchResult {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadIndex() {
      try {
        const index: SchoolIndex = await getSchoolIndex();
        if (!cancelled) {
          setSchools(index.schools);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load school index",
          );
          setLoading(false);
        }
      }
    }

    void loadIndex();

    return () => {
      cancelled = true;
    };
  }, []);

  const fuse = useMemo(() => {
    if (schools.length === 0) return null;
    return new Fuse(schools, FUSE_OPTIONS);
  }, [schools]);

  const search = useCallback(
    (query: string): School[] => {
      if (!fuse || query.trim().length < 2) return [];
      const results = fuse.search(query, { limit: 10 });
      return results.map((r) => r.item);
    },
    [fuse],
  );

  return { search, loading, error, schools };
}
