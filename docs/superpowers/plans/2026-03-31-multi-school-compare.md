# Multi-School Comparison Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a page where users can compare up to 5 high schools side by side with an at-a-glance snapshot table and 4 trend charts (acceptance rate, application rate, yield, GPA).

**Architecture:** New `MultiComparePage.tsx` component with school chip selector (reusing `SchoolSearch`), campus/year controls (reusing `CampusMultiSelect`), a transposed comparison table, and 4 `TrendLine` charts in a 2x2 grid. Data loaded via existing `dataService.ts` and aggregated across selected campuses. School IDs stored in URL query params for shareability.

**Tech Stack:** React, TypeScript, React Router, Recharts (via existing `TrendLine` component), existing CSS classes

---

### Task 1: Add route, nav link, and placeholder page

**Files:**
- Create: `src/pages/MultiComparePage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/layout/Header.tsx`

- [ ] **Step 1: Create placeholder page**

Create `src/pages/MultiComparePage.tsx`:

```tsx
export default function MultiComparePage() {
  return (
    <div className="page-placeholder">
      <h2>Compare Schools</h2>
      <p>Coming soon</p>
    </div>
  );
}
```

- [ ] **Step 2: Add route to App.tsx**

In `src/App.tsx`, add import with other page imports:

```tsx
import MultiComparePage from "./pages/MultiComparePage.tsx";
```

Add route inside `<Routes>`, after the `/by-college` route:

```tsx
<Route path="/multi-compare" element={<MultiComparePage />} />
```

- [ ] **Step 3: Update nav link in Header.tsx**

In `src/components/layout/Header.tsx`, change the existing "Compare" NavLink's `to` prop from `/compare` to `/multi-compare`:

```tsx
<NavLink
  to="/multi-compare"
  className={({ isActive }) =>
    `header-nav-link${isActive ? " active" : ""}`
  }
  onClick={closeMenu}
>
  Compare
</NavLink>
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/MultiComparePage.tsx src/App.tsx src/components/layout/Header.tsx
git commit -m "feat: add multi-compare route and nav link (placeholder)"
```

---

### Task 2: School selector with color-coded chips

**Files:**
- Modify: `src/pages/MultiComparePage.tsx`

- [ ] **Step 1: Build the full page scaffold with school selector**

Replace the placeholder `src/pages/MultiComparePage.tsx` with:

```tsx
import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import type {
  School,
  SchoolIndex,
  CampusData,
  CampusSlug,
  AdmissionRecord,
} from "../types/index.ts";
import { getSchoolIndex, getCampusData } from "../services/dataService.ts";
import SchoolSearch from "../components/search/SchoolSearch.tsx";
import CampusMultiSelect from "../components/filters/CampusMultiSelect.tsx";
import MissingDataIndicator from "../components/common/MissingDataIndicator.tsx";
import TrendLine from "../components/charts/TrendLine.tsx";
import type { TrendDataPoint, TrendLineSeries } from "../components/charts/TrendLine.tsx";

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
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/pages/MultiComparePage.tsx
git commit -m "feat: multi-compare school selector with color chips and URL params"
```

---

### Task 3: At-a-Glance comparison table

**Files:**
- Modify: `src/pages/MultiComparePage.tsx`

- [ ] **Step 1: Add aggregation logic and snapshot table**

After the `availableYears` memo in `MultiComparePage.tsx`, add the aggregation type and memo:

```tsx
/** Aggregated stats for one school */
interface SchoolSnapshot {
  school: School;
  applicants: number | null;
  admits: number | null;
  enrollees: number | null;
  seniors: number | null;
  applicationRate: number | null;
  acceptanceRate: number | null;
  acceptanceRateOfClass: number | null;
  yield: number | null;
  enrollmentRateOfClass: number | null;
  gpaApplicants: number | null;
  gpaAdmits: number | null;
}

// Aggregate stats for each selected school across selected campuses for the chosen year
const snapshots = useMemo((): SchoolSnapshot[] => {
  if (selectedYear === null) return [];

  return selectedSchools.map((school) => {
    let totalApplicants: number | null = null;
    let totalAdmits: number | null = null;
    let totalEnrollees: number | null = null;
    let gpaAppSum = 0, gpaAppWeight = 0;
    let gpaAdmSum = 0, gpaAdmWeight = 0;

    for (const slug of selectedCampuses) {
      const cd = campusDataMap.get(slug);
      if (!cd) continue;
      for (const rec of cd.records) {
        if (rec.year !== selectedYear || rec.schoolId !== school.id) continue;
        if (rec.applicants !== null) {
          totalApplicants = (totalApplicants ?? 0) + rec.applicants;
          if (rec.gpaApplicants !== null) {
            gpaAppSum += rec.gpaApplicants * rec.applicants;
            gpaAppWeight += rec.applicants;
          }
        }
        if (rec.admits !== null) {
          totalAdmits = (totalAdmits ?? 0) + rec.admits;
          if (rec.gpaAdmits !== null) {
            gpaAdmSum += rec.gpaAdmits * rec.admits;
            gpaAdmWeight += rec.admits;
          }
        }
        if (rec.enrollees !== null) {
          totalEnrollees = (totalEnrollees ?? 0) + rec.enrollees;
        }
      }
    }

    const seniors = school.grade12Enrollment?.[String(selectedYear)] ?? null;

    return {
      school,
      applicants: totalApplicants,
      admits: totalAdmits,
      enrollees: totalEnrollees,
      seniors,
      applicationRate:
        totalApplicants !== null && seniors !== null && seniors > 0
          ? totalApplicants / seniors : null,
      acceptanceRate:
        totalAdmits !== null && totalApplicants !== null && totalApplicants > 0
          ? totalAdmits / totalApplicants : null,
      acceptanceRateOfClass:
        totalAdmits !== null && seniors !== null && seniors > 0
          ? totalAdmits / seniors : null,
      yield:
        totalEnrollees !== null && totalAdmits !== null && totalAdmits > 0
          ? totalEnrollees / totalAdmits : null,
      enrollmentRateOfClass:
        totalEnrollees !== null && seniors !== null && seniors > 0
          ? totalEnrollees / seniors : null,
      gpaApplicants: gpaAppWeight > 0 ? gpaAppSum / gpaAppWeight : null,
      gpaAdmits: gpaAdmWeight > 0 ? gpaAdmSum / gpaAdmWeight : null,
    };
  });
}, [selectedSchools, selectedCampuses, selectedYear, campusDataMap]);
```

Add formatting helpers before the component (same file, after imports):

```tsx
function fmtPct(v: number | null): string {
  return v !== null ? `${(v * 100).toFixed(1)}%` : "";
}
function fmtNum(v: number | null): string {
  return v !== null ? v.toLocaleString() : "";
}
function fmtGpa(v: number | null): string {
  return v !== null ? v.toFixed(2) : "";
}
```

Add the snapshot table JSX after the `{selectedSchools.length === 0 && ...}` block, **inside** the closing `</div>`:

```tsx
{selectedSchools.length > 0 && snapshots.length > 0 && (
  <section style={{ marginTop: "var(--space-8)" }}>
    <h2 className="section-title">At a Glance ({selectedYear})</h2>
    <div className="data-table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            <th>Metric</th>
            {snapshots.map((snap, i) => (
              <th key={snap.school.id} style={{ textAlign: "right" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: SCHOOL_COLORS[i], display: "inline-block",
                  }} />
                  <Link
                    to={`/school/${snap.school.id}`}
                    style={{ color: SCHOOL_COLORS[i], textDecoration: "none" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {snap.school.name.length > 20
                      ? snap.school.name.substring(0, 20) + "…"
                      : snap.school.name}
                  </Link>
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {([
            { label: "County", values: snapshots.map((s) => s.school.county), format: "text" },
            { label: "Type", values: snapshots.map((s) => s.school.type === "public" ? "Public" : "Private"), format: "text" },
            { label: "Seniors", values: snapshots.map((s) => s.seniors), format: "number" },
            { label: "Applicants", values: snapshots.map((s) => s.applicants), format: "number" },
            { label: "App Rate", values: snapshots.map((s) => s.applicationRate), format: "percent" },
            { label: "Admits", values: snapshots.map((s) => s.admits), format: "number" },
            { label: "Accept Rate", values: snapshots.map((s) => s.acceptanceRate), format: "percent" },
            { label: "Accept % of Class", values: snapshots.map((s) => s.acceptanceRateOfClass), format: "percent" },
            { label: "Enrollees", values: snapshots.map((s) => s.enrollees), format: "number" },
            { label: "Yield", values: snapshots.map((s) => s.yield), format: "percent" },
            { label: "Enroll % of Class", values: snapshots.map((s) => s.enrollmentRateOfClass), format: "percent" },
            { label: "GPA (Applicants)", values: snapshots.map((s) => s.gpaApplicants), format: "gpa" },
            { label: "GPA (Admits)", values: snapshots.map((s) => s.gpaAdmits), format: "gpa" },
          ] as { label: string; values: (string | number | null)[]; format: string }[]).map((row) => {
            // Find best (highest numeric) value for bolding
            const numericValues = row.values.map((v) =>
              typeof v === "number" ? v : null
            );
            const maxVal = numericValues.some((v) => v !== null)
              ? Math.max(...numericValues.filter((v): v is number => v !== null))
              : null;
            const isBoldable = row.format !== "text";

            return (
              <tr key={row.label}>
                <td style={{ fontWeight: 500 }}>{row.label}</td>
                {row.values.map((val, i) => {
                  const isNull = val === null;
                  const isBest = isBoldable && typeof val === "number" && val === maxVal && numericValues.filter((v) => v === maxVal).length === 1;
                  let formatted = "";
                  if (typeof val === "string") {
                    formatted = val;
                  } else if (row.format === "percent") {
                    formatted = fmtPct(val);
                  } else if (row.format === "gpa") {
                    formatted = fmtGpa(val);
                  } else {
                    formatted = fmtNum(val);
                  }

                  return (
                    <td
                      key={i}
                      className={typeof val !== "string" ? `numeric${isNull ? " null-value" : ""}` : ""}
                      style={isBest ? { fontWeight: 600 } : undefined}
                    >
                      {isNull ? <MissingDataIndicator type="suppressed" /> : formatted}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </section>
)}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/pages/MultiComparePage.tsx
git commit -m "feat: multi-compare at-a-glance snapshot table"
```

---

### Task 4: Trend charts (2x2 grid)

**Files:**
- Modify: `src/pages/MultiComparePage.tsx`

- [ ] **Step 1: Add trend data computation and chart rendering**

After the `snapshots` memo, add the trend data computation. This aggregates per school per year across selected campuses, then derives rates:

```tsx
// Aggregate records per school per year across selected campuses
const schoolYearAggregates = useMemo(() => {
  const result = new Map<string, Map<number, {
    applicants: number; admits: number; enrollees: number;
    gpaAppSum: number; gpaAppWeight: number;
    seniors: number | null;
  }>>();

  for (const school of selectedSchools) {
    const yearMap = new Map<number, {
      applicants: number; admits: number; enrollees: number;
      gpaAppSum: number; gpaAppWeight: number;
      seniors: number | null;
    }>();

    for (const slug of selectedCampuses) {
      const cd = campusDataMap.get(slug);
      if (!cd) continue;
      for (const rec of cd.records) {
        if (rec.schoolId !== school.id) continue;
        let agg = yearMap.get(rec.year);
        if (!agg) {
          agg = {
            applicants: 0, admits: 0, enrollees: 0,
            gpaAppSum: 0, gpaAppWeight: 0,
            seniors: school.grade12Enrollment?.[String(rec.year)] ?? null,
          };
          yearMap.set(rec.year, agg);
        }
        if (rec.applicants !== null) {
          agg.applicants += rec.applicants;
          if (rec.gpaApplicants !== null) {
            agg.gpaAppSum += rec.gpaApplicants * rec.applicants;
            agg.gpaAppWeight += rec.applicants;
          }
        }
        if (rec.admits !== null) agg.admits += rec.admits;
        if (rec.enrollees !== null) agg.enrollees += rec.enrollees;
      }
    }

    result.set(school.id, yearMap);
  }

  return result;
}, [selectedSchools, selectedCampuses, campusDataMap]);

// Build trend data for a given metric
function buildTrend(
  extract: (agg: { applicants: number; admits: number; enrollees: number; gpaAppSum: number; gpaAppWeight: number; seniors: number | null }) => number | null,
): TrendDataPoint[] {
  const allYears = new Set<number>();
  for (const yearMap of schoolYearAggregates.values()) {
    for (const y of yearMap.keys()) allYears.add(y);
  }

  const years = [...allYears].sort((a, b) => a - b);
  return years.map((year) => {
    const point: TrendDataPoint = { year };
    for (const school of selectedSchools) {
      const agg = schoolYearAggregates.get(school.id)?.get(year);
      point[school.id] = agg ? extract(agg) : null;
    }
    return point;
  });
}

const acceptanceRateTrend = useMemo(
  () => buildTrend((a) => a.applicants > 0 ? a.admits / a.applicants : null),
  [schoolYearAggregates, selectedSchools], // eslint-disable-line react-hooks/exhaustive-deps
);

const applicationRateTrend = useMemo(
  () => buildTrend((a) => a.seniors !== null && a.seniors > 0 ? a.applicants / a.seniors : null),
  [schoolYearAggregates, selectedSchools], // eslint-disable-line react-hooks/exhaustive-deps
);

const yieldTrend = useMemo(
  () => buildTrend((a) => a.admits > 0 ? a.enrollees / a.admits : null),
  [schoolYearAggregates, selectedSchools], // eslint-disable-line react-hooks/exhaustive-deps
);

const gpaTrend = useMemo(
  () => buildTrend((a) => a.gpaAppWeight > 0 ? a.gpaAppSum / a.gpaAppWeight : null),
  [schoolYearAggregates, selectedSchools], // eslint-disable-line react-hooks/exhaustive-deps
);

// Shared series definition — each school is a line
const trendSeries: TrendLineSeries[] = useMemo(
  () => selectedSchools.map((school, i) => ({
    dataKey: school.id,
    label: school.name,
    color: SCHOOL_COLORS[i] ?? "#6b7280",
  })),
  [selectedSchools],
);
```

Add the charts JSX after the snapshot table section, before the closing `</div>`:

```tsx
{selectedSchools.length > 0 && (
  <section style={{ marginTop: "var(--space-8)" }}>
    <h2 className="section-title">Trends Over Time</h2>
    <div className="trend-charts-grid">
      <div className="trend-chart-card">
        <h3 className="subsection-title">Acceptance Rate</h3>
        <TrendLine data={acceptanceRateTrend} series={trendSeries} yAxisFormat="percent" height={280} />
      </div>
      <div className="trend-chart-card">
        <h3 className="subsection-title">Application Rate</h3>
        <TrendLine data={applicationRateTrend} series={trendSeries} yAxisFormat="percent" height={280} />
      </div>
      <div className="trend-chart-card">
        <h3 className="subsection-title">Yield Rate</h3>
        <TrendLine data={yieldTrend} series={trendSeries} yAxisFormat="percent" height={280} />
      </div>
      <div className="trend-chart-card">
        <h3 className="subsection-title">Mean GPA (Applicants)</h3>
        <TrendLine data={gpaTrend} series={trendSeries} yAxisFormat="number" yDomain={[2.5, 4.5]} height={280} />
      </div>
    </div>
  </section>
)}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/pages/MultiComparePage.tsx
git commit -m "feat: multi-compare trend charts (2x2 grid)"
```

---

### Task 5: CSS and final polish

**Files:**
- Modify: `src/styles/global.css`
- Modify: `src/pages/MultiComparePage.tsx`

- [ ] **Step 1: Add CSS for multi-compare page**

In `src/styles/global.css`, add after the `.by-college-page` rule:

```css
.multi-compare-page {
  padding-bottom: var(--space-8);
}
```

- [ ] **Step 2: Verify end-to-end in browser**

Test at `http://localhost:5173/#/multi-compare`:
1. "Compare" tab in nav links to multi-compare page
2. Search and add schools — chips appear with colors
3. Remove schools with ✕ button
4. School IDs appear in URL query params
5. Campus and year controls work
6. At-a-glance table shows with colored school column headers
7. Best values are bolded in each row
8. School names in table headers link to detail page
9. 4 trend charts render with colored lines per school
10. Charts show all years, not filtered by year selector
11. Old `/compare` and `/compare/:id1/:id2` routes still work via direct URL

- [ ] **Step 3: Commit**

```bash
git add src/styles/global.css src/pages/MultiComparePage.tsx
git commit -m "feat: multi-compare page polish and CSS"
```
