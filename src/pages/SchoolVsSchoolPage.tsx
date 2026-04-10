import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type {
  School,
  SchoolIndex,
  CampusData,
  CampusSlug,
  AdmissionRecord,
} from "../types/index.ts";
import { getSchoolIndex, getCampusData } from "../services/dataService.ts";
import {
  computeAcceptanceRate,
  filterRecords,
} from "../services/computeService.ts";
import { useFilters } from "../hooks/useFilters.ts";
import SchoolSearch from "../components/search/SchoolSearch.tsx";
import CampusFilter from "../components/filters/CampusFilter.tsx";
import YearFilter from "../components/filters/YearFilter.tsx";
import AcceptanceRateBar from "../components/charts/AcceptanceRateBar.tsx";
import type { BarDataPoint } from "../components/charts/AcceptanceRateBar.tsx";
import TrendLine from "../components/charts/TrendLine.tsx";
import type {
  TrendDataPoint,
  TrendLineSeries,
} from "../components/charts/TrendLine.tsx";

/** Individual campus slugs (excluding systemwide) */
const INDIVIDUAL_CAMPUSES: CampusSlug[] = [
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

const ALL_CAMPUSES: CampusSlug[] = [
  "systemwide",
  ...INDIVIDUAL_CAMPUSES,
];

/** Map campus slugs to display names */
const CAMPUS_NAMES: Record<CampusSlug, string> = {
  systemwide: "All Campuses (Systemwide)",
  berkeley: "UC Berkeley",
  davis: "UC Davis",
  irvine: "UC Irvine",
  la: "UCLA",
  merced: "UC Merced",
  riverside: "UC Riverside",
  "san-diego": "UC San Diego",
  "santa-barbara": "UC Santa Barbara",
  "santa-cruz": "UC Santa Cruz",
};

function formatPercent(value: number | null): string {
  if (value === null) return "\u2014";
  return `${(value * 100).toFixed(1)}%`;
}

export default function SchoolVsSchoolPage() {
  const { schoolId1, schoolId2 } = useParams<{
    schoolId1: string;
    schoolId2: string;
  }>();
  const navigate = useNavigate();

  const [schoolIndex, setSchoolIndex] = useState<SchoolIndex | null>(null);
  const [campusDataMap, setCampusDataMap] = useState<
    Map<CampusSlug, CampusData>
  >(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { filters, setFilter } = useFilters();

  // Find schools from index
  const school1 = useMemo((): School | null => {
    if (!schoolIndex || !schoolId1) return null;
    return schoolIndex.schools.find((s) => s.id === schoolId1) ?? null;
  }, [schoolIndex, schoolId1]);

  const school2 = useMemo((): School | null => {
    if (!schoolIndex || !schoolId2) return null;
    return schoolIndex.schools.find((s) => s.id === schoolId2) ?? null;
  }, [schoolIndex, schoolId2]);

  // Load school index
  useEffect(() => {
    let cancelled = false;

    async function loadIndex() {
      try {
        const index = await getSchoolIndex();
        if (!cancelled) {
          setSchoolIndex(index);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load school index"
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

  // Load all campus data once both schools are identified
  useEffect(() => {
    if (!school1 || !school2) {
      if (schoolIndex) {
        setLoading(false);
      }
      return;
    }

    let cancelled = false;

    async function loadCampusData() {
      try {
        const results = await Promise.all(
          ALL_CAMPUSES.map(async (slug) => {
            const data = await getCampusData(slug);
            return [slug, data] as [CampusSlug, CampusData];
          })
        );

        if (!cancelled) {
          const map = new Map<CampusSlug, CampusData>();
          for (const [slug, data] of results) {
            map.set(slug, data);
          }
          setCampusDataMap(map);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load campus data"
          );
          setLoading(false);
        }
      }
    }

    void loadCampusData();
    return () => {
      cancelled = true;
    };
  }, [school1, school2, schoolIndex]);

  // Available years (union of both schools)
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    if (school1) school1.yearsAvailable.forEach((y) => years.add(y));
    if (school2) school2.yearsAvailable.forEach((y) => years.add(y));
    const yearArr = Array.from(years);
    if (yearArr.length === 0) return { min: 2015, max: 2025 };
    return { min: Math.min(...yearArr), max: Math.max(...yearArr) };
  }, [school1, school2]);

  // Selected year
  const selectedYear = useMemo(() => {
    if (filters.year !== null) return filters.year;
    return availableYears.max;
  }, [filters.year, availableYears]);

  // Helper: get a school's record for a given campus and year
  function getSchoolRecord(
    schoolId: string,
    campus: CampusSlug,
    year: number
  ): AdmissionRecord | null {
    const campusData = campusDataMap.get(campus);
    if (!campusData) return null;
    const records = filterRecords(campusData.records, {
      year,
      schoolIds: [schoolId],
    });
    return records[0] ?? null;
  }

  // Bar chart data: acceptance rate at each campus for both schools (selected year)
  const comparisonBarData = useMemo((): BarDataPoint[] => {
    if (!school1 || !school2 || selectedYear === null) return [];

    const data: BarDataPoint[] = [];

    for (const slug of INDIVIDUAL_CAMPUSES) {
      const record1 = getSchoolRecord(school1.id, slug, selectedYear);
      const record2 = getSchoolRecord(school2.id, slug, selectedYear);

      const rate1 = record1 ? computeAcceptanceRate(record1) : null;
      const rate2 = record2 ? computeAcceptanceRate(record2) : null;

      if (rate1 !== null) {
        data.push({
          name: `${CAMPUS_NAMES[slug]} (${school1.name.length > 20 ? school1.name.substring(0, 20) + "..." : school1.name})`,
          acceptanceRate: rate1,
          type: school1.type,
          applicants: record1?.applicants ?? null,
          admits: record1?.admits ?? null,
        });
      }

      if (rate2 !== null) {
        data.push({
          name: `${CAMPUS_NAMES[slug]} (${school2.name.length > 20 ? school2.name.substring(0, 20) + "..." : school2.name})`,
          acceptanceRate: rate2,
          type: school2.type,
          applicants: record2?.applicants ?? null,
          admits: record2?.admits ?? null,
        });
      }
    }

    return data;
  }, [school1, school2, selectedYear, campusDataMap]);

  // Trend line data for both schools at the selected campus
  const trendData = useMemo((): TrendDataPoint[] => {
    if (!school1 || !school2) return [];

    const campusData = campusDataMap.get(filters.campus);
    if (!campusData) return [];

    // Get all years present for either school
    const yearsSet = new Set<number>();
    const records1 = filterRecords(campusData.records, {
      schoolIds: [school1.id],
    });
    const records2 = filterRecords(campusData.records, {
      schoolIds: [school2.id],
    });

    for (const r of records1) yearsSet.add(r.year);
    for (const r of records2) yearsSet.add(r.year);

    const years = Array.from(yearsSet).sort((a, b) => a - b);

    const record1Map = new Map(records1.map((r) => [r.year, r]));
    const record2Map = new Map(records2.map((r) => [r.year, r]));

    return years.map((year) => {
      const r1 = record1Map.get(year);
      const r2 = record2Map.get(year);
      return {
        year,
        school1Rate: r1 ? computeAcceptanceRate(r1) : null,
        school2Rate: r2 ? computeAcceptanceRate(r2) : null,
      };
    });
  }, [school1, school2, filters.campus, campusDataMap]);

  const trendSeries: TrendLineSeries[] = useMemo(() => {
    if (!school1 || !school2) return [];
    return [
      {
        dataKey: "school1Rate",
        label: school1.name,
        color:
          school1.type === "private"
            ? "var(--color-private, #ea580c)"
            : "var(--color-public, #2563eb)",
      },
      {
        dataKey: "school2Rate",
        label: school2.name,
        color:
          school2.type === "private"
            ? "var(--color-private-light, #fb923c)"
            : "var(--color-public-light, #60a5fa)",
      },
    ];
  }, [school1, school2]);

  // Comparison table data: rows for each campus
  const comparisonTableRows = useMemo(() => {
    if (!school1 || !school2 || selectedYear === null) return [];

    return INDIVIDUAL_CAMPUSES.map((slug) => {
      const record1 = getSchoolRecord(school1.id, slug, selectedYear);
      const record2 = getSchoolRecord(school2.id, slug, selectedYear);
      const rate1 = record1 ? computeAcceptanceRate(record1) : null;
      const rate2 = record2 ? computeAcceptanceRate(record2) : null;

      return {
        campus: CAMPUS_NAMES[slug],
        school1Rate: rate1,
        school2Rate: rate2,
        school1Applicants: record1?.applicants ?? null,
        school2Applicants: record2?.applicants ?? null,
        school1Admits: record1?.admits ?? null,
        school2Admits: record2?.admits ?? null,
      };
    });
  }, [school1, school2, selectedYear, campusDataMap]);

  // Navigation helpers for school selection
  const handleSelectSchool1 = (school: School) => {
    if (schoolId2) {
      navigate(`/compare/${school.id}/${schoolId2}`);
    }
  };

  const handleSelectSchool2 = (school: School) => {
    if (schoolId1) {
      navigate(`/compare/${schoolId1}/${school.id}`);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="page-loading" role="status" aria-live="polite">
        <p>Loading...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="page-error">
        <h2>Error Loading Data</h2>
        <p>{error}</p>
      </div>
    );
  }

  // Handle case where one or both schools not found
  if (!school1 || !school2) {
    return (
      <div className="page-error">
        <h2>School Not Found</h2>
        <p>
          {!school1 && `School with ID "${schoolId1}" was not found. `}
          {!school2 && `School with ID "${schoolId2}" was not found. `}
        </p>
        <p>Try searching for different schools to compare.</p>
        <div style={{ marginTop: "1.5rem", maxWidth: "480px" }}>
          <SchoolSearch placeholder="Search for a high school..." />
        </div>
      </div>
    );
  }

  return (
    <div className="school-vs-school-page">
      <section className="section">
        <h1 className="page-title">School vs. School Comparison</h1>
      </section>

      {/* School Selection Headers */}
      <section className="section">
        <div className="vs-header-grid">
          <div className="vs-school-card">
            <div className="vs-school-info">
              <h2 className="vs-school-name">{school1.name}</h2>
              <span className={`badge badge-${school1.type}`}>
                {school1.type === "public" ? "Public" : "Private"}
              </span>
              <p className="vs-school-location">
                {school1.city ? `${school1.city}, ` : ""}
                {school1.county} County
              </p>
            </div>
            <div className="vs-school-search">
              <p className="vs-search-label">Change school:</p>
              <SchoolSearch
                placeholder="Search..."
                onSelect={handleSelectSchool1}
                navigateOnSelect={false}
              />
            </div>
          </div>

          <div className="vs-divider">
            <span className="vs-divider-text">vs.</span>
          </div>

          <div className="vs-school-card">
            <div className="vs-school-info">
              <h2 className="vs-school-name">{school2.name}</h2>
              <span className={`badge badge-${school2.type}`}>
                {school2.type === "public" ? "Public" : "Private"}
              </span>
              <p className="vs-school-location">
                {school2.city ? `${school2.city}, ` : ""}
                {school2.county} County
              </p>
            </div>
            <div className="vs-school-search">
              <p className="vs-search-label">Change school:</p>
              <SchoolSearch
                placeholder="Search..."
                onSelect={handleSelectSchool2}
                navigateOnSelect={false}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="section" aria-label="Filters">
        <div className="filter-group" role="group" aria-label="Data filters">
          <CampusFilter
            value={filters.campus}
            onChange={(val) => setFilter("campus", val)}
          />
          <YearFilter
            value={filters.year}
            onChange={(val) => setFilter("year", val)}
            minYear={availableYears.min}
            maxYear={availableYears.max}
          />
        </div>
      </section>

      {/* Comparison Bar Chart */}
      <section className="section" aria-label="Acceptance rate comparison">
        <h2 className="section-title">
          Acceptance Rate by Campus ({selectedYear})
        </h2>
        {comparisonBarData.length > 0 ? (
          <AcceptanceRateBar
            data={comparisonBarData}
            height={Math.max(400, comparisonBarData.length * 28)}
            layout="vertical"
          />
        ) : (
          <p className="no-data-message">
            No comparable data available for {selectedYear}.
          </p>
        )}
      </section>

      {/* Trend Lines */}
      <section className="section" aria-label="Acceptance rate trends">
        <h2 className="section-title">
          Acceptance Rate Over Time —{" "}
          {CAMPUS_NAMES[filters.campus] ?? filters.campus}
        </h2>
        {trendData.length > 0 ? (
          <TrendLine
            data={trendData}
            series={trendSeries}
            yAxisFormat="percent"
            height={350}
          />
        ) : (
          <p className="no-data-message">
            No trend data available for{" "}
            {CAMPUS_NAMES[filters.campus] ?? filters.campus}.
          </p>
        )}
      </section>

      {/* Quality Metrics Comparison */}
      {(school1.quality || school2.quality) && (
        <section className="section" aria-label="Quality metrics comparison">
          <h2 className="section-title">School Quality Comparison</h2>
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th style={{ textAlign: "right" }}>{school1.name}</th>
                  <th style={{ textAlign: "right" }}>{school2.name}</th>
                </tr>
              </thead>
              <tbody>
                {([
                  { label: "CCI % Prepared", v1: school1.quality?.cci, v2: school2.quality?.cci },
                  { label: "Graduation Rate", v1: school1.quality?.gradRate, v2: school2.quality?.gradRate },
                  { label: "A-G Completion", v1: school1.quality?.agRate, v2: school2.quality?.agRate },
                  { label: "College-Going Rate", v1: school1.quality?.collegeGoingRate, v2: school2.quality?.collegeGoingRate },
                  { label: "CAASPP ELA % Met", v1: school1.quality?.caasppElaPctMet, v2: school2.quality?.caasppElaPctMet },
                  { label: "CAASPP Math % Met", v1: school1.quality?.caasppMathPctMet, v2: school2.quality?.caasppMathPctMet },
                  { label: "FRPM %", v1: school1.quality?.freeReducedMealPct, v2: school2.quality?.freeReducedMealPct },
                  { label: "AP Courses", v1: school1.quality?.apCoursesOffered, v2: school2.quality?.apCoursesOffered, isCount: true },
                  { label: "Chronic Absenteeism", v1: school1.quality?.chronicAbsentRate, v2: school2.quality?.chronicAbsentRate },
                  { label: "Suspension Rate", v1: school1.quality?.suspensionRate, v2: school2.quality?.suspensionRate },
                ] as { label: string; v1?: number; v2?: number; isCount?: boolean }[])
                  .filter((row) => row.v1 != null || row.v2 != null)
                  .map((row) => (
                    <tr key={row.label}>
                      <td style={{ fontWeight: 500 }}>{row.label}</td>
                      <td className={`numeric${row.v1 == null ? " null-value" : ""}`}>
                        {row.v1 != null ? (row.isCount ? String(row.v1) : `${row.v1.toFixed(1)}%`) : "\u2014"}
                      </td>
                      <td className={`numeric${row.v2 == null ? " null-value" : ""}`}>
                        {row.v2 != null ? (row.isCount ? String(row.v2) : `${row.v2.toFixed(1)}%`) : "\u2014"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Comparison Table */}
      <section className="section" aria-label="Campus-by-campus comparison">
        <h2 className="section-title">
          Campus-by-Campus Comparison ({selectedYear})
        </h2>
        {comparisonTableRows.length > 0 ? (
          <div className="data-table-wrapper">
            <table className="data-table">
              <caption className="sr-only">
                Campus-by-campus comparison of {school1.name} and {school2.name}
              </caption>
              <thead>
                <tr>
                  <th>Campus</th>
                  <th>{school1.name} Rate</th>
                  <th>{school1.name} Apps</th>
                  <th>{school2.name} Rate</th>
                  <th>{school2.name} Apps</th>
                </tr>
              </thead>
              <tbody>
                {comparisonTableRows.map((row) => (
                  <tr key={row.campus}>
                    <td>{row.campus}</td>
                    <td
                      className={`numeric${row.school1Rate === null ? " null-value" : ""}`}
                    >
                      {formatPercent(row.school1Rate)}
                    </td>
                    <td
                      className={`numeric${row.school1Applicants === null ? " null-value" : ""}`}
                    >
                      {row.school1Applicants?.toLocaleString() ?? "\u2014"}
                    </td>
                    <td
                      className={`numeric${row.school2Rate === null ? " null-value" : ""}`}
                    >
                      {formatPercent(row.school2Rate)}
                    </td>
                    <td
                      className={`numeric${row.school2Applicants === null ? " null-value" : ""}`}
                    >
                      {row.school2Applicants?.toLocaleString() ?? "\u2014"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="no-data-message">No data available for comparison.</p>
        )}
      </section>
    </div>
  );
}
