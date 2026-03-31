# By College Page — Design Spec

## Overview

A new top-level page accessible via a "By College" tab in the header navigation. Users select one or more UC campuses and a single year, then see a ranked, sortable table of all high schools with their aggregated admission stats for the selected campuses. A search input filters the table while preserving rank numbers from the full sorted list.

## Route

- **Path:** `/by-college`
- **Navigation:** New "By College" link in `Header.tsx`, between Home and Compare

## Page Layout

Top to bottom:

1. **Page title** — "Admissions by College" with subtitle
2. **Controls row** — Campus multi-select + single year dropdown
3. **Search bar** — Text input to filter schools by name, with "Showing X of Y schools" counter
4. **Summary stat cards** — 4 cards: Total Applicants, Total Admits, Avg Accept Rate, Avg Applicant GPA (computed from the full unfiltered dataset for the selected campuses/year)
5. **Ranked sortable table** — All matching schools with rank column

## Controls

### Campus Multi-Select

Reuse the existing `CampusMultiSelect` component. Excludes "systemwide" — only the 9 individual campuses are selectable. Default: all 9 selected.

### Year Selector

Single-select dropdown (not multi-select). Available years derived from the loaded campus data. Default: latest available year.

## Data Loading

Use the existing `dataService.ts` lazy-loading pattern:

1. Load `school-index.json` at mount for school metadata
2. Load campus JSON files for all selected campuses via `getCampusData()` (already cached per session)

Since all 9 campus files need to load for the default view, load them in parallel on mount (same pattern as `SchoolDetailPage`). The files are cached, so navigating back is instant.

## Data Aggregation

For each school, across selected campuses and the chosen year:

- **Applicants:** Sum of `record.applicants` across selected campus records
- **Admits:** Sum of `record.admits` across selected campus records
- **Acceptance Rate:** `totalAdmits / totalApplicants` (computed from sums, not averaged)
- **Mean GPA (Applicants):** Weighted average — `sum(gpa * applicants) / sum(applicants)` across campus records
- **Seniors (Class Size):** From `school.grade12Enrollment[year]` (not summed — it's a school property)
- **Application Rate:** `totalApplicants / seniors` (new derived metric)

Null handling: if all campus records for a school have null for a field, the aggregated value is null. If some are null and some aren't, sum only the non-null values.

## Table Columns

| # | Column | Source | Sort | Alignment |
|---|--------|--------|------|-----------|
| 1 | **#** (rank) | Position in sorted list | Not sortable | Center |
| 2 | **School Name** | `school.name` | Alphabetical | Left |
| 3 | **Type** | `school.type` | Alphabetical | Left |
| 4 | **County** | `school.county` | Alphabetical | Left |
| 5 | **Seniors** | `school.grade12Enrollment[year]` | Numeric | Right |
| 6 | **Applicants** | Aggregated sum | Numeric | Right |
| 7 | **App Rate** | `applicants / seniors` | Numeric | Right |
| 8 | **Admits** | Aggregated sum | Numeric | Right |
| 9 | **Accept Rate** | `admits / applicants` | Numeric | Right |
| 10 | **Mean GPA** | Weighted avg of `gpaApplicants` | Numeric | Right |

### Rank Column Behavior

- Rank numbers are assigned after sorting the full (unfiltered) dataset
- When the user searches/filters, visible rows keep their original rank numbers
- Changing the sort column/direction re-ranks all schools, then the search filter applies
- The rank column header is not clickable (it's a derived position, not a sortable field)

### School Name Links

School names are clickable links that navigate to `/school/:schoolId` (the existing detail page).

## Search

- Simple text input with placeholder "Search schools..."
- Filters by school name using case-insensitive substring matching (no need for Fuse.js fuzzy search — the list is already visible and ranked)
- Counter shows "Showing X of Y schools" where Y is the total count before filtering
- Search does NOT affect rank numbers — ranks are computed from the full sorted list
- Debounce: 150ms to avoid excessive re-renders on fast typing

## Summary Stat Cards

4 cards computed from the **full dataset** (not affected by search filter):

1. **Total Applicants** — Sum across all schools for selected campuses + year
2. **Total Admits** — Sum across all schools
3. **Avg Accept Rate** — `totalAdmits / totalApplicants` (aggregate, not mean of school rates)
4. **Avg Applicant GPA** — Weighted by applicant count across all schools

These update when campus selection or year changes, but not when the search filter changes.

## New Files

- `src/pages/ByCollegePage.tsx` — Main page component with controls, summary cards, and table

## Modified Files

- `src/App.tsx` — Add route `/by-college` → `ByCollegePage`
- `src/components/layout/Header.tsx` — Add "By College" nav link between Home and Compare

## Reused Components

- `CampusMultiSelect` — Campus selection (exclude systemwide)
- `MissingDataIndicator` — For null/suppressed values in the table

## Not Building a New Table Component

The existing `SchoolTable` is tightly coupled to the `SchoolAdmissionView` type (one record per row, with campus/year columns). The By College page needs aggregated rows with rank numbers and application rate. Rather than force-fitting the existing component, the table will be built directly in `ByCollegePage.tsx` using the same CSS classes (`data-table`, `data-table-wrapper`, sort header patterns) for visual consistency. The sorting logic pattern (click-to-toggle, null-safe comparisons) will be replicated.
