import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type {
  School,
  SchoolIndex,
  CampusData,
  CampusSlug,
  AdmissionRecord,
} from "../types/index.ts";
import { getSchoolIndex, getCampusData } from "../services/dataService.ts";
import CampusMultiSelect from "../components/filters/CampusMultiSelect.tsx";
import MissingDataIndicator from "../components/common/MissingDataIndicator.tsx";

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

type SortKey =
  | "name"
  | "type"
  | "county"
  | "seniors"
  | "applicants"
  | "applicationRate"
  | "admits"
  | "acceptanceRate"
  | "gpa";

type SortDirection = "asc" | "desc";

function nullSafeNumber(value: number | null, direction: SortDirection): number {
  if (value === null) return direction === "asc" ? Infinity : -Infinity;
  return value;
}

function formatPercent(value: number | null): string {
  if (value === null) return "";
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value: number | null): string {
  if (value === null) return "";
  return value.toLocaleString();
}

function formatGpa(value: number | null): string {
  if (value === null) return "";
  return value.toFixed(2);
}

function renderValue(formatted: string, isNull: boolean): React.ReactNode {
  if (isNull) return <MissingDataIndicator type="suppressed" />;
  return formatted;
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

  // Summary stats computed from full (unfiltered) dataset
  const summaryStats = useMemo(() => {
    let totalApplicants = 0;
    let totalAdmits = 0;
    let gpaWeightedSum = 0;
    let gpaWeightTotal = 0;

    for (const row of aggregatedRows) {
      if (row.applicants !== null) {
        totalApplicants += row.applicants;
        if (row.gpaApplicants !== null) {
          gpaWeightedSum += row.gpaApplicants * row.applicants;
          gpaWeightTotal += row.applicants;
        }
      }
      if (row.admits !== null) totalAdmits += row.admits;
    }

    return {
      totalApplicants,
      totalAdmits,
      avgAcceptRate: totalApplicants > 0 ? totalAdmits / totalApplicants : null,
      avgGpa: gpaWeightTotal > 0 ? gpaWeightedSum / gpaWeightTotal : null,
    };
  }, [aggregatedRows]);

  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState<SortKey>("acceptanceRate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDirection("asc");
      }
    },
    [sortKey],
  );

  // Sort all rows and assign rank numbers
  const rankedRows = useMemo(() => {
    const sorted = [...aggregatedRows];
    const dir = sortDirection === "asc" ? 1 : -1;

    sorted.sort((a, b) => {
      switch (sortKey) {
        case "name":
          return dir * a.school.name.localeCompare(b.school.name);
        case "type":
          return dir * a.school.type.localeCompare(b.school.type);
        case "county":
          return dir * a.school.county.localeCompare(b.school.county);
        case "seniors":
          return dir * (nullSafeNumber(a.seniors, sortDirection) - nullSafeNumber(b.seniors, sortDirection));
        case "applicants":
          return dir * (nullSafeNumber(a.applicants, sortDirection) - nullSafeNumber(b.applicants, sortDirection));
        case "applicationRate":
          return dir * (nullSafeNumber(a.applicationRate, sortDirection) - nullSafeNumber(b.applicationRate, sortDirection));
        case "admits":
          return dir * (nullSafeNumber(a.admits, sortDirection) - nullSafeNumber(b.admits, sortDirection));
        case "acceptanceRate":
          return dir * (nullSafeNumber(a.acceptanceRate, sortDirection) - nullSafeNumber(b.acceptanceRate, sortDirection));
        case "gpa":
          return dir * (nullSafeNumber(a.gpaApplicants, sortDirection) - nullSafeNumber(b.gpaApplicants, sortDirection));
        default:
          return 0;
      }
    });

    return sorted.map((row, index) => ({ ...row, rank: index + 1 }));
  }, [aggregatedRows, sortKey, sortDirection]);

  // Filter ranked rows by search — rank numbers are preserved from the full sorted list
  const displayRows = useMemo(() => {
    if (!debouncedQuery.trim()) return rankedRows;
    const q = debouncedQuery.trim().toLowerCase();
    return rankedRows.filter((row) => row.school.name.toLowerCase().includes(q));
  }, [rankedRows, debouncedQuery]);

  const renderSortHeader = (key: SortKey, label: string, align?: "right") => {
    const isSorted = sortKey === key;
    const arrow = isSorted
      ? sortDirection === "asc" ? "\u25B2" : "\u25BC"
      : "\u25B4";
    return (
      <th
        className={isSorted ? "sorted" : ""}
        onClick={() => handleSort(key)}
        style={align === "right" ? { textAlign: "right" } : undefined}
        aria-sort={isSorted ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
      >
        {label}
        <span className="sort-indicator" aria-hidden="true">{arrow}</span>
      </th>
    );
  };

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
    <div className="by-college-page">
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
            ? `Showing ${displayRows.length} of ${rankedRows.length} schools`
            : `${rankedRows.length} schools`}
        </span>
      </div>

      {/* Summary Stats */}
      <div className="headline-stats" style={{ marginTop: "var(--space-6)", justifyContent: "flex-start" }}>
        <div className="stat-card">
          <span className="stat-label">Total Applicants</span>
          <span className="stat-value">{summaryStats.totalApplicants.toLocaleString()}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Admits</span>
          <span className="stat-value">{summaryStats.totalAdmits.toLocaleString()}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Avg Accept Rate</span>
          <span className="stat-value">
            {summaryStats.avgAcceptRate !== null
              ? `${(summaryStats.avgAcceptRate * 100).toFixed(1)}%`
              : "—"}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Avg Applicant GPA</span>
          <span className="stat-value">
            {summaryStats.avgGpa !== null ? summaryStats.avgGpa.toFixed(2) : "—"}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="data-table-wrapper" style={{ marginTop: "var(--space-6)" }}>
        <table className="data-table" role="grid">
          <caption className="sr-only">
            High school admissions data ranked by {sortKey}
          </caption>
          <thead>
            <tr>
              <th style={{ textAlign: "center", cursor: "default" }}>#</th>
              {renderSortHeader("name", "School Name")}
              {renderSortHeader("type", "Type")}
              {renderSortHeader("county", "County")}
              {renderSortHeader("seniors", "Seniors", "right")}
              {renderSortHeader("applicants", "Applicants", "right")}
              {renderSortHeader("applicationRate", "App Rate", "right")}
              {renderSortHeader("admits", "Admits", "right")}
              {renderSortHeader("acceptanceRate", "Accept Rate", "right")}
              {renderSortHeader("gpa", "Mean GPA", "right")}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row) => (
              <tr
                key={row.school.id}
                className="clickable"
                onClick={() => navigate(`/school/${row.school.id}`)}
                role="row"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(`/school/${row.school.id}`);
                  }
                }}
              >
                <td style={{ textAlign: "center", color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)" }}>
                  {row.rank}
                </td>
                <td>{row.school.name}</td>
                <td>
                  <span className={`badge badge-${row.school.type}`}>
                    {row.school.type === "public" ? "Public" : "Private"}
                  </span>
                </td>
                <td>{row.school.county}</td>
                <td className={`numeric${row.seniors === null ? " null-value" : ""}`}>
                  {renderValue(formatNumber(row.seniors), row.seniors === null)}
                </td>
                <td className={`numeric${row.applicants === null ? " null-value" : ""}`}>
                  {renderValue(formatNumber(row.applicants), row.applicants === null)}
                </td>
                <td className={`numeric${row.applicationRate === null ? " null-value" : ""}`}>
                  {renderValue(formatPercent(row.applicationRate), row.applicationRate === null)}
                </td>
                <td className={`numeric${row.admits === null ? " null-value" : ""}`}>
                  {renderValue(formatNumber(row.admits), row.admits === null)}
                </td>
                <td className={`numeric${row.acceptanceRate === null ? " null-value" : ""}`}>
                  {renderValue(formatPercent(row.acceptanceRate), row.acceptanceRate === null)}
                </td>
                <td className={`numeric${row.gpaApplicants === null ? " null-value" : ""}`}>
                  {renderValue(formatGpa(row.gpaApplicants), row.gpaApplicants === null)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="data-table-footer-note">
          &mdash; indicates suppressed data. Schools with very few applicants may have data withheld for privacy.
        </p>
      </div>
    </div>
  );
}
