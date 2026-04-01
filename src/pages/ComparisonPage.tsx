import { useState, useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type {
  SchoolIndex,
  SummaryData,
  CampusData,
  CampusSlug,
  School,
  AdmissionRecord,
  GroupAggregate,
} from "../types/index.ts";
import {
  getSchoolIndex,
  getSummary,
  getCampusData,
} from "../services/dataService.ts";
import {
  computeAcceptanceRate,
  computeGroupAggregate,
  filterRecords,
} from "../services/computeService.ts";
import { useFilters } from "../hooks/useFilters.ts";
import CampusFilter from "../components/filters/CampusFilter.tsx";
import YearFilter from "../components/filters/YearFilter.tsx";
import CountyFilter from "../components/filters/CountyFilter.tsx";
import ComparisonTable from "../components/tables/ComparisonTable.tsx";
import DistributionPlot from "../components/charts/DistributionPlot.tsx";
import type { DistributionDataPoint } from "../components/charts/DistributionPlot.tsx";
import MethodologyNote from "../components/common/MethodologyNote.tsx";

const DISTRIBUTION_BUCKETS = [
  "0-10%",
  "10-20%",
  "20-30%",
  "30-40%",
  "40-50%",
  "50-60%",
  "60-70%",
  "70-80%",
  "80-90%",
  "90-100%",
];

function getBucketIndex(rate: number): number {
  if (rate >= 1) return 9;
  return Math.min(Math.floor(rate * 10), 9);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export default function ComparisonPage() {
  const [searchParams] = useSearchParams();

  // Read initial campus from URL query param
  const initialCampus = (searchParams.get("campus") as CampusSlug) || "systemwide";

  const [schoolIndex, setSchoolIndex] = useState<SchoolIndex | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [campusData, setCampusData] = useState<CampusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { filters, setFilter } = useFilters({ campus: initialCampus });

  // Load initial data
  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const [index, summaryData] = await Promise.all([
          getSchoolIndex(),
          getSummary(),
        ]);
        if (!cancelled) {
          setSchoolIndex(index);
          setSummary(summaryData);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load data"
          );
          setLoading(false);
        }
      }
    }

    void loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load campus data when campus filter changes
  useEffect(() => {
    let cancelled = false;

    async function loadCampus() {
      try {
        const data = await getCampusData(filters.campus);
        if (!cancelled) {
          setCampusData(data);
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

    void loadCampus();
    return () => {
      cancelled = true;
    };
  }, [filters.campus]);

  // Available years
  const availableYears = useMemo(() => {
    if (!summary) return { min: 2015, max: 2025 };
    const years = summary.summaries.map((s) => s.year);
    return {
      min: years.length > 0 ? Math.min(...years) : 2015,
      max: years.length > 0 ? Math.max(...years) : 2025,
    };
  }, [summary]);

  // Selected year
  const selectedYear = useMemo(() => {
    if (filters.year !== null) return filters.year;
    return summary?.latestYear ?? null;
  }, [filters.year, summary]);

  // Available counties from school index
  const counties = useMemo(() => {
    if (!schoolIndex) return [];
    const countySet = new Set(schoolIndex.schools.map((s) => s.county));
    return Array.from(countySet);
  }, [schoolIndex]);

  // Filter schools by county if a county filter is active
  const filteredSchools = useMemo((): School[] => {
    if (!schoolIndex) return [];
    let schools = schoolIndex.schools;
    if (filters.county) {
      schools = schools.filter((s) => s.county === filters.county);
    }
    return schools;
  }, [schoolIndex, filters.county]);

  // Filter records for the selected year and county-filtered schools
  const filteredRecords = useMemo((): AdmissionRecord[] => {
    if (!campusData || selectedYear === null) return [];

    const schoolIds = filteredSchools.map((s) => s.id);

    return filterRecords(campusData.records, {
      year: selectedYear,
      schoolIds: schoolIds.length > 0 ? schoolIds : undefined,
    });
  }, [campusData, selectedYear, filteredSchools]);

  // Compute group aggregates
  const publicAggregate = useMemo((): GroupAggregate => {
    return computeGroupAggregate(filteredRecords, filteredSchools, "public", selectedYear ?? undefined);
  }, [filteredRecords, filteredSchools, selectedYear]);

  const privateAggregate = useMemo((): GroupAggregate => {
    return computeGroupAggregate(filteredRecords, filteredSchools, "private", selectedYear ?? undefined);
  }, [filteredRecords, filteredSchools, selectedYear]);

  // Build distribution data
  const distributionData = useMemo((): DistributionDataPoint[] => {
    if (!schoolIndex) return [];

    const schoolTypeMap = new Map(
      filteredSchools.map((s) => [s.id, s.type])
    );

    const buckets = DISTRIBUTION_BUCKETS.map((range) => ({
      range,
      publicCount: 0,
      privateCount: 0,
    }));

    for (const record of filteredRecords) {
      const rate = computeAcceptanceRate(record);
      if (rate === null) continue;

      const schoolType = schoolTypeMap.get(record.schoolId);
      if (!schoolType) continue;

      const bucketIdx = getBucketIndex(rate);
      const bucket = buckets[bucketIdx];
      if (!bucket) continue;

      if (schoolType === "public") {
        bucket.publicCount++;
      } else {
        bucket.privateCount++;
      }
    }

    return buckets;
  }, [filteredRecords, filteredSchools, schoolIndex]);

  // Build "of class" distribution data
  const buildOfClassDistribution = (
    getValue: (record: AdmissionRecord) => number | null,
  ): DistributionDataPoint[] => {
    if (!schoolIndex || selectedYear === null) return [];

    const schoolMap = new Map(filteredSchools.map((s) => [s.id, s]));

    const buckets = DISTRIBUTION_BUCKETS.map((range) => ({
      range,
      publicCount: 0,
      privateCount: 0,
    }));

    for (const record of filteredRecords) {
      const value = getValue(record);
      if (value === null) continue;

      const school = schoolMap.get(record.schoolId);
      if (!school) continue;

      const seniors = school.grade12Enrollment?.[String(selectedYear)];
      if (!seniors || seniors <= 0) continue;

      const rate = value / seniors;
      const bucketIdx = getBucketIndex(rate);
      const bucket = buckets[bucketIdx];
      if (!bucket) continue;

      if (school.type === "public") {
        bucket.publicCount++;
      } else {
        bucket.privateCount++;
      }
    }

    return buckets;
  };

  const appRateOfClassDistribution = useMemo(
    () => buildOfClassDistribution((r) => r.applicants),
    [filteredRecords, filteredSchools, schoolIndex, selectedYear],
  );

  const acceptRateOfClassDistribution = useMemo(
    () => buildOfClassDistribution((r) => r.admits),
    [filteredRecords, filteredSchools, schoolIndex, selectedYear],
  );

  const enrollRateOfClassDistribution = useMemo(
    () => buildOfClassDistribution((r) => r.enrollees),
    [filteredRecords, filteredSchools, schoolIndex, selectedYear],
  );

  // Top 10 public and private schools by acceptance rate
  const topPublicSchools = useMemo(() => {
    return getTopSchools(filteredRecords, filteredSchools, "public", 10);
  }, [filteredRecords, filteredSchools]);

  const topPrivateSchools = useMemo(() => {
    return getTopSchools(filteredRecords, filteredSchools, "private", 10);
  }, [filteredRecords, filteredSchools]);

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

  const campusName = campusData?.campusName ?? "Systemwide";

  return (
    <div className="comparison-page">
      <section className="section">
        <h1 className="page-title">Public vs. Private School Comparison</h1>
        <p className="page-description">
          Compare UC acceptance rates, applicant counts, and GPAs between public
          and private high schools.
        </p>
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
          <CountyFilter
            value={filters.county}
            onChange={(val) => setFilter("county", val)}
            counties={counties}
          />
        </div>
      </section>

      {/* Aggregate Comparison */}
      <section className="section" aria-label="Aggregate statistics">
        <h2 className="section-title">
          Aggregate Statistics — {campusName}
          {selectedYear ? ` (${selectedYear})` : ""}
        </h2>
        <ComparisonTable
          publicData={publicAggregate}
          privateData={privateAggregate}
        />
        <MethodologyNote />
      </section>

      {/* Distribution Plot */}
      <section className="section" aria-label="Acceptance rate distribution">
        <h2 className="section-title">
          Acceptance Rate Distribution
          {selectedYear ? ` (${selectedYear})` : ""}
        </h2>
        <p className="section-description">
          How acceptance rates are distributed among public and private schools.
          Each bar represents the number of schools falling within that
          acceptance rate range.
        </p>
        <DistributionPlot data={distributionData} height={400} />
      </section>

      {/* "Of Class" Distribution Plots */}
      <section className="section" aria-label="Of class rate distributions">
        <h2 className="section-title">
          &ldquo;Of Class&rdquo; Rate Distributions
          {selectedYear ? ` (${selectedYear})` : ""}
        </h2>
        <p className="section-description">
          Rates scaled to the graduating class size (grade 12 enrollment).
          Shows what fraction of each school&rsquo;s senior class applied to,
          was accepted by, or enrolled at the selected UC campus(es).
        </p>
        <div className="trend-charts-grid" style={{ marginTop: "var(--space-6)" }}>
          <div className="trend-chart-card">
            <h3 className="subsection-title">Application Rate of Class</h3>
            <DistributionPlot data={appRateOfClassDistribution} height={300} />
          </div>
          <div className="trend-chart-card">
            <h3 className="subsection-title">Acceptance Rate of Class</h3>
            <DistributionPlot data={acceptRateOfClassDistribution} height={300} />
          </div>
          <div className="trend-chart-card">
            <h3 className="subsection-title">Enrollment Rate of Class</h3>
            <DistributionPlot data={enrollRateOfClassDistribution} height={300} />
          </div>
        </div>
      </section>

      {/* Top Schools Lists */}
      <section className="section" aria-label="Top schools by acceptance rate">
        <h2 className="section-title">
          Top Schools by Acceptance Rate
          {selectedYear ? ` (${selectedYear})` : ""}
        </h2>
        <div className="top-schools-grid">
          <div className="top-schools-list">
            <h3 className="subsection-title top-schools-title-public">
              Highest Acceptance Rate — Public Schools
            </h3>
            {topPublicSchools.length > 0 ? (
              <ol className="top-schools-ol">
                {topPublicSchools.map((item) => (
                  <li key={item.school.id} className="top-school-item">
                    <Link
                      to={`/school/${item.school.id}`}
                      className="top-school-link"
                    >
                      {item.school.name}
                    </Link>
                    <span className="top-school-rate">
                      {formatPercent(item.rate)}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="no-data-message">No public school data available.</p>
            )}
          </div>

          <div className="top-schools-list">
            <h3 className="subsection-title top-schools-title-private">
              Highest Acceptance Rate — Private Schools
            </h3>
            {topPrivateSchools.length > 0 ? (
              <ol className="top-schools-ol">
                {topPrivateSchools.map((item) => (
                  <li key={item.school.id} className="top-school-item">
                    <Link
                      to={`/school/${item.school.id}`}
                      className="top-school-link"
                    >
                      {item.school.name}
                    </Link>
                    <span className="top-school-rate">
                      {formatPercent(item.rate)}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="no-data-message">No private school data available.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

/** Helper to get top N schools by acceptance rate for a given school type */
function getTopSchools(
  records: AdmissionRecord[],
  schools: School[],
  schoolType: "public" | "private",
  limit: number
): { school: School; rate: number }[] {
  const schoolMap = new Map(schools.map((s) => [s.id, s]));

  const schoolRates: { school: School; rate: number }[] = [];

  for (const record of records) {
    const school = schoolMap.get(record.schoolId);
    if (!school || school.type !== schoolType) continue;

    const rate = computeAcceptanceRate(record);
    if (rate === null) continue;

    schoolRates.push({ school, rate });
  }

  // Sort by acceptance rate descending
  schoolRates.sort((a, b) => b.rate - a.rate);

  return schoolRates.slice(0, limit);
}
