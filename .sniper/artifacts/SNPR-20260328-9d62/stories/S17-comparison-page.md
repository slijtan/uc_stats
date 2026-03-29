---
id: S17
title: "Build public vs. private comparison page with distribution plot"
status: ready
priority: 2
dependencies: [S03, S12, S13, S14]
requirements: [R11, R12, R13]
owner: fullstack-dev
---

# S17: Build public vs. private comparison page with distribution plot

## Description

Create the `ComparisonPage.tsx` component and the `DistributionPlot.tsx` chart component. This page is the core differentiator of uc_stats -- it provides a dedicated view comparing public school acceptance rates side-by-side with private school acceptance rates, including aggregate statistics and a distribution visualization.

## Acceptance Criteria

1. The system shall display public school acceptance rates side-by-side with private school acceptance rates for the selected UC campus and year, in both chart and table formats.
2. The system shall display an aggregate statistics comparison table showing: median acceptance rate, mean acceptance rate, total applicants, total admits, and mean GPA for both public and private school groups.
3. The system shall visualize the distribution of acceptance rates for public schools vs. private schools as a histogram, dot plot, or box plot, so users can see the full spread of rates and not just averages.
4. When a user changes the campus or year filter, the system shall update the comparison view, aggregate statistics, and distribution plot to reflect the new selection.
5. The system shall display a `ComparisonTable.tsx` component showing the side-by-side aggregate statistics in a structured, scannable format.

## Technical Context

Refers to the `ComparisonPage` entry in the Frontend Page Components table of `plan.md` (URL route: `/compare`), the `DistributionPlot.tsx` chart component, and the `ComparisonTable.tsx` table component. The distribution plot is implemented using Recharts' BarChart (histogram) or ScatterChart (dot plot), as described in D-design-002. If box plots prove too complex with Recharts, a histogram or dot strip is an acceptable fallback. Data comes from the per-campus JSON files filtered by school type.

## Estimated Scope

large -- page with distribution visualization, aggregate statistics table, side-by-side comparison, and multiple chart types
