import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import type {
  School,
  SchoolIndex,
  CampusData,
  CampusSlug,
} from "../types/index.ts";
import { getSchoolIndex, getCampusData } from "../services/dataService.ts";
import SchoolSearch from "../components/search/SchoolSearch.tsx";
import CampusMultiSelect from "../components/filters/CampusMultiSelect.tsx";

/** Individual campus slugs (no systemwide) */
const CAMPUS_SLUGS: CampusSlug[] = [
  "berkeley", "davis", "irvine", "la", "merced",
  "riverside", "san-diego", "santa-barbara", "santa-cruz",
];

const MAX_SCHOOLS = 5;

/** Fixed color palette for compared schools */
const SCHOOL_COLORS = [
  "#2563eb", // blue
  "#db2777", // pink
  "#059669", // green
  "#d97706", // amber
  "#7c3aed", // purple
];

/** Light background versions for chips */
const SCHOOL_CHIP_BG = [
  "#dbeafe",
  "#fce7f3",
  "#d1fae5",
  "#fef3c7",
  "#ede9fe",
];

/** Text colors for chips */
const SCHOOL_CHIP_TEXT = [
  "#1e40af",
  "#9d174d",
  "#065f46",
  "#92400e",
  "#5b21b6",
];

export default function MultiComparePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [schoolIndex, setSchoolIndex] = useState<SchoolIndex | null>(null);
  const [campusDataMap, setCampusDataMap] = useState<Map<CampusSlug, CampusData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCampuses, setSelectedCampuses] = useState<CampusSlug[]>([...CAMPUS_SLUGS]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  // Selected school IDs from URL query params
  const selectedSchoolIds = useMemo(() => {
    const param = searchParams.get("schools");
    if (!param) return [] as string[];
    return param.split(",").filter(Boolean).slice(0, MAX_SCHOOLS);
  }, [searchParams]);

  const setSelectedSchoolIds = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) {
        setSearchParams({});
      } else {
        setSearchParams({ schools: ids.join(",") });
      }
    },
    [setSearchParams],
  );

  // Load school index + all campus data on mount
  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      try {
        const [index, ...campusResults] = await Promise.all([
          getSchoolIndex(),
          ...CAMPUS_SLUGS.map((slug) => getCampusData(slug)),
        ]);
        if (cancelled) return;
        const map = new Map<CampusSlug, CampusData>();
        CAMPUS_SLUGS.forEach((slug, i) => map.set(slug, campusResults[i]!));
        setSchoolIndex(index);
        setCampusDataMap(map);

        let maxYear = 0;
        for (const cd of campusResults) {
          if (cd.yearRange.max > maxYear) maxYear = cd.yearRange.max;
        }
        if (maxYear > 0) setSelectedYear(maxYear);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load data");
          setLoading(false);
        }
      }
    }
    loadData();
    return () => { cancelled = true; };
  }, []);

  // Resolve selected school IDs to School objects
  const selectedSchools = useMemo(() => {
    if (!schoolIndex) return [];
    const map = new Map(schoolIndex.schools.map((s) => [s.id, s]));
    return selectedSchoolIds
      .map((id) => map.get(id))
      .filter((s): s is School => s !== undefined);
  }, [schoolIndex, selectedSchoolIds]);

  // Derive available years
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    for (const cd of campusDataMap.values()) {
      for (let y = cd.yearRange.min; y <= cd.yearRange.max; y++) years.add(y);
    }
    return [...years].sort((a, b) => b - a);
  }, [campusDataMap]);

  const handleAddSchool = useCallback(
    (school: School) => {
      if (selectedSchoolIds.length >= MAX_SCHOOLS) return;
      if (selectedSchoolIds.includes(school.id)) return;
      setSelectedSchoolIds([...selectedSchoolIds, school.id]);
    },
    [selectedSchoolIds, setSelectedSchoolIds],
  );

  const handleRemoveSchool = useCallback(
    (schoolId: string) => {
      setSelectedSchoolIds(selectedSchoolIds.filter((id) => id !== schoolId));
    },
    [selectedSchoolIds, setSelectedSchoolIds],
  );

  if (loading) {
    return <div className="page-loading">Loading campus data…</div>;
  }

  if (error) {
    return (
      <div className="page-error">
        <h2>Error</h2>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="multi-compare-page">
      <h1 className="page-title">Compare Schools</h1>
      <p className="page-description">Compare up to 5 high schools side by side</p>

      {/* School Selector */}
      <div style={{ marginTop: "var(--space-6)" }}>
        {selectedSchools.length > 0 && (
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "var(--space-3)" }}>
            {selectedSchools.map((school, i) => (
              <span
                key={school.id}
                style={{
                  background: SCHOOL_CHIP_BG[i],
                  color: SCHOOL_CHIP_TEXT[i],
                  padding: "6px 12px",
                  borderRadius: "6px",
                  fontSize: "var(--font-size-sm)",
                  fontWeight: 500,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span style={{
                  width: 10, height: 10, borderRadius: "50%",
                  background: SCHOOL_COLORS[i], display: "inline-block",
                }} />
                {school.name}
                <button
                  type="button"
                  onClick={() => handleRemoveSchool(school.id)}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "inherit", opacity: 0.6, padding: 0, fontSize: "inherit",
                  }}
                  aria-label={`Remove ${school.name}`}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
        {selectedSchools.length < MAX_SCHOOLS && (
          <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
            <SchoolSearch
              placeholder="Add a school to compare..."
              onSelect={handleAddSchool}
              navigateOnSelect={false}
            />
            <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>
              {selectedSchools.length} of {MAX_SCHOOLS} selected
            </span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="filter-group" style={{ marginTop: "var(--space-6)" }}>
        <CampusMultiSelect
          selected={selectedCampuses}
          onChange={setSelectedCampuses}
        />
        <div className="filter-field">
          <label className="filter-label">Year</label>
          <select
            className="filter-select"
            value={selectedYear ?? ""}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {selectedSchools.length === 0 && (
        <p className="no-data-message">Search for schools above to start comparing.</p>
      )}
    </div>
  );
}
