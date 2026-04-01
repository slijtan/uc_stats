import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import type {
  SummaryData,
  CampusSummary,
  CampusSlug,
  GroupAggregate,
} from "../types/index.ts";
import { getSchoolIndex, getSummary } from "../services/dataService.ts";
import { useFilters } from "../hooks/useFilters.ts";
import CampusFilter from "../components/filters/CampusFilter.tsx";
import YearFilter from "../components/filters/YearFilter.tsx";
import ComparisonTable from "../components/tables/ComparisonTable.tsx";
import AcceptanceRateBar from "../components/charts/AcceptanceRateBar.tsx";
import type { BarDataPoint } from "../components/charts/AcceptanceRateBar.tsx";
import DataVintageNotice from "../components/layout/DataVintageNotice.tsx";
import MethodologyNote from "../components/common/MethodologyNote.tsx";

/** Campus slugs for individual campuses (excluding systemwide) */
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

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export default function LandingPage() {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { filters, setFilter } = useFilters();

  // Load school index and summary on mount
  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const [, summaryData] = await Promise.all([
          getSchoolIndex(), // Pre-warm cache for SchoolSearch component
          getSummary(),
        ]);
        if (!cancelled) {
          setSummary(summaryData);
          setLoading(false);
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

  // Derive available years from summary data
  const availableYears = useMemo(() => {
    if (!summary) return { min: 2015, max: 2025 };
    const years = summary.summaries.map((s) => s.year);
    return {
      min: years.length > 0 ? Math.min(...years) : 2015,
      max: years.length > 0 ? Math.max(...years) : 2025,
    };
  }, [summary]);

  // The selected year (default to latest year from summary)
  const selectedYear = useMemo(() => {
    if (filters.year !== null) return filters.year;
    return summary?.latestYear ?? null;
  }, [filters.year, summary]);

  // Get systemwide summary for the selected year (for headline stats)
  const systemwideSummary = useMemo((): CampusSummary | null => {
    if (!summary || selectedYear === null) return null;
    return (
      summary.summaries.find(
        (s) => s.campus === "systemwide" && s.year === selectedYear
      ) ?? null
    );
  }, [summary, selectedYear]);

  // Get summaries for the selected campus and year (for the comparison table)
  const selectedSummary = useMemo((): CampusSummary | null => {
    if (!summary || selectedYear === null) return null;
    return (
      summary.summaries.find(
        (s) => s.campus === filters.campus && s.year === selectedYear
      ) ?? null
    );
  }, [summary, filters.campus, selectedYear]);

  // Build campus breakdown data for bar chart
  // Shows public vs. private acceptance rates across all 9 campuses for the selected year
  const campusBreakdownData = useMemo((): BarDataPoint[] => {
    if (!summary || selectedYear === null) return [];

    const data: BarDataPoint[] = [];

    for (const campusSlug of INDIVIDUAL_CAMPUSES) {
      const campusSummary = summary.summaries.find(
        (s) => s.campus === campusSlug && s.year === selectedYear
      );
      if (!campusSummary) continue;

      data.push({
        name: `${campusSummary.campusName} (Public)`,
        acceptanceRate: campusSummary.public.acceptanceRate,
        type: "public",
        applicants: campusSummary.public.totalApplicants,
        admits: campusSummary.public.totalAdmits,
      });
      data.push({
        name: `${campusSummary.campusName} (Private)`,
        acceptanceRate: campusSummary.private.acceptanceRate,
        type: "private",
        applicants: campusSummary.private.totalApplicants,
        admits: campusSummary.private.totalAdmits,
      });
    }

    return data;
  }, [summary, selectedYear]);

  // Build headline bar data (public vs. private overall)
  const headlineBarData = useMemo((): BarDataPoint[] => {
    if (!selectedSummary) return [];
    return [
      {
        name: "Public Schools",
        acceptanceRate: selectedSummary.public.acceptanceRate,
        type: "public",
        applicants: selectedSummary.public.totalApplicants,
        admits: selectedSummary.public.totalAdmits,
      },
      {
        name: "Private Schools",
        acceptanceRate: selectedSummary.private.acceptanceRate,
        type: "private",
        applicants: selectedSummary.private.totalApplicants,
        admits: selectedSummary.private.totalAdmits,
      },
    ];
  }, [selectedSummary]);

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
        <p>
          Please try refreshing the page. If the problem persists, data files
          may not yet be available.
        </p>
      </div>
    );
  }

  // Default empty aggregates for when summary isn't available
  const emptyAggregate: GroupAggregate = {
    schoolCount: 0,
    totalApplicants: 0,
    totalAdmits: 0,
    acceptanceRate: 0,
    meanSchoolAcceptanceRate: 0,
    medianSchoolAcceptanceRate: 0,
    meanGpa: 0,
  };

  return (
    <div className="landing-page">
      {/* Hero Section */}
      <section className="hero-section" aria-label="Overview">
        <h1 className="hero-title">
          UC Acceptance Rates: Public vs. Private High Schools
        </h1>
        <p className="hero-subtitle">
          Explore University of California admissions data by high school.
          Compare acceptance rates between public and private schools across all
          nine UC campuses.
        </p>
        {summary && <DataVintageNotice year={summary.latestYear} />}
      </section>

      {/* Headline Stats */}
      {systemwideSummary && selectedYear !== null && (
        <section className="section" aria-label="Systemwide statistics">
          <h2 className="section-title">
            {selectedYear} Systemwide Overview
          </h2>
          <div className="headline-stats">
            <div className="stat-card stat-card-public">
              <span className="stat-label">Public Schools</span>
              <span className="stat-value">
                {formatPercent(systemwideSummary.public.acceptanceRate)}
              </span>
              <span className="stat-detail">
                {systemwideSummary.public.schoolCount.toLocaleString()} schools
              </span>
            </div>
            <div className="stat-card stat-card-vs">
              <span className="stat-label">vs.</span>
            </div>
            <div className="stat-card stat-card-private">
              <span className="stat-label">Private Schools</span>
              <span className="stat-value">
                {formatPercent(systemwideSummary.private.acceptanceRate)}
              </span>
              <span className="stat-detail">
                {systemwideSummary.private.schoolCount.toLocaleString()} schools
              </span>
            </div>
          </div>
        </section>
      )}

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

      {/* Public vs. Private Comparison for selected campus/year */}
      <section className="section" aria-label="Public vs. private comparison">
        <h2 className="section-title">
          Public vs. Private Comparison
          {selectedSummary
            ? ` - ${selectedSummary.campusName} (${selectedYear})`
            : ""}
        </h2>

        {selectedSummary ? (
          <>
            <AcceptanceRateBar
              data={headlineBarData}
              height={200}
              layout="horizontal"
            />
            <ComparisonTable
              publicData={selectedSummary.public}
              privateData={selectedSummary.private}
            />
          </>
        ) : (
          <ComparisonTable
            publicData={emptyAggregate}
            privateData={emptyAggregate}
          />
        )}
        <MethodologyNote variant="brief" />
      </section>

      {/* Campus Breakdown */}
      {campusBreakdownData.length > 0 && (
        <section className="section" aria-label="Campus breakdown">
          <h2 className="section-title">
            Acceptance Rates by Campus{selectedYear ? ` (${selectedYear})` : ""}
          </h2>
          <p className="section-description">
            Public vs. private high school acceptance rates at each UC campus.
          </p>
          <AcceptanceRateBar
            data={campusBreakdownData}
            height={600}
            layout="vertical"
          />
        </section>
      )}

      {/* Quick Navigation */}
      <section className="section quick-nav-section" aria-label="Explore the data">
        <h2 className="section-title">Explore the Data</h2>
        <div className="quick-nav-grid">
          <Link to="/compare" className="quick-nav-card">
            <h3 className="quick-nav-card-title">
              Public vs. Private Comparison
            </h3>
            <p className="quick-nav-card-description">
              Deep dive into how public and private school acceptance rates
              differ, with distribution charts and top school lists.
            </p>
          </Link>
          {INDIVIDUAL_CAMPUSES.map((slug) => {
            const campusSummary = summary?.summaries.find(
              (s) => s.campus === slug && s.year === selectedYear
            );
            const campusName = campusSummary?.campusName ?? slug;
            return (
              <Link
                key={slug}
                to={`/compare?campus=${slug}`}
                className="quick-nav-card"
              >
                <h3 className="quick-nav-card-title">{campusName}</h3>
                <p className="quick-nav-card-description">
                  View public vs. private comparison for {campusName}.
                </p>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
