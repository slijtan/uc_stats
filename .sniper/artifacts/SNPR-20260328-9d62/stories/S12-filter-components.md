---
id: S12
title: "Build filter components for campus, year, school type, and county"
status: ready
priority: 2
dependencies: [S03, S10]
requirements: [R7, R8, R9, R10]
owner: fullstack-dev
---

# S12: Build filter components for campus, year, school type, and county

## Description

Create the four filter components (`CampusFilter.tsx`, `YearFilter.tsx`, `SchoolTypeFilter.tsx`, `CountyFilter.tsx`) and the `useFilters.ts` hook that manages filter state. These filters are shared across multiple pages and allow users to narrow admissions data by campus, year/year-range, school type (public/private), and county.

## Acceptance Criteria

1. The system shall allow users to select a single UC campus or "Systemwide" from a campus filter, defaulting to "Systemwide."
2. The system shall allow users to select a single year or a year range within the available data window (approximately 2015-2025) from a year filter.
3. The system shall allow users to filter schools by type: "All," "Public," or "Private."
4. The system shall allow users to filter schools by California county, populated from the distinct counties present in the school index.
5. When any filter value changes, the system shall update displayed data within 500 milliseconds without requiring a page reload.

## Technical Context

Refers to the filter components (`CampusFilter.tsx`, `YearFilter.tsx`, `SchoolTypeFilter.tsx`, `CountyFilter.tsx`) and `useFilters.ts` hook in `plan.md`. The campus filter triggers lazy loading of campus data files via the `useDataLoader.ts` hook and `dataService.getCampusData()`. County values are derived from the `school-index.json` data.

## Estimated Scope

medium -- four filter components with shared state management hook
