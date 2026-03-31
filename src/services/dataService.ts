import type { SchoolIndex, CampusData, SummaryData, CampusSlug } from "../types";

/** In-memory cache keyed by URL path */
const cache = new Map<string, unknown>();

/**
 * Fetch a JSON file from the /data/ directory.
 * Results are cached in memory so each file is fetched at most once per session.
 */
async function fetchJson<T>(path: string): Promise<T> {
  const cached = cache.get(path);
  if (cached !== undefined) {
    return cached as T;
  }

  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}: ${response.status} ${response.statusText}`);
  }

  const data: T = await response.json();
  cache.set(path, data);
  return data;
}

/**
 * Load the school index containing metadata for all schools.
 * This is typically loaded at startup to enable search and filtering.
 */
export function getSchoolIndex(): Promise<SchoolIndex> {
  return fetchJson<SchoolIndex>("/data/school-index.json");
}

/**
 * Load admissions data for a specific UC campus.
 * Each campus file is loaded on demand and cached for the session.
 *
 * @param campusSlug - The campus identifier (e.g., "berkeley", "systemwide")
 */
export function getCampusData(campusSlug: CampusSlug): Promise<CampusData> {
  return fetchJson<CampusData>(`/data/campus-${campusSlug}.json`);
}

/**
 * Load the pre-computed summary data used on the landing page.
 * Contains aggregate statistics for public vs. private comparisons.
 */
export function getSummary(): Promise<SummaryData> {
  return fetchJson<SummaryData>("/data/summary.json");
}

/**
 * Clear the in-memory cache. Primarily useful for testing.
 */
export function clearCache(): void {
  cache.clear();
}
