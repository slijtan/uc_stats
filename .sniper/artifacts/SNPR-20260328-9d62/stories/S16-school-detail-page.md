---
id: S16
title: "Build school detail page with trends"
status: ready
priority: 2
dependencies: [S03, S12, S13, S14]
requirements: [R1, R3, R4]
owner: fullstack-dev
---

# S16: Build school detail page with trends

## Description

Create the `SchoolDetailPage.tsx` component that displays comprehensive admissions data for an individual high school. The page shows acceptance rates by campus (bar chart), year-over-year trends (line chart), and a data table -- all for the selected school.

## Acceptance Criteria

1. When a user navigates to `/#/school/:schoolId`, the system shall display that school's name, type (public or private), county, and city.
2. The system shall display the school's acceptance rate, applicant count, admit count, enrollee count, and mean GPA for each UC campus in the selected year, presented as both a bar chart and a sortable table.
3. The system shall display year-over-year trend lines for the school's acceptance rate, applicant count, and mean GPA for the selected campus, covering all available years.
4. When a user changes the campus filter, the system shall update the trend charts and data to reflect the newly selected campus.
5. If data for a particular campus or year is missing or suppressed for the school, then the system shall display a data completeness indicator rather than omitting the entry or showing zero.

## Technical Context

Refers to the `SchoolDetailPage` entry in the Frontend Page Components table of `plan.md` (URL route: `/school/:id`). The page loads campus data files on demand as the user selects different campuses. Uses the `AcceptanceRateBar` (bar chart), `TrendLine` (line chart), `SchoolTable` (data table), and `MissingDataIndicator` components. Addresses the primary user question: "What is the UC acceptance rate from my high school?"

## Estimated Scope

large -- multi-section page with campus bar chart, trend lines, data table, and missing data handling
