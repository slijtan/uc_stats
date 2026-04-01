import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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

/** Searchable county dropdown */
function CountySearchFilter({
  value,
  onChange,
  counties,
}: {
  value: string | null;
  onChange: (county: string | null) => void;
  counties: string[];
}) {
  const [query, setQuery] = useState(value ?? "");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const sorted = useMemo(
    () => [...counties].sort((a, b) => a.localeCompare(b)),
    [counties],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return sorted;
    const q = query.trim().toLowerCase();
    return sorted.filter((c) => c.toLowerCase().includes(q));
  }, [sorted, query]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Sync external value changes
  useEffect(() => {
    setQuery(value ?? "");
  }, [value]);

  return (
    <div className="filter-field" ref={wrapperRef} style={{ position: "relative" }}>
      <input
        type="text"
        className="filter-select"
        placeholder="All Counties"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (!e.target.value.trim()) onChange(null);
        }}
        onFocus={() => setOpen(true)}
        aria-label="Filter by county"
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            maxHeight: 240,
            overflowY: "auto",
            background: "var(--color-bg-secondary, #fff)",
            border: "1px solid var(--color-border, #d1d5db)",
            borderRadius: 6,
            margin: 0,
            padding: 0,
            listStyle: "none",
            zIndex: 50,
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          }}
        >
          {value && (
            <li
              style={{
                padding: "6px 12px",
                cursor: "pointer",
                fontSize: "var(--font-size-sm)",
                color: "var(--color-text-muted)",
                fontStyle: "italic",
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(null);
                setQuery("");
                setOpen(false);
              }}
            >
              Clear filter
            </li>
          )}
          {filtered.map((county) => (
            <li
              key={county}
              style={{
                padding: "6px 12px",
                cursor: "pointer",
                fontSize: "var(--font-size-sm)",
                background: county === value ? "var(--color-bg-accent, #eff6ff)" : undefined,
                fontWeight: county === value ? 600 : undefined,
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(county);
                setQuery(county);
                setOpen(false);
              }}
            >
              {county}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

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
  enrollees: number | null;
  seniors: number | null;
  // Rates
  applicationRate: number | null;       // applicants / seniors
  acceptanceRate: number | null;        // admits / applicants (conversion)
  acceptanceRateOfClass: number | null; // admits / seniors
  yield: number | null;                 // enrollees / admits (conversion)
  enrollmentRateOfClass: number | null; // enrollees / seniors
  gpaApplicants: number | null;
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
  | "acceptanceRateOfClass"
  | "enrollees"
  | "yield"
  | "enrollmentRateOfClass"
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

    // Collect records per school, tagged with campus slug
    type TaggedRecord = AdmissionRecord & { _campus: CampusSlug };
    const perSchool = new Map<string, TaggedRecord[]>();
    for (const slug of selectedCampuses) {
      const cd = campusDataMap.get(slug);
      if (!cd) continue;
      for (const rec of cd.records) {
        if (rec.year !== selectedYear) continue;
        const tagged = { ...rec, _campus: slug } as TaggedRecord;
        const existing = perSchool.get(rec.schoolId);
        if (existing) {
          existing.push(tagged);
        } else {
          perSchool.set(rec.schoolId, [tagged]);
        }
      }
    }

    // Aggregate — compute per-campus rates and average them
    const rows: AggregatedSchoolRow[] = [];
    for (const [schoolId, records] of perSchool) {
      const school = schoolMap.get(schoolId);
      if (!school) continue;

      let totalApplicants: number | null = null;
      let totalAdmits: number | null = null;
      let totalEnrollees: number | null = null;
      let gpaWeightedSum = 0;
      let gpaWeightTotal = 0;

      // Group by campus for per-campus rate averaging
      const byCampus = new Map<CampusSlug, { app: number; adm: number; enr: number }>();
      for (const rec of records) {
        let c = byCampus.get(rec._campus);
        if (!c) { c = { app: 0, adm: 0, enr: 0 }; byCampus.set(rec._campus, c); }

        if (rec.applicants !== null) {
          totalApplicants = (totalApplicants ?? 0) + rec.applicants;
          c.app += rec.applicants;
          if (rec.gpaApplicants !== null) {
            gpaWeightedSum += rec.gpaApplicants * rec.applicants;
            gpaWeightTotal += rec.applicants;
          }
        }
        if (rec.admits !== null) {
          totalAdmits = (totalAdmits ?? 0) + rec.admits;
          c.adm += rec.admits;
        }
        if (rec.enrollees !== null) {
          totalEnrollees = (totalEnrollees ?? 0) + rec.enrollees;
          c.enr += rec.enrollees;
        }
      }

      // Average per-campus acceptance and yield rates
      const campusAcceptRates: number[] = [];
      const campusYieldRates: number[] = [];
      for (const c of byCampus.values()) {
        if (c.app > 0) campusAcceptRates.push(c.adm / c.app);
        if (c.adm > 0) campusYieldRates.push(c.enr / c.adm);
      }

      const acceptanceRate = campusAcceptRates.length > 0
        ? campusAcceptRates.reduce((a, b) => a + b, 0) / campusAcceptRates.length
        : null;

      const yieldRate = campusYieldRates.length > 0
        ? campusYieldRates.reduce((a, b) => a + b, 0) / campusYieldRates.length
        : null;

      const gpaApplicants = gpaWeightTotal > 0 ? gpaWeightedSum / gpaWeightTotal : null;

      const seniors = school.grade12Enrollment?.[String(selectedYear)] ?? null;
      // For "of class" rates, average across campuses
      const campusCount = byCampus.size || 1;
      const applicationRate =
        totalApplicants !== null && seniors !== null && seniors > 0
          ? (totalApplicants / campusCount) / seniors
          : null;
      const acceptanceRateOfClass =
        totalAdmits !== null && seniors !== null && seniors > 0
          ? (totalAdmits / campusCount) / seniors
          : null;
      const enrollmentRateOfClass =
        totalEnrollees !== null && seniors !== null && seniors > 0
          ? (totalEnrollees / campusCount) / seniors
          : null;

      rows.push({
        school,
        applicants: totalApplicants,
        admits: totalAdmits,
        enrollees: totalEnrollees,
        seniors,
        applicationRate,
        acceptanceRate,
        acceptanceRateOfClass,
        yield: yieldRate,
        enrollmentRateOfClass,
        gpaApplicants,
      });
    }

    return rows;
  }, [schoolIndex, campusDataMap, selectedCampuses, selectedYear]);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [schoolTypeFilter, setSchoolTypeFilter] = useState<"all" | "public" | "private">("all");
  const [countyFilter, setCountyFilter] = useState<string | null>(null);

  // Available counties from school index
  const availableCounties = useMemo(() => {
    if (!schoolIndex) return [];
    const countySet = new Set(schoolIndex.schools.map((s) => s.county));
    return Array.from(countySet);
  }, [schoolIndex]);

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
  const [sortKey, setSortKey] = useState<SortKey>("acceptanceRateOfClass");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

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

  // Filter by school type and county, then sort and assign rank numbers
  const rankedRows = useMemo(() => {
    let filtered = schoolTypeFilter === "all"
      ? aggregatedRows
      : aggregatedRows.filter((row) => row.school.type === schoolTypeFilter);
    if (countyFilter) {
      filtered = filtered.filter((row) => row.school.county === countyFilter);
    }
    const sorted = [...filtered];
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
        case "acceptanceRateOfClass":
          return dir * (nullSafeNumber(a.acceptanceRateOfClass, sortDirection) - nullSafeNumber(b.acceptanceRateOfClass, sortDirection));
        case "enrollees":
          return dir * (nullSafeNumber(a.enrollees, sortDirection) - nullSafeNumber(b.enrollees, sortDirection));
        case "yield":
          return dir * (nullSafeNumber(a.yield, sortDirection) - nullSafeNumber(b.yield, sortDirection));
        case "enrollmentRateOfClass":
          return dir * (nullSafeNumber(a.enrollmentRateOfClass, sortDirection) - nullSafeNumber(b.enrollmentRateOfClass, sortDirection));
        case "gpa":
          return dir * (nullSafeNumber(a.gpaApplicants, sortDirection) - nullSafeNumber(b.gpaApplicants, sortDirection));
        default:
          return 0;
      }
    });

    return sorted.map((row, index) => ({ ...row, rank: index + 1 }));
  }, [aggregatedRows, sortKey, sortDirection, schoolTypeFilter, countyFilter]);

  // Filter ranked rows by search — rank numbers reflect the type-filtered set
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

      {/* Search & Type Filter */}
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
        <div className="filter-field">
          <select
            className="filter-select"
            value={schoolTypeFilter}
            onChange={(e) => setSchoolTypeFilter(e.target.value as "all" | "public" | "private")}
            aria-label="Filter by school type"
          >
            <option value="all">All</option>
            <option value="public">Public</option>
            <option value="private">Private</option>
          </select>
        </div>
        <CountySearchFilter
          value={countyFilter}
          onChange={setCountyFilter}
          counties={availableCounties}
        />
        <span style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)" }}>
          {displayRows.length !== rankedRows.length
            ? `Showing ${displayRows.length} of ${rankedRows.length} schools`
            : `${rankedRows.length} schools`}
        </span>
      </div>

      {/* Desktop Table */}
      <div className="data-table-wrapper data-table-full-width bc-desktop-table" style={{ marginTop: "var(--space-6)" }}>
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
              {renderSortHeader("acceptanceRateOfClass", "Accept % of Class", "right")}
              {renderSortHeader("enrollees", "Enrollees", "right")}
              {renderSortHeader("yield", "Enroll Rate", "right")}
              {renderSortHeader("enrollmentRateOfClass", "Enroll % of Class", "right")}
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
                <td className={`numeric${row.acceptanceRateOfClass === null ? " null-value" : ""}`}>
                  {renderValue(formatPercent(row.acceptanceRateOfClass), row.acceptanceRateOfClass === null)}
                </td>
                <td className={`numeric${row.enrollees === null ? " null-value" : ""}`}>
                  {renderValue(formatNumber(row.enrollees), row.enrollees === null)}
                </td>
                <td className={`numeric${row.yield === null ? " null-value" : ""}`}>
                  {renderValue(formatPercent(row.yield), row.yield === null)}
                </td>
                <td className={`numeric${row.enrollmentRateOfClass === null ? " null-value" : ""}`}>
                  {renderValue(formatPercent(row.enrollmentRateOfClass), row.enrollmentRateOfClass === null)}
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

      {/* Mobile Cards */}
      <div className="bc-mobile-cards" style={{ marginTop: "var(--space-6)" }}>
        {displayRows.map((row) => (
          <div
            key={row.school.id}
            className="bc-card"
            onClick={() => navigate(`/school/${row.school.id}`)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                navigate(`/school/${row.school.id}`);
              }
            }}
          >
            <div className="bc-card-header">
              <span className="bc-card-rank">#{row.rank}</span>
              <span className="bc-card-name">{row.school.name}</span>
              <span className={`badge badge-${row.school.type}`}>
                {row.school.type === "public" ? "Pub" : "Priv"}
              </span>
            </div>
            <div className="bc-card-sub">{row.school.county} County</div>
            <div className="bc-card-metrics">
              <div className="bc-card-metric">
                <span className="bc-card-metric-label">App Rate</span>
                <span className="bc-card-metric-value">{row.applicationRate !== null ? formatPercent(row.applicationRate) : "—"}</span>
              </div>
              <div className="bc-card-metric">
                <span className="bc-card-metric-label">Accept Rate</span>
                <span className="bc-card-metric-value">{row.acceptanceRate !== null ? formatPercent(row.acceptanceRate) : "—"}</span>
              </div>
              <div className="bc-card-metric">
                <span className="bc-card-metric-label">Accept % Class</span>
                <span className="bc-card-metric-value">{row.acceptanceRateOfClass !== null ? formatPercent(row.acceptanceRateOfClass) : "—"}</span>
              </div>
              <div className="bc-card-metric">
                <span className="bc-card-metric-label">Enroll Rate</span>
                <span className="bc-card-metric-value">{row.yield !== null ? formatPercent(row.yield) : "—"}</span>
              </div>
              <div className="bc-card-metric">
                <span className="bc-card-metric-label">Enroll % Class</span>
                <span className="bc-card-metric-value">{row.enrollmentRateOfClass !== null ? formatPercent(row.enrollmentRateOfClass) : "—"}</span>
              </div>
              <div className="bc-card-metric">
                <span className="bc-card-metric-label">GPA</span>
                <span className="bc-card-metric-value">{row.gpaApplicants !== null ? formatGpa(row.gpaApplicants) : "—"}</span>
              </div>
            </div>
            <div className="bc-card-counts">
              {row.seniors !== null && <span>{formatNumber(row.seniors)} seniors</span>}
              {row.applicants !== null && <span>{formatNumber(row.applicants)} applicants</span>}
              {row.admits !== null && <span>{formatNumber(row.admits)} admits</span>}
              {row.enrollees !== null && <span>{formatNumber(row.enrollees)} enrolled</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
