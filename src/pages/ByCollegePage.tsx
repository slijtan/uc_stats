import { useState, useEffect, useMemo } from "react";
import type {
  School,
  SchoolIndex,
  CampusData,
  CampusSlug,
  AdmissionRecord,
} from "../types/index.ts";
import { getSchoolIndex, getCampusData } from "../services/dataService.ts";
import CampusMultiSelect from "../components/filters/CampusMultiSelect.tsx";

/** Individual campus slugs (no systemwide) */
const CAMPUS_SLUGS: CampusSlug[] = [
  "berkeley",
  "davis",
  "irvine",
  "la",
  "merced",
  "riverside",
  "san-diego",
  "santa-barbara",
  "santa-cruz",
];

/** Aggregated row for one school across selected campuses */
interface AggregatedSchoolRow {
  school: School;
  applicants: number | null;
  admits: number | null;
  acceptanceRate: number | null;
  gpaApplicants: number | null;
  seniors: number | null;
  applicationRate: number | null;
}

export default function ByCollegePage() {
  const [schoolIndex, setSchoolIndex] = useState<SchoolIndex | null>(null);
  const [campusDataMap, setCampusDataMap] = useState<Map<CampusSlug, CampusData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCampuses, setSelectedCampuses] = useState<CampusSlug[]>([...CAMPUS_SLUGS]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

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

        // Default to latest year
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

  // Derive available years from loaded campus data
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    for (const cd of campusDataMap.values()) {
      for (let y = cd.yearRange.min; y <= cd.yearRange.max; y++) {
        years.add(y);
      }
    }
    return [...years].sort((a, b) => b - a);
  }, [campusDataMap]);

  // Build aggregated rows: one per school, summing across selected campuses for selectedYear
  const aggregatedRows = useMemo((): AggregatedSchoolRow[] => {
    if (!schoolIndex || selectedYear === null) return [];

    const schoolMap = new Map<string, School>();
    for (const s of schoolIndex.schools) {
      schoolMap.set(s.id, s);
    }

    // Collect records per school across selected campuses for the year
    const perSchool = new Map<string, AdmissionRecord[]>();
    for (const slug of selectedCampuses) {
      const cd = campusDataMap.get(slug);
      if (!cd) continue;
      for (const rec of cd.records) {
        if (rec.year !== selectedYear) continue;
        const existing = perSchool.get(rec.schoolId);
        if (existing) {
          existing.push(rec);
        } else {
          perSchool.set(rec.schoolId, [rec]);
        }
      }
    }

    // Aggregate
    const rows: AggregatedSchoolRow[] = [];
    for (const [schoolId, records] of perSchool) {
      const school = schoolMap.get(schoolId);
      if (!school) continue;

      let totalApplicants: number | null = null;
      let totalAdmits: number | null = null;
      let gpaWeightedSum = 0;
      let gpaWeightTotal = 0;

      for (const rec of records) {
        if (rec.applicants !== null) {
          totalApplicants = (totalApplicants ?? 0) + rec.applicants;
          if (rec.gpaApplicants !== null) {
            gpaWeightedSum += rec.gpaApplicants * rec.applicants;
            gpaWeightTotal += rec.applicants;
          }
        }
        if (rec.admits !== null) {
          totalAdmits = (totalAdmits ?? 0) + rec.admits;
        }
      }

      const acceptanceRate =
        totalAdmits !== null && totalApplicants !== null && totalApplicants > 0
          ? totalAdmits / totalApplicants
          : null;

      const gpaApplicants = gpaWeightTotal > 0 ? gpaWeightedSum / gpaWeightTotal : null;

      const seniors = school.grade12Enrollment?.[String(selectedYear)] ?? null;
      const applicationRate =
        totalApplicants !== null && seniors !== null && seniors > 0
          ? totalApplicants / seniors
          : null;

      rows.push({
        school,
        applicants: totalApplicants,
        admits: totalAdmits,
        acceptanceRate,
        gpaApplicants,
        seniors,
        applicationRate,
      });
    }

    return rows;
  }, [schoolIndex, campusDataMap, selectedCampuses, selectedYear]);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 150);
    return () => clearTimeout(timer);
  }, [searchQuery]);

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
    <div>
      <h1 className="page-title">Admissions by College</h1>
      <p className="page-description">
        View high school admission stats for selected UC campuses
      </p>

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

      {/* Search */}
      <div style={{ display: "flex", gap: "var(--space-4)", alignItems: "center", marginTop: "var(--space-6)", flexWrap: "wrap" }}>
        <div className="school-search" style={{ maxWidth: 360 }}>
          <input
            type="text"
            className="school-search-input"
            placeholder="Search schools..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search schools by name"
          />
        </div>
        <span style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)" }}>
          {debouncedQuery.trim()
            ? `Showing ${aggregatedRows.filter((r) => r.school.name.toLowerCase().includes(debouncedQuery.trim().toLowerCase())).length} of ${aggregatedRows.length} schools`
            : `${aggregatedRows.length} schools`}
        </span>
      </div>
    </div>
  );
}
