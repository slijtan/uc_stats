# Architecture Plan: uc_stats

**Protocol:** SNPR-20260328-9d62
**Date:** 2026-03-28
**Author:** Architect Agent
**Version:** 1.0

---

## Context

**uc_stats** is a static web application that visualizes University of California admissions data (applicants, admits, enrollees, mean GPA) broken down by source high school in California. Its core differentiator is making the **public vs. private high school comparison** the primary interactive lens, something no existing tool provides as a first-class feature.

### Key constraints

- **Static site, no backend.** Decided in D-define-006. All data is pre-processed JSON served as static files.
- **TypeScript + npm.** From `config.yaml`. No frontend framework is pre-selected.
- **10-year window (2015-2025).** Decided in D-define-003. Limits data volume significantly compared to the full 30-year history.
- **Charter schools = public.** Decided in D-define-007. Follows UC classification.
- **No ethnicity/gender in MVP.** Decided in D-define-010. Reduces data dimensions.
- **No map view in MVP.** Decided in D-define-005. Eliminates geocoding/mapping library dependencies.
- **Manual data updates with scripts.** Decided in D-define-008 and D-define-009.

### Data volume estimate

The UC dataset contains ~4,000 California high schools. With 10 years and 9 campuses plus systemwide, the theoretical maximum is 4,000 x 10 x 10 = 400,000 records. In practice, many schools have few applicants to selective campuses, and data suppression reduces this. A realistic estimate is **100,000-200,000 records**.

Each record contains: school ID, campus ID, year, applicants, admits, enrollees, and mean GPA values. With a normalized schema (school metadata separate from admissions records), the raw JSON estimate is:

- **School index:** ~4,000 schools x 100 bytes = ~400 KB
- **Admissions data:** ~150,000 records x 60 bytes (numeric fields, IDs only) = ~9 MB

Raw total: ~9.5 MB. Gzipped JSON compresses 70-80%, yielding **~2-3 MB gzipped** for the full dataset. This is within the 5 MB gzipped budget (NFR2), so a single-file approach is viable for the admissions data, with school metadata in a separate index file.

### Referenced documents

- PRD: `.sniper/artifacts/SNPR-20260328-9d62/prd.md`
- Discovery brief: `.sniper/artifacts/discovery-brief.md`
- Prior decisions: D-define-001 through D-define-010

---

## Decisions

### D-design-001: Framework Choice — React with Vite

**Context:** The config specifies TypeScript + npm but no frontend framework. The PRD requires interactive filtering (R6-R10), chart/table toggling (R16), sortable tables (R18), and side-by-side comparisons (R14). Options range from vanilla TS to full frameworks.

**Options considered:**

| Option | Pros | Cons |
|--------|------|------|
| **Vanilla TS** | Zero framework overhead, smallest bundle | Manual state management, manual DOM updates, no component reuse ecosystem, slow development velocity |
| **Astro** | Excellent static site support, island architecture, ships zero JS by default | Interactive features require a UI framework anyway (React/Svelte islands), adds indirection |
| **Svelte (SvelteKit)** | Small bundle, fast runtime, good DX | Smaller ecosystem, fewer visualization library integrations, less community support for charting |
| **React (Vite + React)** | Largest ecosystem, best visualization library support, TypeScript-first with Vite, excellent DX (HMR), many developers already know it | Larger baseline bundle than Svelte/vanilla, virtual DOM overhead |

**Decision:** React with Vite.

**Rationale:** The PRD requires substantial interactivity: search with fuzzy matching, multi-axis filtering, chart/table toggling, side-by-side comparisons, and distribution plots. This is a data-heavy interactive application, not a content site. React's ecosystem provides the best support for the visualization library (Recharts is React-native), has first-class TypeScript integration via Vite, and is the most widely understood framework, which matters for a project that will be maintained periodically. Vite provides fast builds and hot module replacement. The bundle size difference vs. Svelte is negligible compared to the data payload (~2-3 MB) and chart library.

**Consequences:** React + Vite added as dependencies. Build output is a static `dist/` directory deployable to any static host (GitHub Pages, Netlify, Vercel, S3).

---

### D-design-002: Visualization Library — Recharts

**Context:** The PRD requires bar charts (R17), line charts (R17), and distribution plots (R13), with chart/table toggling (R16) and accessibility requirements (R22, R24). The discovery brief evaluated five libraries.

**Options considered:**

| Option | Bundle (gzipped) | TypeScript | Accessibility | Fit |
|--------|-------------------|------------|---------------|-----|
| **Recharts** | ~45 KB (tree-shaken) | Built-in | Good (SVG-based, ARIA attributes) | Native React, covers bar/line/area/scatter |
| **ECharts** | ~300 KB min | Supported | Moderate (Canvas-based, ARIA plugin) | Overpowered for this use case, larger bundle |
| **Chart.js** | ~60 KB | @types | Moderate (Canvas-based) | Good for simple charts, less composable in React |
| **D3** | Varies (~30-100 KB) | @types | Manual (full control) | Maximum flexibility but requires writing everything from scratch |
| **Highcharts** | ~80 KB | Built-in | Excellent (built-in accessibility module) | Requires commercial license |

**Decision:** Recharts.

**Rationale:** Recharts is the best fit for this project because:

1. **Native React integration.** Composable chart components align with the React architecture (D-design-001). No wrapper library needed.
2. **SVG rendering.** SVG output is inherently more accessible than Canvas (screen readers can traverse SVG elements, and ARIA attributes can be applied directly). This directly supports R22, R24, and NFR4.
3. **Chart type coverage.** Recharts supports bar charts, line charts, area charts, scatter plots, and composed charts. The distribution visualization (R13) can be implemented as a grouped bar chart (histogram) or a scatter/dot plot using Recharts' ScatterChart or composed BarChart.
4. **Bundle size.** With tree-shaking, only the components used are included. Estimated ~45 KB gzipped for bar + line + scatter, which is modest.
5. **TypeScript.** Built-in type definitions, no `@types` package needed.
6. **Stability.** Recharts has been maintained for ~10 years with a large user base. It's boring technology.

For the distribution plot (R13, public vs. private acceptance rate distributions), we'll use a combination of Recharts' BarChart (for histograms) and a custom box-plot component built with Recharts' ComposedChart and ReferenceLine primitives. If box plots prove too complex with Recharts, a simple histogram/dot strip is an acceptable fallback that still communicates the distribution.

**Consequences:** Recharts added as a dependency. Chart components are standard React components.

---

### D-design-003: Data Format — Multiple JSON Files (Campus-Partitioned)

**Context:** The full dataset is estimated at ~9 MB raw JSON, ~2-3 MB gzipped. The PRD specifies a 5 MB gzipped limit (NFR2) and 3-second initial load (NFR1). D-define-006 established static site with pre-processed JSON.

**Options considered:**

| Option | Pros | Cons |
|--------|------|------|
| **Single JSON file** | Simplest implementation, one fetch, no routing complexity | ~2-3 MB gzipped initial download; all-or-nothing load; wasteful if user only explores one campus |
| **Multiple JSON files (by campus)** | Incremental loading, ~200-300 KB per campus file gzipped; fast initial load with index + one campus | Slightly more complex data loading logic; need a school index file for search |
| **SQLite via sql.js** | SQL queries on client, efficient for complex filtering | ~1 MB WASM overhead for sql.js, steeper implementation, overkill for pre-aggregated data |

**Decision:** Multiple JSON files, partitioned by campus.

**Rationale:**

- **Initial load performance.** The landing page shows a public vs. private summary (R15), which can be served from a precomputed `summary.json` (~5-10 KB) plus the systemwide campus file (~300 KB). Total initial payload: ~300-400 KB gzipped. This comfortably meets the 3-second FCP target (NFR1).
- **Lazy loading.** Individual campus data files are loaded on demand when the user selects a campus filter (R8). Each campus file is ~200-300 KB gzipped.
- **Search works across all schools.** A lightweight school index file (~100 KB gzipped) containing just school names, IDs, types, and counties is loaded at startup. This enables fast search (R6) and filtering (R7, R10) without loading all admissions data.
- **Total budget.** School index (~100 KB) + summary (~10 KB) + systemwide campus (~300 KB) + 9 individual campus files (~300 KB each) = ~3.1 MB total gzipped. Well within the 5 MB limit.
- **Simplicity over SQLite.** sql.js adds a 1 MB WASM dependency and requires SQL query construction. For pre-aggregated data with predictable access patterns, JSON files with `fetch()` are simpler, faster to implement, and easier to debug.

**File structure:**

```
data/
  school-index.json      # School metadata (name, id, type, county)
  summary.json           # Pre-computed aggregates for landing page
  campus-systemwide.json # Admissions data for systemwide
  campus-berkeley.json   # Admissions data for UC Berkeley
  campus-davis.json      # ...
  campus-irvine.json
  campus-la.json
  campus-merced.json
  campus-riverside.json
  campus-san-diego.json
  campus-santa-barbara.json
  campus-santa-cruz.json
```

**Consequences:** Data pipeline must produce 12 JSON files. Frontend needs a data loading layer that fetches on demand and caches in memory.

---

### D-design-004: Fuzzy Matching — Fuse.js for Client-Side Search, Levenshtein + Manual Overrides for Pipeline

**Context:** Two distinct fuzzy matching needs exist: (1) matching UC source school names to CDE directory entries during data processing (R26), and (2) client-side search by users (R6). These have different requirements.

**Options considered for client-side search:**

| Option | Bundle | Speed | Quality |
|--------|--------|-------|---------|
| **Fuse.js** | ~5 KB gzipped | Fast for <10K items | Good fuzzy matching, configurable thresholds |
| **FlexSearch** | ~6 KB gzipped | Faster (indexed) | Better for full-text, less focused on fuzzy |
| **Custom (simple substring + Levenshtein)** | ~1 KB | Varies | Requires tuning, handles fewer edge cases |

**Options considered for pipeline matching (UC to CDE names):**

| Option | Approach |
|--------|----------|
| **Levenshtein distance** | Standard edit distance, good for typos and abbreviations |
| **Jaro-Winkler** | Better for name matching (weights prefix similarity) |
| **Manual mapping table** | Handles known mismatches that no algorithm can resolve |

**Decision:**

- **Client-side search:** Fuse.js. It is small (~5 KB gzipped), purpose-built for fuzzy search over lists, handles partial matches and typos well, and requires minimal configuration. It operates over the school index file (~4,000 entries) and returns results within the 500ms budget (NFR3) easily.
- **Pipeline matching:** Jaro-Winkler similarity (via the `jaro-winkler` npm package or a simple implementation) combined with a manual override mapping file. The pipeline first attempts exact match, then normalized match (lowercase, remove punctuation, standardize abbreviations like "HS" / "High School"), then Jaro-Winkler with a 0.85 threshold, then flags unmatched schools for manual review. The manual mapping file is committed to the repository and grows over time.

**Consequences:** Fuse.js added as a frontend dependency. The data pipeline includes a matching step with a manual overrides file (`scripts/data/school-name-overrides.json`).

---

### D-design-005: Data Chunking Strategy — No Further Chunking Needed

**Context:** The data volume estimate (D-design-003) showed that campus-partitioned JSON files are each ~200-300 KB gzipped. The question is whether further chunking (e.g., by year within each campus) is needed.

**Decision:** No further chunking. Campus-level partitioning is sufficient.

**Rationale:** At ~200-300 KB per campus file gzipped, each file loads in under 200ms on a 10 Mbps connection. Year-level partitioning would add complexity (10 files per campus = 100 total files) with minimal performance benefit. The school index file enables filtering before data is loaded, so users never wait for data they won't use.

**Lazy loading threshold:** Data files are loaded when the user selects a campus. The systemwide file is loaded by default on the landing page. If a future release adds 30 years of data, year-level partitioning can be introduced then.

**Consequences:** Simple data loading logic. No need for a data prefetching strategy.

---

## Components

### Project Directory Structure

```
uc_stats/
├── public/
│   └── data/                        # Pre-processed JSON data files (build output)
│       ├── school-index.json
│       ├── summary.json
│       ├── campus-systemwide.json
│       ├── campus-berkeley.json
│       ├── campus-davis.json
│       ├── campus-irvine.json
│       ├── campus-la.json
│       ├── campus-merced.json
│       ├── campus-riverside.json
│       ├── campus-san-diego.json
│       ├── campus-santa-barbara.json
│       └── campus-santa-cruz.json
│
├── scripts/                         # Data pipeline (infrastructure ownership)
│   ├── extract/
│   │   └── parse-tableau-export.ts  # Parse Tableau CSV/Excel exports
│   ├── transform/
│   │   ├── normalize-schools.ts     # Normalize school names, match UC→CDE
│   │   ├── compute-metrics.ts       # Calculate acceptance rates, aggregates
│   │   └── generate-json.ts         # Produce the campus-partitioned JSON files
│   ├── validate/
│   │   └── data-quality-report.ts   # Coverage report, unmatched schools, gaps
│   ├── data/
│   │   ├── school-name-overrides.json  # Manual UC→CDE name mappings
│   │   └── campus-ids.json          # Campus name/ID/slug mapping
│   └── pipeline.ts                  # Orchestrator: runs extract → transform → validate
│
├── src/
│   ├── pages/                       # Page-level components (frontend ownership)
│   │   ├── LandingPage.tsx          # R15: Public vs. private summary dashboard
│   │   ├── SchoolDetailPage.tsx     # R1, R4: Individual school view with trends
│   │   ├── ComparisonPage.tsx       # R11, R12, R13: Public vs. private comparison
│   │   └── SchoolVsSchoolPage.tsx   # R14: Two-school side-by-side comparison
│   │
│   ├── components/                  # Reusable UI components (frontend ownership)
│   │   ├── charts/
│   │   │   ├── AcceptanceRateBar.tsx    # R17: Bar chart for rate comparison
│   │   │   ├── TrendLine.tsx            # R17: Line chart for year-over-year trends
│   │   │   ├── DistributionPlot.tsx     # R13: Histogram/dot plot for rate distribution
│   │   │   └── ChartTableToggle.tsx     # R16: Toggle between chart and table view
│   │   ├── tables/
│   │   │   ├── SchoolTable.tsx          # R18: Sortable data table
│   │   │   └── ComparisonTable.tsx      # R12: Aggregate stats comparison table
│   │   ├── search/
│   │   │   └── SchoolSearch.tsx         # R6: Fuzzy search with Fuse.js
│   │   ├── filters/
│   │   │   ├── CampusFilter.tsx         # R8: Campus selector
│   │   │   ├── YearFilter.tsx           # R9: Year/year-range selector
│   │   │   ├── SchoolTypeFilter.tsx     # R7: Public/private toggle
│   │   │   └── CountyFilter.tsx         # R10: County/region selector
│   │   ├── layout/
│   │   │   ├── Header.tsx               # Site header with navigation
│   │   │   ├── Footer.tsx               # Data attribution (R20), methodology note
│   │   │   └── DataVintageNotice.tsx    # R5: Data freshness indicator
│   │   └── common/
│   │       ├── MissingDataIndicator.tsx # R19: Data completeness indicators
│   │       └── MethodologyNote.tsx      # R2: Acceptance rate calculation disclosure
│   │
│   ├── hooks/                       # Custom React hooks (frontend ownership)
│   │   ├── useDataLoader.ts         # Lazy-loads campus JSON files on demand
│   │   ├── useSchoolSearch.ts       # Fuse.js search over school index
│   │   └── useFilters.ts           # Filter state management
│   │
│   ├── services/                    # Data access layer (backend ownership)
│   │   ├── dataService.ts           # Fetch, cache, and query JSON data
│   │   └── computeService.ts        # Client-side metric calculations
│   │
│   ├── types/                       # TypeScript type definitions
│   │   └── index.ts                 # All interfaces and type aliases
│   │
│   ├── styles/                      # Styles (frontend ownership)
│   │   └── global.css               # Global styles, CSS custom properties
│   │
│   ├── App.tsx                      # Root component with routing
│   ├── main.tsx                     # Entry point
│   └── vite-env.d.ts               # Vite type declarations
│
├── tests/                           # Tests (tests ownership)
│   ├── pipeline/                    # Data pipeline tests
│   │   ├── parse-tableau-export.test.ts
│   │   ├── normalize-schools.test.ts
│   │   └── compute-metrics.test.ts
│   └── components/                  # Component tests
│       ├── SchoolSearch.test.tsx
│       └── AcceptanceRateBar.test.tsx
│
├── docs/                            # Documentation (docs ownership)
│   └── data-pipeline.md            # How to run data extraction and updates
│
├── index.html                       # Vite entry HTML
├── vite.config.ts                   # Vite configuration
├── tsconfig.json                    # TypeScript configuration
├── package.json                     # Dependencies and scripts
└── .gitignore
```

### Component Descriptions

#### Data Pipeline Components (`scripts/` -- infrastructure ownership)

| Component | Purpose | Input | Output |
|-----------|---------|-------|--------|
| `parse-tableau-export.ts` | Reads Tableau CSV/Excel exports and normalizes column names, data types, and encoding | Raw CSV/Excel files downloaded from UC Information Center | Structured TypeScript objects (array of raw admission records) |
| `normalize-schools.ts` | Matches UC source school names to CDE directory entries using exact match, normalized match, Jaro-Winkler similarity, and manual overrides (R26) | Raw admission records + CDE school directory + override mapping | Enriched school records with CDE school ID, county, city, school type |
| `compute-metrics.ts` | Calculates derived metrics (acceptance rate = admits/applicants), aggregates for public vs. private summaries, and systemwide totals (R2, R12) | Enriched school records | Records with computed fields + summary aggregates |
| `generate-json.ts` | Partitions data by campus and writes the JSON files consumed by the frontend | Computed records | 12 JSON files (school index, summary, 10 campus files) |
| `data-quality-report.ts` | Produces a report of unmatched schools, missing data years, suppressed records, and coverage statistics (R27) | All pipeline data | Markdown report + JSON summary |
| `pipeline.ts` | Orchestrates the full pipeline: extract, transform, validate | CLI arguments (input directory, output directory) | All output files + quality report |

#### Frontend Page Components (`src/pages/` -- frontend ownership)

| Page | URL Route | Purpose | Key Features |
|------|-----------|---------|--------------|
| `LandingPage` | `/` | Entry point and public vs. private dashboard (R15) | Summary statistics, headline comparison chart, school search, "explore by campus" navigation |
| `SchoolDetailPage` | `/school/:id` | Individual school deep dive (R1, R4) | Acceptance rate by campus (bar chart), year-over-year trends (line chart), data table, missing data indicators |
| `ComparisonPage` | `/compare` | Public vs. private comparison (R11, R12, R13) | Distribution plot, aggregate statistics table, campus and year filters |
| `SchoolVsSchoolPage` | `/compare/:id1/:id2` | Two-school side-by-side (R14) | Parallel bar charts, trend lines, data tables for both schools |

#### Data Layer Components (`src/services/` -- backend ownership)

| Component | Purpose |
|-----------|---------|
| `dataService.ts` | Fetches JSON files with caching. Exposes `getSchoolIndex()`, `getCampusData(campusSlug)`, `getSummary()`. Uses in-memory cache so each file is fetched at most once per session. |
| `computeService.ts` | Client-side filtering and aggregation. Filters records by year, school type, county. Computes acceptance rates from raw counts. Produces comparison aggregates. |

#### Routing

Client-side routing via `react-router-dom` (hash-based routing for static site compatibility):

- `/#/` -- Landing page
- `/#/school/:schoolId` -- School detail
- `/#/compare` -- Public vs. private comparison
- `/#/compare/:schoolId1/:schoolId2` -- School vs. school

Hash routing ensures the static site works on any host without server-side URL rewriting.

---

## Data Model

### TypeScript Interfaces

```typescript
// ============================================================
// School Index (school-index.json)
// ============================================================

/** Unique identifier for a school, derived from CDE CDS code or a generated ID for unmatched schools */
type SchoolId = string;

/** School type as classified by the UC Information Center */
type SchoolType = "public" | "private";

/** UC campus slug used as file identifier and filter value */
type CampusSlug =
  | "systemwide"
  | "berkeley"
  | "davis"
  | "irvine"
  | "la"
  | "merced"
  | "riverside"
  | "san-diego"
  | "santa-barbara"
  | "santa-cruz";

/** Metadata for a single high school. Loaded at startup for search and filtering. */
interface School {
  /** Unique school identifier */
  id: SchoolId;
  /** Display name (from CDE directory, or UC name if unmatched) */
  name: string;
  /** Public or private */
  type: SchoolType;
  /** California county */
  county: string;
  /** City */
  city: string;
  /** Original name as it appears in UC data (for debugging/matching) */
  ucName: string;
  /** Whether this school was matched to a CDE directory entry */
  matched: boolean;
  /** Years for which any data exists (for quick filtering) */
  yearsAvailable: number[];
}

/** The school index file structure */
interface SchoolIndex {
  /** Last updated timestamp (ISO 8601) */
  generatedAt: string;
  /** Total number of schools */
  totalSchools: number;
  /** Array of all schools */
  schools: School[];
}


// ============================================================
// Campus Data (campus-{slug}.json)
// ============================================================

/** A single admissions record for one school, one campus, one year */
interface AdmissionRecord {
  /** References School.id in the school index */
  schoolId: SchoolId;
  /** Academic year (e.g., 2024 represents Fall 2024 admissions cycle) */
  year: number;
  /** Number of applicants (null if suppressed) */
  applicants: number | null;
  /** Number of admits (null if suppressed) */
  admits: number | null;
  /** Number of enrollees (null if suppressed) */
  enrollees: number | null;
  /** Mean high school GPA of applicants (null if suppressed) */
  gpaApplicants: number | null;
  /** Mean high school GPA of admits (null if suppressed) */
  gpaAdmits: number | null;
  /** Mean high school GPA of enrollees (null if suppressed) */
  gpaEnrollees: number | null;
}

/** Structure of each campus data file */
interface CampusData {
  /** Campus slug */
  campus: CampusSlug;
  /** Campus display name (e.g., "UC Berkeley") */
  campusName: string;
  /** Year range covered */
  yearRange: { min: number; max: number };
  /** Total number of records in this file */
  totalRecords: number;
  /** All admission records for this campus */
  records: AdmissionRecord[];
}


// ============================================================
// Summary Data (summary.json)
// ============================================================

/** Pre-computed aggregate statistics for one group (public or private) */
interface GroupAggregate {
  /** Number of schools in this group */
  schoolCount: number;
  /** Total applicants across all schools */
  totalApplicants: number;
  /** Total admits across all schools */
  totalAdmits: number;
  /** Aggregate acceptance rate (totalAdmits / totalApplicants) */
  acceptanceRate: number;
  /** Mean acceptance rate across individual schools (unweighted) */
  meanSchoolAcceptanceRate: number;
  /** Median acceptance rate across individual schools */
  medianSchoolAcceptanceRate: number;
  /** Mean GPA of applicants (weighted by applicant count) */
  meanGpa: number;
}

/** Summary for a single campus and year */
interface CampusSummary {
  campus: CampusSlug;
  campusName: string;
  year: number;
  public: GroupAggregate;
  private: GroupAggregate;
}

/** The summary file structure */
interface SummaryData {
  generatedAt: string;
  /** Summary for the most recent year, all campuses */
  latestYear: number;
  /** Summaries organized by campus, then by year */
  summaries: CampusSummary[];
}


// ============================================================
// Derived/Computed Types (client-side only, not in JSON)
// ============================================================

/** Acceptance rate and related metrics computed on the client */
interface ComputedMetrics {
  /** admits / applicants (null if either is null) */
  acceptanceRate: number | null;
  /** enrollees / admits (null if either is null) */
  yield: number | null;
}

/** A fully resolved school record for display, combining index + admission data */
interface SchoolAdmissionView {
  school: School;
  record: AdmissionRecord;
  computed: ComputedMetrics;
}
```

### Data Nullability Convention

The UC Information Center suppresses data for small cell sizes (privacy protection). In our JSON:

- `null` means the data point was suppressed or unavailable in the source data.
- `0` means the source data explicitly reported zero.
- Missing records (no `AdmissionRecord` for a school/campus/year combination) means the school had no applicants to that campus in that year and does not appear in the UC data.

This three-way distinction is critical for R19 (data completeness indicators) and NFR8 (never display fabricated data).

---

## Data Flow

### Overview

```
UC Information Center          CDE School Directory
(Tableau CSV/Excel exports)    (Public/Private school files)
        │                               │
        ▼                               ▼
┌─────────────────┐           ┌──────────────────┐
│  parse-tableau-  │           │  (downloaded as   │
│  export.ts       │           │   CSV/Excel)      │
└────────┬────────┘           └────────┬─────────┘
         │ Raw admission records       │ CDE school records
         ▼                             ▼
┌──────────────────────────────────────────────┐
│  normalize-schools.ts                         │
│  1. Exact name match                          │
│  2. Normalized match (lowercase, strip abbr)  │
│  3. Jaro-Winkler similarity (≥ 0.85)         │
│  4. Manual override lookup                    │
│  5. Flag unmatched for review                 │
└────────────────────┬─────────────────────────┘
                     │ Enriched records (with county, type, CDE ID)
                     ▼
┌──────────────────────────────────────────────┐
│  compute-metrics.ts                           │
│  1. Calculate acceptance rates                │
│  2. Compute public/private group aggregates   │
│  3. Compute per-campus summaries              │
│  4. Identify suppressed/missing data          │
└────────────────────┬─────────────────────────┘
                     │ Computed records + summaries
                     ▼
┌──────────────────────────────────────────────┐
│  generate-json.ts                             │
│  1. Build school-index.json                   │
│  2. Build summary.json                        │
│  3. Partition records by campus               │
│  4. Write campus-{slug}.json files            │
└────────────────────┬─────────────────────────┘
                     │ 12 JSON files
                     ▼
┌──────────────────────────────────────────────┐
│  data-quality-report.ts                       │
│  1. Count matched vs. unmatched schools       │
│  2. Identify years with missing data          │
│  3. List suppressed records                   │
│  4. Calculate coverage percentage             │
│  5. Output report (Markdown + JSON)           │
└──────────────────────────────────────────────┘
                     │
                     ▼
              public/data/
         (12 JSON files ready for
          the static site to serve)
```

### Pipeline Execution

The pipeline is run manually via npm script:

```bash
# Full pipeline: extract → transform → validate → generate
npm run pipeline -- --input ./raw-data --output ./public/data

# Individual steps (for debugging)
npm run pipeline:extract -- --input ./raw-data
npm run pipeline:match -- --cde-dir ./raw-data/cde
npm run pipeline:generate -- --output ./public/data
npm run pipeline:validate -- --output ./reports
```

### Frontend Data Loading Flow

```
User visits site
       │
       ▼
┌──────────────┐     ┌──────────────┐
│ Load school-  │     │ Load summary │
│ index.json    │     │ .json        │
│ (~100 KB gz)  │     │ (~10 KB gz)  │
└──────┬───────┘     └──────┬───────┘
       │                     │
       ▼                     ▼
  Initialize            Render landing
  Fuse.js search        page dashboard
  index                 (R15)
       │
       │ User selects a campus or school
       ▼
┌──────────────────┐
│ Load campus-     │
│ {slug}.json      │
│ (~200-300 KB gz) │
│ (cached after    │
│  first load)     │
└──────┬───────────┘
       │
       ▼
  Render charts/tables
  with filtered data
```

### Data Caching Strategy

- **In-memory cache.** Each JSON file is fetched once per browser session and stored in a JavaScript Map. Subsequent accesses to the same campus return the cached data instantly.
- **No persistent cache (localStorage/IndexedDB).** The data is small enough that re-fetching on each session is acceptable. Persistent caching adds complexity (cache invalidation when data is updated) without meaningful benefit for ~300 KB files.
- **Browser HTTP cache.** JSON files are served with appropriate `Cache-Control` headers by the static host. Since data updates are infrequent (manual, periodic), a `max-age` of 1 day or `ETag`-based validation is sufficient.

### Build and Deploy

```bash
# Development
npm run dev          # Vite dev server with HMR

# Production build
npm run build        # Outputs to dist/ (static files)

# Preview production build locally
npm run preview      # Serves dist/ locally

# Data pipeline
npm run pipeline     # Processes raw data → public/data/
```

The `dist/` directory contains the complete static site (HTML, JS, CSS, JSON data files) and can be deployed to any static hosting service without modification.

---

## Appendix: Dependency Summary

| Dependency | Purpose | Estimated Size (gzipped) |
|------------|---------|--------------------------|
| `react` + `react-dom` | UI framework | ~42 KB |
| `react-router-dom` | Client-side routing | ~12 KB |
| `recharts` | Charts (bar, line, scatter) | ~45 KB |
| `fuse.js` | Client-side fuzzy search | ~5 KB |
| **Total runtime** | | **~104 KB** |

Dev dependencies (not shipped to users):

| Dependency | Purpose |
|------------|---------|
| `vite` | Build tool and dev server |
| `@vitejs/plugin-react` | React support for Vite |
| `typescript` | Type checking |
| `tsx` | Run pipeline scripts (TS execution) |
| `jaro-winkler` | School name matching in pipeline |
| `csv-parse` | Parse Tableau CSV exports |
| `xlsx` | Parse Tableau Excel exports |
| `vitest` | Test runner |
| `@testing-library/react` | Component testing |

The runtime bundle (excluding data files) is estimated at ~104 KB gzipped, well under typical performance budgets.
