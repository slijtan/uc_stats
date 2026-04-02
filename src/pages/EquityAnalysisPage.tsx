import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  ZAxis,
} from "recharts";
import type {
  SchoolIndex,
  CampusData,
  CampusSlug,
  School,
  AdmissionRecord,
} from "../types/index.ts";
import { getSchoolIndex, getCampusData } from "../services/dataService.ts";
import {
  computeCorrelation,
  computeQuartileStats,
  computeLinearRegression,
  computeEquityGap,
} from "../services/statsService.ts";
import type { Point } from "../services/statsService.ts";

// ============================================================
// Constants
// ============================================================

const CAMPUS_OPTIONS: { value: CampusSlug; label: string }[] = [
  { value: "systemwide", label: "All UC (Systemwide)" },
  { value: "berkeley", label: "UC Berkeley" },
  { value: "davis", label: "UC Davis" },
  { value: "irvine", label: "UC Irvine" },
  { value: "la", label: "UCLA" },
  { value: "merced", label: "UC Merced" },
  { value: "riverside", label: "UC Riverside" },
  { value: "san-diego", label: "UC San Diego" },
  { value: "santa-barbara", label: "UC Santa Barbara" },
  { value: "santa-cruz", label: "UC Santa Cruz" },
];

const X_AXES: Record<string, {
  label: string;
  get: (s: School) => number | undefined;
  fmt: (v: number) => string;
}> = {
  cci: { label: "CCI % Prepared", get: (s) => s.quality?.cci, fmt: (v) => `${v.toFixed(1)}%` },
  caasppEla: { label: "CAASPP ELA", get: (s) => s.quality?.caasppEla, fmt: (v) => v.toFixed(1) },
  caasppMath: { label: "CAASPP Math", get: (s) => s.quality?.caasppMath, fmt: (v) => v.toFixed(1) },
  gradRate: { label: "Graduation Rate", get: (s) => s.quality?.gradRate, fmt: (v) => `${v.toFixed(1)}%` },
  agRate: { label: "A-G Completion %", get: (s) => s.quality?.agRate, fmt: (v) => `${v.toFixed(1)}%` },
  collegeGoing: { label: "College-Going Rate", get: (s) => s.quality?.collegeGoingRate, fmt: (v) => `${v.toFixed(1)}%` },
  chronicAbsent: { label: "Chronic Absenteeism", get: (s) => s.quality?.chronicAbsentRate, fmt: (v) => `${v.toFixed(1)}%` },
  suspension: { label: "Suspension Rate", get: (s) => s.quality?.suspensionRate, fmt: (v) => `${v.toFixed(1)}%` },
};

const Y_AXES: Record<string, {
  label: string;
  get: (r: AdmissionRecord, seniors: number) => number | null;
  fmt: (v: number) => string;
}> = {
  acceptRate: {
    label: "UC Acceptance Rate",
    get: (r) => r.admits != null && r.applicants != null && r.applicants > 0 ? r.admits / r.applicants : null,
    fmt: (v) => `${(v * 100).toFixed(1)}%`,
  },
  appRate: {
    label: "Application Rate (of class)",
    get: (r, seniors) => r.applicants != null && seniors > 0 ? r.applicants / seniors : null,
    fmt: (v) => `${(v * 100).toFixed(1)}%`,
  },
  enrollRate: {
    label: "Enrollment Rate (yield)",
    get: (r) => r.enrollees != null && r.admits != null && r.admits > 0 ? r.enrollees / r.admits : null,
    fmt: (v) => `${(v * 100).toFixed(1)}%`,
  },
  gpa: {
    label: "Mean Applicant GPA",
    get: (r) => r.gpaApplicants,
    fmt: (v) => v.toFixed(2),
  },
};

const QUARTILE_COLORS = ["#f87171", "#fb923c", "#fbbf24", "#2dd4bf"];

// ============================================================
// Data Point Type
// ============================================================

interface ScatterPoint {
  x: number;
  y: number;
  school: School;
  record: AdmissionRecord;
  seniors: number;
  size: number; // dot radius
}

// ============================================================
// Component
// ============================================================

export default function EquityAnalysisPage() {
  // --- State ---
  const [schoolIndex, setSchoolIndex] = useState<SchoolIndex | null>(null);
  const [campusData, setCampusData] = useState<CampusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [xKey, setXKey] = useState("cci");
  const [yKey, setYKey] = useState("acceptRate");
  const [campus, setCampus] = useState<CampusSlug>("systemwide");
  const [year, setYear] = useState<number | null>(null);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<School[]>([]);
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // --- Load school index ---
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const index = await getSchoolIndex();
        if (!cancelled) {
          setSchoolIndex(index);
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

  // --- Load campus data ---
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await getCampusData(campus);
        if (!cancelled) {
          setCampusData(data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load campus data");
          setLoading(false);
        }
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [campus]);

  // --- Available years ---
  const availableYears = useMemo(() => {
    if (!campusData) return [];
    const yearSet = new Set<number>();
    for (const r of campusData.records) {
      yearSet.add(r.year);
    }
    return Array.from(yearSet).sort((a, b) => b - a);
  }, [campusData]);

  // Set default year when data loads
  useEffect(() => {
    if (availableYears.length > 0 && year === null) {
      setYear(availableYears[0]!);
    }
  }, [availableYears, year]);

  // --- Fuzzy search ---
  const searchSchools = useCallback(
    (query: string) => {
      if (!schoolIndex || query.trim().length < 2) return [];
      const q = query.toLowerCase();
      const matches = schoolIndex.schools
        .filter((s) => s.name.toLowerCase().includes(q) || s.city.toLowerCase().includes(q))
        .slice(0, 10);
      return matches;
    },
    [schoolIndex],
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      if (value.trim().length < 2) {
        setSearchResults([]);
        setShowDropdown(false);
        setHighlightedIdx(-1);
        return;
      }
      const results = searchSchools(value);
      setSearchResults(results);
      setShowDropdown(results.length > 0);
      setHighlightedIdx(-1);
    },
    [searchSchools],
  );

  const selectSearchResult = useCallback(
    (school: School) => {
      setSelectedSchool(school);
      setSearchQuery(school.name);
      setShowDropdown(false);
      setHighlightedIdx(-1);
    },
    [],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showDropdown || searchResults.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIdx((prev) => Math.min(prev + 1, searchResults.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIdx((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && highlightedIdx >= 0) {
        e.preventDefault();
        selectSearchResult(searchResults[highlightedIdx]!);
      } else if (e.key === "Escape") {
        setShowDropdown(false);
      }
    },
    [showDropdown, searchResults, highlightedIdx, selectSearchResult],
  );

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // --- Compute scatter points ---
  const xAxis = X_AXES[xKey]!;
  const yAxis = Y_AXES[yKey]!;

  const scatterPoints = useMemo((): ScatterPoint[] => {
    if (!schoolIndex || !campusData || year === null) return [];

    const schoolMap = new Map(schoolIndex.schools.map((s) => [s.id, s]));
    const yearRecords = campusData.records.filter((r) => r.year === year);

    const points: ScatterPoint[] = [];

    for (const record of yearRecords) {
      const school = schoolMap.get(record.schoolId);
      if (!school || !school.quality) continue;

      const xVal = xAxis.get(school);
      if (xVal == null) continue;

      const seniors = school.grade12Enrollment?.[String(year)] ?? 0;
      const yVal = yAxis.get(record, seniors);
      if (yVal == null) continue;

      const seniorSize = seniors > 0 ? seniors : 100;
      const dotSize = Math.max(3, Math.min(14, Math.sqrt(seniorSize) * 0.8));

      points.push({ x: xVal, y: yVal, school, record, seniors, size: dotSize });
    }

    return points;
  }, [schoolIndex, campusData, year, xAxis, yAxis]);

  const publicPoints = useMemo(() => scatterPoints.filter((p) => p.school.type === "public"), [scatterPoints]);
  const privatePoints = useMemo(() => scatterPoints.filter((p) => p.school.type === "private"), [scatterPoints]);

  // Check if any schools have quality data
  const hasQualityData = useMemo(() => {
    if (!schoolIndex) return false;
    return schoolIndex.schools.some((s) => s.quality != null);
  }, [schoolIndex]);

  // --- Stats ---
  const allPoints: Point[] = useMemo(() => scatterPoints.map((p) => ({ x: p.x, y: p.y })), [scatterPoints]);
  const correlation = useMemo(() => computeCorrelation(allPoints), [allPoints]);
  const equityGap = useMemo(() => computeEquityGap(allPoints), [allPoints]);
  const regression = useMemo(() => computeLinearRegression(allPoints), [allPoints]);
  const quartiles = useMemo(() => computeQuartileStats(allPoints), [allPoints]);

  // --- Selected school quartile ---
  const selectedSchoolQuartile = useMemo(() => {
    if (!selectedSchool || quartiles.length < 4) return -1;
    const sp = scatterPoints.find((p) => p.school.id === selectedSchool.id);
    if (!sp) return -1;
    for (let i = 0; i < quartiles.length; i++) {
      if (sp.x >= quartiles[i]!.minX && sp.x <= quartiles[i]!.maxX) return i;
    }
    return -1;
  }, [selectedSchool, quartiles, scatterPoints]);

  // --- Selected school point ---
  const selectedPoint = useMemo(() => {
    if (!selectedSchool) return null;
    return scatterPoints.find((p) => p.school.id === selectedSchool.id) ?? null;
  }, [selectedSchool, scatterPoints]);

  // --- Trend line endpoints ---
  const trendLinePoints = useMemo(() => {
    if (scatterPoints.length < 2) return null;
    const xs = scatterPoints.map((p) => p.x);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    return {
      x1: minX,
      y1: regression.slope * minX + regression.intercept,
      x2: maxX,
      y2: regression.slope * maxX + regression.intercept,
    };
  }, [scatterPoints, regression]);

  // Max Y for quartile bars
  const maxQuartileAvgY = useMemo(() => {
    if (quartiles.length === 0) return 1;
    return Math.max(...quartiles.map((q) => q.avgY));
  }, [quartiles]);

  // Campus label
  const campusLabel = CAMPUS_OPTIONS.find((c) => c.value === campus)?.label ?? campus;

  // --- Loading / Error ---
  if (loading && !schoolIndex) {
    return (
      <div className="page-loading" role="status" aria-live="polite">
        <p>Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-error">
        <h2>Error Loading Data</h2>
        <p>{error}</p>
      </div>
    );
  }

  // No quality data message
  if (schoolIndex && !hasQualityData) {
    return (
      <div style={{ padding: "var(--space-6)" }}>
        <h1 className="page-title">Equity Analysis</h1>
        <div
          style={{
            marginTop: "var(--space-8)",
            padding: "var(--space-8)",
            textAlign: "center",
            background: "var(--color-bg-secondary)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-lg)",
          }}
        >
          <p style={{ fontSize: "var(--font-size-lg)", color: "var(--color-text-secondary)" }}>
            No school quality data available. Run the pipeline with CDE data to generate quality metrics.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: "var(--space-8)" }}>
      {/* Page Title */}
      <section className="section">
        <h1 className="page-title">Equity Analysis</h1>
        <p className="page-description">
          Explore the relationship between school quality metrics and UC admissions outcomes.
          How does a school's academic performance predict its students' success in the UC system?
        </p>
      </section>

      {/* Controls Bar */}
      <section className="section" aria-label="Controls">
        <div
          className="filter-group"
          role="group"
          aria-label="Chart controls"
          style={{ flexWrap: "wrap", gap: "var(--space-3)" }}
        >
          <div className="filter-field">
            <label className="filter-label" htmlFor="eq-x-axis">X-Axis</label>
            <select
              id="eq-x-axis"
              className="filter-select"
              value={xKey}
              onChange={(e) => setXKey(e.target.value)}
            >
              {Object.entries(X_AXES).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
          </div>
          <div className="filter-field">
            <label className="filter-label" htmlFor="eq-y-axis">Y-Axis</label>
            <select
              id="eq-y-axis"
              className="filter-select"
              value={yKey}
              onChange={(e) => setYKey(e.target.value)}
            >
              {Object.entries(Y_AXES).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
          </div>
          <div className="filter-field">
            <label className="filter-label" htmlFor="eq-campus">Campus</label>
            <select
              id="eq-campus"
              className="filter-select"
              value={campus}
              onChange={(e) => setCampus(e.target.value as CampusSlug)}
            >
              {CAMPUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="filter-field">
            <label className="filter-label" htmlFor="eq-year">Year</label>
            <select
              id="eq-year"
              className="filter-select"
              value={year ?? ""}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div className="filter-field" ref={searchRef} style={{ position: "relative", minWidth: 200 }}>
            <label className="filter-label" htmlFor="eq-search">Highlight School</label>
            <input
              ref={inputRef}
              id="eq-search"
              type="text"
              className="school-search-input"
              style={{
                padding: "var(--space-2) var(--space-3)",
                fontSize: "var(--font-size-sm)",
              }}
              placeholder="Search schools..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                if (searchResults.length > 0) setShowDropdown(true);
              }}
              autoComplete="off"
            />
            {showDropdown && searchResults.length > 0 && (
              <ul className="school-search-dropdown" role="listbox">
                {searchResults.map((school, idx) => (
                  <li
                    key={school.id}
                    className={`school-search-result${idx === highlightedIdx ? " highlighted" : ""}`}
                    role="option"
                    aria-selected={idx === highlightedIdx}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectSearchResult(school);
                    }}
                    onMouseEnter={() => setHighlightedIdx(idx)}
                  >
                    <div>
                      <div className="school-search-result-name">{school.name}</div>
                      <div className="school-search-result-meta">
                        {school.city}, {school.county} &middot;{" "}
                        <span className={`badge badge-${school.type}`}>{school.type}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {selectedSchool && (
            <div className="filter-field" style={{ alignSelf: "flex-end" }}>
              <button
                type="button"
                className="filter-reset-btn"
                onClick={() => {
                  setSelectedSchool(null);
                  setSearchQuery("");
                  setSearchResults([]);
                }}
              >
                Clear selection
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Selected School Card */}
      {selectedSchool && selectedPoint && (
        <section
          style={{
            marginBottom: "var(--space-6)",
            padding: "var(--space-4) var(--space-5)",
            background: "var(--color-bg)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-sm)",
            borderLeft: "4px solid #fbbf24",
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-2)" }}>
            <span style={{ fontWeight: "var(--font-weight-bold)" as unknown as number, fontSize: "var(--font-size-lg)" }}>
              {selectedSchool.name}
            </span>
            <span className={`badge badge-${selectedSchool.type}`}>{selectedSchool.type}</span>
            <span style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-size-sm)" }}>
              {selectedSchool.city}, {selectedSchool.county}
            </span>
            {selectedPoint.seniors > 0 && (
              <span style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)" }}>
                {selectedPoint.seniors} seniors
              </span>
            )}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-6)", fontSize: "var(--font-size-sm)" }}>
            <div>
              <span style={{ color: "var(--color-text-secondary)" }}>{xAxis.label}: </span>
              <strong>{xAxis.fmt(selectedPoint.x)}</strong>
            </div>
            <div>
              <span style={{ color: "var(--color-text-secondary)" }}>{yAxis.label}: </span>
              <strong>{yAxis.fmt(selectedPoint.y)}</strong>
            </div>
            {selectedSchool.quality?.gradRate != null && (
              <div>
                <span style={{ color: "var(--color-text-secondary)" }}>Grad Rate: </span>
                <strong>{selectedSchool.quality.gradRate.toFixed(1)}%</strong>
              </div>
            )}
            {selectedSchool.quality?.agRate != null && (
              <div>
                <span style={{ color: "var(--color-text-secondary)" }}>A-G Rate: </span>
                <strong>{selectedSchool.quality.agRate.toFixed(1)}%</strong>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Main Dashboard: Scatter + Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 280px",
          gap: "var(--space-6)",
          marginBottom: "var(--space-6)",
        }}
        className="equity-dashboard-grid"
      >
        {/* Scatter Plot */}
        <div
          style={{
            background: "var(--color-bg)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-sm)",
            padding: "var(--space-4)",
            minHeight: 420,
          }}
        >
          {scatterPoints.length === 0 ? (
            <div className="no-data-message">
              No schools have both quality data and admissions records for the selected filters.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <ScatterChart margin={{ top: 10, right: 20, bottom: 40, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name={xAxis.label}
                  tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
                  label={{
                    value: xAxis.label,
                    position: "bottom",
                    offset: 20,
                    style: { fontSize: 12, fill: "var(--color-text-secondary)" },
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name={yAxis.label}
                  tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
                  tickFormatter={(v: number) => yAxis.fmt(v)}
                  label={{
                    value: yAxis.label,
                    angle: -90,
                    position: "insideLeft",
                    offset: -5,
                    style: { fontSize: 12, fill: "var(--color-text-secondary)", textAnchor: "middle" },
                  }}
                />
                <ZAxis type="number" dataKey="size" range={[20, 200]} />
                <Tooltip content={<CustomTooltip xAxis={xAxis} yAxis={yAxis} />} />

                {/* Trend line via two reference dots connected */}
                {trendLinePoints && (
                  <ReferenceLine
                    segment={[
                      { x: trendLinePoints.x1, y: trendLinePoints.y1 },
                      { x: trendLinePoints.x2, y: trendLinePoints.y2 },
                    ]}
                    stroke="var(--color-text-muted)"
                    strokeDasharray="6 4"
                    strokeWidth={1.5}
                  />
                )}

                {/* Public schools */}
                <Scatter
                  name="Public"
                  data={publicPoints}
                  isAnimationActive={false}
                  onClick={(entry: ScatterPoint) => {
                    setSelectedSchool(entry.school);
                    setSearchQuery(entry.school.name);
                  }}
                  cursor="pointer"
                >
                  {publicPoints.map((p) => (
                    <Cell
                      key={p.school.id}
                      fill="var(--color-public)"
                      fillOpacity={0.6}
                      r={p.size}
                    />
                  ))}
                </Scatter>

                {/* Private schools */}
                <Scatter
                  name="Private"
                  data={privatePoints}
                  isAnimationActive={false}
                  onClick={(entry: ScatterPoint) => {
                    setSelectedSchool(entry.school);
                    setSearchQuery(entry.school.name);
                  }}
                  cursor="pointer"
                >
                  {privatePoints.map((p) => (
                    <Cell
                      key={p.school.id}
                      fill="var(--color-private)"
                      fillOpacity={0.6}
                      r={p.size}
                    />
                  ))}
                </Scatter>

                {/* Selected school (gold highlight) */}
                {selectedPoint && (
                  <Scatter
                    name="Selected"
                    data={[selectedPoint]}
                    isAnimationActive={false}
                    shape="star"
                  >
                    <Cell fill="#fbbf24" r={selectedPoint.size + 4} stroke="#b45309" strokeWidth={1.5} />
                  </Scatter>
                )}
              </ScatterChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Stat Cards Panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <StatCard
            label="Correlation"
            value={correlation.r.toFixed(3)}
            detail={correlation.label}
          />
          <StatCard
            label="Equity Gap"
            value={equityGap.gap === Infinity ? "Inf" : equityGap.gap === 0 ? "N/A" : `${equityGap.gap.toFixed(1)}x`}
            detail="Top vs bottom quartile"
          />
          <StatCard
            label="Schools"
            value={String(scatterPoints.length)}
            detail="With both metrics"
          />
          <StatCard
            label="R-squared"
            value={correlation.r2.toFixed(3)}
            detail="Coefficient of determination"
          />
          {/* Legend */}
          <div
            style={{
              background: "var(--color-bg)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-lg)",
              boxShadow: "var(--shadow-sm)",
              padding: "var(--space-3) var(--space-4)",
            }}
          >
            <div style={{ fontSize: "var(--font-size-xs)", fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "var(--space-2)" }}>
              Legend
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              <LegendItem color="var(--color-public)" label="Public Schools" />
              <LegendItem color="var(--color-private)" label="Private Schools" />
              {selectedSchool && <LegendItem color="#fbbf24" label="Selected School" />}
            </div>
          </div>
        </div>
      </div>

      {/* Insight Sentence */}
      {quartiles.length >= 4 && equityGap.gap > 0 && equityGap.gap !== Infinity && (
        <section
          style={{
            marginBottom: "var(--space-6)",
            padding: "var(--space-4) var(--space-5)",
            background: "var(--color-bg-secondary)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-lg)",
            fontSize: "var(--font-size-sm)",
            color: "var(--color-text)",
            lineHeight: 1.6,
          }}
        >
          Schools in the <strong>top quartile</strong> of {xAxis.label} have{" "}
          <strong>{equityGap.gap.toFixed(1)}x {equityGap.gap >= 1 ? "higher" : "lower"}</strong>{" "}
          {yAxis.label} at {campusLabel} than bottom quartile schools.
          The relationship is <strong>{correlation.label.toLowerCase()}</strong>.
        </section>
      )}

      {/* Quartile Breakdown */}
      {quartiles.length >= 4 && (
        <section className="section">
          <h2 className="section-title">Quartile Breakdown</h2>
          <p className="section-description">
            Schools sorted by {xAxis.label}, split into four equal groups. Bars show average {yAxis.label} per group.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "var(--space-4)",
            }}
            className="equity-quartile-grid"
          >
            {quartiles.map((q, i) => {
              const barHeight = maxQuartileAvgY > 0 ? (q.avgY / maxQuartileAvgY) * 120 : 0;
              const isSelectedQuartile = selectedSchoolQuartile === i;
              return (
                <div
                  key={q.label}
                  style={{
                    background: "var(--color-bg)",
                    border: isSelectedQuartile ? "2px solid #fbbf24" : "1px solid var(--color-border)",
                    borderRadius: "var(--radius-lg)",
                    boxShadow: isSelectedQuartile ? "0 0 0 3px rgba(251, 191, 36, 0.2)" : "var(--shadow-sm)",
                    padding: "var(--space-4)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    textAlign: "center",
                  }}
                >
                  <div style={{
                    fontSize: "var(--font-size-xs)",
                    fontWeight: 600,
                    color: "var(--color-text-secondary)",
                    marginBottom: "var(--space-3)",
                    textTransform: "uppercase",
                    letterSpacing: "0.03em",
                  }}>
                    {q.label}
                  </div>
                  {/* Bar */}
                  <div style={{
                    width: "60%",
                    height: 130,
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "center",
                    marginBottom: "var(--space-2)",
                  }}>
                    <div
                      style={{
                        width: "100%",
                        height: Math.max(4, barHeight),
                        backgroundColor: QUARTILE_COLORS[i],
                        borderRadius: "var(--radius-sm) var(--radius-sm) 0 0",
                        transition: "height 0.3s ease",
                      }}
                    />
                  </div>
                  {/* Value */}
                  <div style={{
                    fontSize: "var(--font-size-lg)",
                    fontWeight: 700,
                    color: "var(--color-text)",
                    marginBottom: "var(--space-1)",
                  }}>
                    {yAxis.fmt(q.avgY)}
                  </div>
                  {/* Count */}
                  <div style={{
                    fontSize: "var(--font-size-xs)",
                    color: "var(--color-text-muted)",
                    marginBottom: "var(--space-1)",
                  }}>
                    {q.count} schools
                  </div>
                  {/* X range */}
                  <div style={{
                    fontSize: "var(--font-size-xs)",
                    color: "var(--color-text-muted)",
                  }}>
                    {xAxis.fmt(q.minX)} &ndash; {xAxis.fmt(q.maxX)}
                  </div>
                  {isSelectedQuartile && (
                    <div style={{
                      marginTop: "var(--space-2)",
                      fontSize: "var(--font-size-xs)",
                      fontWeight: 600,
                      color: "#b45309",
                    }}>
                      Selected school
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Responsive style injection */}
      <style>{`
        @media (max-width: 768px) {
          .equity-dashboard-grid {
            grid-template-columns: 1fr !important;
          }
          .equity-quartile-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 480px) {
          .equity-quartile-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function StatCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div
      style={{
        background: "var(--color-bg)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-sm)",
        padding: "var(--space-3) var(--space-4)",
      }}
    >
      <div style={{
        fontSize: "var(--font-size-xs)",
        fontWeight: 600,
        color: "var(--color-text-secondary)",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        marginBottom: "var(--space-1)",
      }}>
        {label}
      </div>
      <div style={{
        fontSize: "var(--font-size-2xl)",
        fontWeight: 700,
        color: "var(--color-text)",
        lineHeight: 1.1,
      }}>
        {value}
      </div>
      <div style={{
        fontSize: "var(--font-size-xs)",
        color: "var(--color-text-muted)",
        marginTop: "var(--space-1)",
      }}>
        {detail}
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
      <div style={{
        width: 10,
        height: 10,
        borderRadius: "50%",
        backgroundColor: color,
        flexShrink: 0,
      }} />
      <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-secondary)" }}>{label}</span>
    </div>
  );
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ScatterPoint }>;
  xAxis: typeof X_AXES[string];
  yAxis: typeof Y_AXES[string];
}

function CustomTooltip({ active, payload, xAxis, yAxis }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0]!.payload;
  if (!data || !data.school) return null;

  return (
    <div
      style={{
        background: "var(--color-bg)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-md)",
        padding: "var(--space-3)",
        maxWidth: 260,
        fontSize: "var(--font-size-xs)",
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: "var(--space-1)", fontSize: "var(--font-size-sm)" }}>
        {data.school.name}
      </div>
      <div style={{ color: "var(--color-text-secondary)", marginBottom: "var(--space-2)" }}>
        {data.school.type === "public" ? "Public" : "Private"} &middot; {data.school.city}, {data.school.county}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <div>
          <span style={{ color: "var(--color-text-secondary)" }}>{xAxis.label}: </span>
          <strong>{xAxis.fmt(data.x)}</strong>
        </div>
        <div>
          <span style={{ color: "var(--color-text-secondary)" }}>{yAxis.label}: </span>
          <strong>{yAxis.fmt(data.y)}</strong>
        </div>
        {data.seniors > 0 && (
          <div style={{ color: "var(--color-text-muted)" }}>
            {data.seniors} seniors
          </div>
        )}
      </div>
    </div>
  );
}
