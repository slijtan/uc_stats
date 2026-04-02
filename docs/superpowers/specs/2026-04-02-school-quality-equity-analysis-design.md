# School Quality & Equity Analysis Feature — Design Spec

## Overview

Add CDE school quality metrics, SchoolDigger rankings, and a new Equity Analysis page to the UC Stats dashboard. Enables users to explore the relationship between school quality and UC admissions outcomes — specifically answering: do students at lower-performing schools have a proportional, disproportionately higher, or disproportionately lower chance of UC admission?

## Data Sources

### CDE Downloadable Data (Free, CSV)

All files are downloadable from CDE and joined by CDS (County-District-School) code, which the project already uses as the school identifier.

| Dataset | URL | Key Fields | Coverage |
|---------|-----|------------|----------|
| **CCI (College/Career Indicator)** | cde.ca.gov/ta/ac/cm/ccidatafiles.asp | % Prepared, % Approaching, % Not Prepared | Public schools only, 2016–present |
| **CAASPP Grade 11** | caaspp-elpac.ets.org/caaspp/ResearchFileListSB | ELA/Math Distance from Standard, % Meeting/Exceeding | Public schools only, 2015–present (no 2020) |
| **ACGR (Graduation/A-G)** | cde.ca.gov/ds/ad/filesacgr.asp | 4-year grad rate, A-G completion %, dropout rate | Public schools only, 2017–present |
| **College-Going Rate** | cde.ca.gov/ds/ad/pse.asp | % enrolling in UC/CSU/CCC/private/out-of-state within 16 months | Public schools only, 2017–present |
| **Chronic Absenteeism** | cde.ca.gov/ta/ac/cm/chronicdatafiles.asp | Chronic absence rate | Public schools only, 2017–present |
| **Suspension Rate** | cde.ca.gov/ta/ac/cm/suspdatafiles.asp | Suspension rate | Public schools only, 2017–present |

### SchoolDigger API (Free Tier)

- **API:** developer.schooldigger.com
- **Free tier:** 20 calls/day, 1 call/min — sufficient to batch-fetch all CA high schools over ~10 days, or use a paid burst
- **Data:** State rank, 1-5 star rating, test score percentile
- **Coverage:** Public and some private schools
- **Strategy:** Fetch once, cache as `raw-data/schooldigger/ca-highschools.json`. Re-fetch quarterly.

### Private School Limitation

CDE has zero performance data for private high schools (no state tests, no CCI, no graduation rate). Quality fields will be `undefined` for ~18% of schools. UI displays "No state data available" gracefully. SchoolDigger may provide partial coverage for some private schools.

## Data Model

### New Type: SchoolQuality

```typescript
interface SchoolQuality {
  // CDE College/Career Indicator
  cci?: number;                  // % Prepared (0-100)
  cciApproaching?: number;       // % Approaching Prepared
  cciNotPrepared?: number;       // % Not Prepared

  // CDE CAASPP Grade 11
  caasppEla?: number;            // Distance from Standard (points, can be negative)
  caasppMath?: number;           // Distance from Standard
  caasppElaPctMet?: number;      // % Meeting or Exceeding standard
  caasppMathPctMet?: number;     // % Meeting or Exceeding standard

  // CDE Graduation & A-G
  gradRate?: number;             // 4-year cohort graduation rate %
  agRate?: number;               // % of graduates meeting UC/CSU A-G requirements
  dropoutRate?: number;          // Cohort dropout rate %

  // CDE College-Going Rate
  collegeGoingRate?: number;     // % enrolling in any postsecondary within 16 months
  collegeGoingUC?: number;       // % enrolling specifically in UC
  collegeGoingCSU?: number;      // % enrolling specifically in CSU

  // CDE Climate Indicators
  chronicAbsentRate?: number;    // Chronic absenteeism rate %
  suspensionRate?: number;       // Suspension rate %

  // SchoolDigger
  schoolDiggerRank?: number;     // State rank among CA high schools
  schoolDiggerStars?: number;    // 1-5 star rating

  // Metadata
  dataYear?: number;             // Most recent year of CDE data
}
```

### School Interface Extension

```typescript
interface School {
  // ... existing fields unchanged ...
  quality?: SchoolQuality;       // New optional field
}
```

The `quality` field is added to each school object in `school-index.json`. No changes to campus JSON files (`campus-*.json`). Quality data is school-level metadata, not per-campus or per-year in the admission sense.

## Pipeline Changes

### New Stage: Enrich Quality Data

Inserted between the existing normalize and compute-metrics stages:

```
Stage 1: Extract (unchanged)
Stage 2: Normalize (unchanged)
Stage 2.5: Enrich Quality ← NEW
  Input: EnrichedRecord[] + CDE data files + SchoolDigger cache
  Process:
    - Parse CDE CCI, CAASPP, ACGR, CGR, chronic, suspension files
    - Match to schools by CDS code
    - Parse SchoolDigger JSON cache
    - Attach SchoolQuality to each school
  Output: EnrichedRecord[] with quality data populated
Stage 3: Compute Metrics (unchanged)
Stage 4: Generate JSON (modified — writes quality into school-index.json)
Stage 5: Validate (modified — reports quality data coverage stats)
```

### New Scripts

- `scripts/extract/parse-cde-quality.ts` — Parse all CDE quality data files into a `Map<CdsCode, SchoolQuality>`
- `scripts/download/fetch-schooldigger.ts` — Fetch SchoolDigger rankings via API, save to cache file
- Pipeline stage orchestration added to `scripts/pipeline.ts`

### Raw Data Location

```
raw-data/
  cde/
    cci/               ← CCI data files (XLSX/TXT from CDE)
    caaspp/            ← CAASPP research files (CSV)
    acgr/              ← Graduation/A-G files (TXT)
    cgr/               ← College-Going Rate files (TXT)
    chronic/           ← Chronic absenteeism files
    suspension/        ← Suspension rate files
  schooldigger/
    ca-highschools.json  ← Cached API response
```

## New Page: Equity Analysis (`/equity`)

### Layout

Dashboard style with scatter plot, side stat cards, insight text, and quartile breakdown — matching the approved prototype.

### Controls (Top Bar)

| Control | Options | Default |
|---------|---------|---------|
| X-Axis (Quality Metric) | CCI % Prepared, CAASPP ELA, CAASPP Math, Graduation Rate, A-G Completion %, College-Going Rate, Chronic Absenteeism, Suspension Rate | CCI % Prepared |
| Y-Axis (Admissions Metric) | UC Acceptance Rate, Application Rate (of class), Enrollment Rate (yield), Mean Applicant GPA | UC Acceptance Rate |
| Campus | All UC (Systemwide), + 9 individual campuses | All UC |
| Year | Available years from data | Most recent |
| Highlight School | Searchable typeahead with arrow key navigation | None |

### Scatter Plot

- Each dot = one school
- **Color:** Public (teal `#4ecdc4`) vs Private (coral `#ff6b6b`)
- **Size:** Proportional to senior class size (sqrt scale, clamped 3-16px)
- **Trend line:** Dashed linear regression line
- **Hover tooltip:** School name, X/Y values, SchoolDigger rank, type, senior count
- **Click to select:** Clicking a dot selects that school (same as search)
- **Selected school:** Rendered as gold star (`#ffd93d`), larger, with border

### Stat Cards (Right Panel)

| Card | Value | Color |
|------|-------|-------|
| Correlation | Pearson R (e.g., 0.82) + label (Strong positive) | Teal |
| Equity Gap | Top quartile avg / bottom quartile avg (e.g., 1.8x) | Coral |
| Schools | Count of schools with both metrics available | White |
| R² | Coefficient of determination | Lavender |
| Legend | Public/Private/Selected dot colors + size note | — |

### Selected School Info Card

When a school is selected (via search or click), a card appears below controls showing:
- School name, type badge, county, SchoolDigger rank, senior count
- Current X-axis value, Y-axis value, graduation rate, A-G rate

### Insight Sentence

Auto-generated text below the scatter plot:

> Schools in the **top quartile** of [X-axis metric] have **[gap]x higher** [Y-axis metric] at [campus] than bottom quartile schools. The relationship is **[superlinear/proportional/sublinear]** — [plain English explanation].

Classification:
- Gap > 2.0 → superlinear (advantage compounds significantly)
- Gap 1.3–2.0 → moderately superlinear (disproportionate edge)
- Gap 0.8–1.3 → roughly proportional (linear relationship)
- Gap < 0.8 → sublinear (possible equity boost for lower-ranked schools)

### Quartile Breakdown

Below the scatter plot. 4-column grid showing:
- Bar height = average Y-axis value for that quartile
- Colors: Q1 coral → Q2 orange → Q3 yellow → Q4 teal
- Labels: "Bottom 25%", "25th-50th", "50th-75th", "Top 25%"
- Each column shows: count of schools, X-axis range
- If a school is selected, its quartile shows the school's individual value highlighted in gold

## Existing Page Enrichment

### School Detail Page — New "School Quality" Section

Add a section (after the header, before campus metrics) showing a card grid:

| Metric | Display |
|--------|---------|
| CCI % Prepared | Percentage with color indicator |
| CAASPP ELA | DFS score |
| CAASPP Math | DFS score |
| Graduation Rate | Percentage |
| A-G Completion | Percentage |
| College-Going Rate | Percentage |
| SchoolDigger Rank | #N of total |
| Chronic Absenteeism | Percentage (lower is better) |
| Suspension Rate | Percentage (lower is better) |

For private schools with no CDE data: show "No state performance data available for private schools" in a muted info card.

### By College Page — New Columns & Filters

**New sortable columns** (optional, toggled via column settings or always visible):
- CCI (% Prepared)
- SchoolDigger Rank (#N)

**New filter:**
- Quality tier dropdown: All / Top 25% / Top 50% / Bottom 50% / Bottom 25% (based on CCI)

## Navigation

Add "Equity Analysis" to the site header navigation, between existing pages. Route: `/equity`.

## Technical Notes

### Chart Library

Use Recharts (already in the project) for the scatter plot. Recharts `ScatterChart` supports:
- Multiple datasets (public/private/selected)
- Custom dot rendering (size, color, shape)
- Tooltip on hover
- Reference lines (for trend line)

If Recharts scatter performance is insufficient with ~2,000 dots, fall back to a canvas-based approach or use `isAnimationActive={false}`.

### Statistics Computation

Compute Pearson R, R², linear regression, and quartile averages client-side. With ~2,000 data points this is trivial (<1ms). No server-side computation needed.

### Data Size Impact

SchoolQuality adds ~15-20 fields per school. With 2,617 schools, this adds roughly 200-300KB to `school-index.json` (currently ~800KB). Acceptable — no lazy loading needed for quality data.

### SchoolDigger API Rate Limits

Free tier: 20 calls/day. The API returns paginated results (max 50 schools per call). California has ~2,500 high schools = 50 API calls minimum. Strategy:
1. Script runs over 3 days at 20 calls/day, or
2. Sign up for paid tier for a one-time bulk fetch (~$8 for 2,500 calls)
3. Cache result as JSON, re-fetch quarterly

## Out of Scope

- Per-year quality data trends (CDE data goes back to 2016, but MVP shows most recent year only)
- Demographic subgroup breakdowns of quality metrics (CDE provides these, but adds significant complexity)
- Private school quality data (not available from CDE)
- Campus comparison tab from prototype Option B (can be added later)
- Distribution histogram tab (can be added later)
