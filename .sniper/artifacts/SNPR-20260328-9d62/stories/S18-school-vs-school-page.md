---
id: S18
title: "Build school vs. school comparison page"
status: ready
priority: 3
dependencies: [S03, S11, S13, S14]
requirements: [R14]
owner: fullstack-dev
---

# S18: Build school vs. school comparison page

## Description

Create the `SchoolVsSchoolPage.tsx` component that enables users to select two specific schools and compare their admissions data side-by-side across campuses and years. Either or both schools may be public or private.

## Acceptance Criteria

1. The system shall allow users to select two schools for comparison, using the fuzzy search component (S11), with the selected school pair reflected in the URL (`/#/compare/:schoolId1/:schoolId2`).
2. The system shall display parallel bar charts showing each school's acceptance rate across all UC campuses for the selected year.
3. The system shall display parallel trend lines showing each school's acceptance rate, applicant count, and mean GPA over available years for the selected campus.
4. When data is available for one school but missing for the other in a given campus or year, the system shall display the available data alongside a missing-data indicator for the other school, rather than hiding the entry.

## Technical Context

Refers to the `SchoolVsSchoolPage` entry in the Frontend Page Components table of `plan.md` (URL route: `/compare/:id1/:id2`). The page reuses `AcceptanceRateBar`, `TrendLine`, and `SchoolTable` components from S13 and S14, rendering them in a side-by-side layout. Data for both schools is loaded via the data service layer for whichever campuses the user selects.

## Estimated Scope

medium -- parallel rendering of existing chart/table components with two-school data binding
