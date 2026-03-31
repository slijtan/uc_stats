# Multi-School Comparison Page — Design Spec

## Overview

A new page that allows users to compare up to 5 high schools side by side. Users build a set of schools via a search input, then see an "at a glance" comparison table and 4 trend charts with all schools overlaid. Data is aggregated across selected UC campuses (same pattern as the By College page).

## Route

- **Path:** `/multi-compare`
- **Navigation:** Replace the existing "Compare" link in `Header.tsx` with a dropdown or update it to point to this page. The existing `/compare` (top schools lists) and `/compare/:id1/:id2` (2-school) pages remain accessible but this becomes the primary comparison entry point.

Actually — simpler: rename the existing "Compare" nav link to point to `/multi-compare`. The old `/compare` and `/compare/:id1/:id2` routes stay in the router for deep links but aren't in the nav.

## Page Layout

Top to bottom:

1. **Page title** — "Compare Schools" with subtitle
2. **School selector** — single search input that adds to a chip list (up to 5 schools)
3. **Controls row** — Campus multi-select + single year dropdown
4. **"At a Glance" comparison table** — metric rows x school columns
5. **Trend charts (2x2 grid)** — Acceptance Rate, Application Rate, Yield, GPA over time

## School Selector

- Single search input using the existing `SchoolSearch` component (Fuse.js autocomplete)
- Each selected school appears as a colored chip with a dismiss (x) button
- Each school is assigned a distinct color from a fixed palette (used consistently for chips, table headers, and chart lines)
- Maximum 5 schools — search input hides when 5 are selected
- Counter: "3 of 5 selected"
- Schools can be removed by clicking the x on their chip
- URL encodes selected school IDs as query params for shareability: `/multi-compare?schools=id1,id2,id3`

### Color Palette

Fixed palette of 5 distinct colors, assigned in order:

```
#2563eb (blue), #db2777 (pink), #059669 (green), #d97706 (amber), #7c3aed (purple)
```

## Controls

### Campus Multi-Select

Reuse `CampusMultiSelect` (excludes systemwide). Default: all 9 campuses.

### Year Selector

Single-select dropdown for the "At a Glance" table. Default: latest available year. Trend charts always show all available years regardless.

## Data Loading

Same pattern as By College page:
1. Load `school-index.json` on mount
2. Load all 9 campus JSON files in parallel (cached per session)

## Data Aggregation

Same as By College page — for each school, across selected campuses and the chosen year:
- Applicants, admits, enrollees: summed across campus records
- Acceptance rate: totalAdmits / totalApplicants
- Application rate: totalApplicants / seniors
- Yield: totalEnrollees / totalAdmits
- Acceptance % of class: totalAdmits / seniors
- Enrollment % of class: totalEnrollees / seniors
- GPA: weighted average by applicant count

## "At a Glance" Comparison Table

Transposed layout — metrics as rows, schools as columns.

| Metric | School 1 | School 2 | ... |
|--------|----------|----------|-----|
| County | San Francisco | Alameda | ... |
| Type | Public | Public | ... |
| Seniors | 682 | 523 | ... |
| Applicants | 312 | 289 | ... |
| App Rate | 45.7% | 55.3% | ... |
| Admits | 47 | 51 | ... |
| Accept Rate | 15.1% | 17.6% | ... |
| Accept % of Class | 6.9% | 9.8% | ... |
| Enrollees | 32 | 27 | ... |
| Yield | 68.1% | 52.9% | ... |
| Enroll % of Class | 4.7% | 5.2% | ... |
| GPA (Applicants) | 3.84 | 3.91 | ... |
| GPA (Admits) | 3.96 | 4.02 | ... |

- Each school column header shows the school name with its assigned color dot
- School names in headers link to their detail page
- Best value in each row is bolded (highest for rates/GPA, N/A for counts)

## Trend Charts

4 charts in a 2x2 grid, each using the existing `TrendLine` component:

1. **Acceptance Rate** — admits/applicants over time
2. **Application Rate** — applicants/seniors over time
3. **Yield Rate** — enrollees/admits over time
4. **Mean GPA (Applicants)** — weighted avg GPA over time

Each chart shows all selected schools as overlaid lines using their assigned colors. Data is aggregated across selected campuses for each year.

Shared color legend below the grid showing school name + color line.

The trend charts use **all available years** (not filtered by the year selector — that only affects the snapshot table).

## New Files

- `src/pages/MultiComparePage.tsx` — Main page component

## Modified Files

- `src/App.tsx` — Add route `/multi-compare`
- `src/components/layout/Header.tsx` — Update "Compare" nav link to point to `/multi-compare`

## Reused Components

- `SchoolSearch` — For adding schools (with `onSelect` callback, `navigateOnSelect={false}`)
- `CampusMultiSelect` — Campus selection
- `TrendLine` — Trend chart rendering
- `MissingDataIndicator` — For null values
