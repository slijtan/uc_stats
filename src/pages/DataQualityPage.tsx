import { useState, useEffect, useMemo } from "react";
import type { SchoolIndex, School } from "../types/index.ts";
import { getSchoolIndex } from "../services/dataService.ts";

type MatchMethod = School["matchMethod"];
type FilterMode = "all-non-exact" | "fuzzy" | "unmatched" | "override";

interface MatchStats {
  total: number;
  exact: number;
  normalized: number;
  fuzzy: number;
  override: number;
  unmatched: number;
  matchRate: number;
}

function computeStats(schools: School[]): MatchStats {
  const counts: Record<MatchMethod, number> = {
    exact: 0,
    normalized: 0,
    fuzzy: 0,
    override: 0,
    unmatched: 0,
  };
  for (const s of schools) {
    counts[s.matchMethod]++;
  }
  const total = schools.length;
  const matched = total - counts.unmatched;
  return {
    total,
    exact: counts.exact,
    normalized: counts.normalized,
    fuzzy: counts.fuzzy,
    override: counts.override,
    unmatched: counts.unmatched,
    matchRate: total > 0 ? matched / total : 0,
  };
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export default function DataQualityPage() {
  const [schoolIndex, setSchoolIndex] = useState<SchoolIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMode>("all-non-exact");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await getSchoolIndex();
        if (!cancelled) {
          setSchoolIndex(data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load data");
          setLoading(false);
        }
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  const stats = useMemo(() => {
    if (!schoolIndex) return null;
    return computeStats(schoolIndex.schools);
  }, [schoolIndex]);

  const reviewSchools = useMemo(() => {
    if (!schoolIndex) return [];

    let filtered = schoolIndex.schools.filter((s) => {
      if (filter === "fuzzy") return s.matchMethod === "fuzzy";
      if (filter === "unmatched") return s.matchMethod === "unmatched";
      if (filter === "override") return s.matchMethod === "override";
      return s.matchMethod === "fuzzy" || s.matchMethod === "unmatched";
    });

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.ucName.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          s.county.toLowerCase().includes(q),
      );
    }

    // Sort by years of data descending (most impactful first)
    filtered.sort((a, b) => b.yearsAvailable.length - a.yearsAvailable.length);

    return filtered;
  }, [schoolIndex, filter, search]);

  const totalForFilter = useMemo(() => {
    if (!schoolIndex) return 0;
    if (filter === "fuzzy") return schoolIndex.schools.filter((s) => s.matchMethod === "fuzzy").length;
    if (filter === "unmatched") return schoolIndex.schools.filter((s) => s.matchMethod === "unmatched").length;
    if (filter === "override") return schoolIndex.schools.filter((s) => s.matchMethod === "override").length;
    return schoolIndex.schools.filter((s) => s.matchMethod === "fuzzy" || s.matchMethod === "unmatched").length;
  }, [schoolIndex, filter]);

  if (loading) {
    return (
      <div className="page-container">
        <p className="loading-text">Loading data quality report...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <p className="error-text">Error: {error}</p>
      </div>
    );
  }

  if (!stats || !schoolIndex) return null;

  return (
    <div className="page-container">
      <header className="page-header">
        <h1 className="page-title">Data Quality</h1>
        <p className="page-subtitle">
          School name matching transparency — review how UC school names were matched to CDE directory entries
        </p>
      </header>

      {/* Stat cards */}
      <section className="content-section">
        <div className="headline-stats">
          <div className="stat-card">
            <span className="stat-label">Total Schools</span>
            <span className="stat-value">{stats.total.toLocaleString()}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Match Rate</span>
            <span className="stat-value">{formatPercent(stats.matchRate)}</span>
            <span className="stat-detail">
              {(stats.total - stats.unmatched).toLocaleString()} matched
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Exact</span>
            <span className="stat-value">{stats.exact.toLocaleString()}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Normalized</span>
            <span className="stat-value">{stats.normalized.toLocaleString()}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Fuzzy</span>
            <span className="stat-value">{stats.fuzzy.toLocaleString()}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Override</span>
            <span className="stat-value">{stats.override.toLocaleString()}</span>
            <span className="stat-detail">manually corrected</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Unmatched</span>
            <span className="stat-value">{stats.unmatched.toLocaleString()}</span>
          </div>
        </div>
      </section>

      {/* Review table */}
      <section className="content-section">
        <h2 className="section-title">Schools Needing Review</h2>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)", alignItems: "center", marginBottom: "var(--space-4)" }}>
          <div className="filter-group">
            <button
              type="button"
              className={`filter-btn${filter === "all-non-exact" ? " active" : ""}`}
              onClick={() => setFilter("all-non-exact")}
            >
              All
            </button>
            <button
              type="button"
              className={`filter-btn${filter === "fuzzy" ? " active" : ""}`}
              onClick={() => setFilter("fuzzy")}
            >
              Fuzzy Only
            </button>
            <button
              type="button"
              className={`filter-btn${filter === "unmatched" ? " active" : ""}`}
              onClick={() => setFilter("unmatched")}
            >
              Unmatched Only
            </button>
            <button
              type="button"
              className={`filter-btn${filter === "override" ? " active" : ""}`}
              onClick={() => setFilter("override")}
            >
              Overrides
            </button>
          </div>

          <div className="school-search" style={{ flex: "1", minWidth: "200px" }}>
            <input
              type="text"
              className="school-search-input"
              placeholder="Search schools..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)", marginBottom: "var(--space-3)" }}>
          Showing {reviewSchools.length} of {totalForFilter} schools
        </p>

        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>UC Name</th>
                <th>Matched CDE Name</th>
                <th>Match Method</th>
                <th>County</th>
                <th>Type</th>
                <th className="numeric">Senior Class Size (Latest Yr)</th>
                <th className="numeric">Years of Data</th>
              </tr>
            </thead>
            <tbody>
              {reviewSchools.map((school) => {
                const latestYear = school.yearsAvailable.length > 0
                  ? String(Math.max(...school.yearsAvailable))
                  : null;
                const seniors = latestYear ? school.grade12Enrollment[latestYear] : undefined;
                return (
                  <tr key={school.id}>
                    <td>{school.ucName}</td>
                    <td>{school.matchMethod !== "unmatched" ? school.name : ""}</td>
                    <td>
                      <span className={`badge ${school.matchMethod === "fuzzy" ? "badge-private" : "badge-public"}`}>
                        {school.matchMethod}
                      </span>
                    </td>
                    <td>{school.county}</td>
                    <td>
                      <span className={`badge badge-${school.type}`}>
                        {school.type}
                      </span>
                    </td>
                    <td className="numeric">{seniors != null ? seniors.toLocaleString() : "\u2014"}</td>
                    <td className="numeric">{school.yearsAvailable.length}</td>
                  </tr>
                );
              })}
              {reviewSchools.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "var(--space-8)", color: "var(--color-text-muted)" }}>
                    No schools match the current filter
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
