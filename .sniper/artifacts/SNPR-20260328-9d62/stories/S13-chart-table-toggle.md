---
id: S13
title: "Build chart/table toggle and base chart components"
status: ready
priority: 2
dependencies: [S03, S10]
requirements: [R16, R17]
owner: fullstack-dev
---

# S13: Build chart/table toggle and base chart components

## Description

Create the `ChartTableToggle.tsx` component that lets users switch between chart and table views for any dataset, and the base chart components (`AcceptanceRateBar.tsx` for bar charts, `TrendLine.tsx` for line charts) using Recharts. These are reusable building blocks used by all page-level components.

## Acceptance Criteria

1. The system shall provide a toggle control that allows users to switch between chart view and table view for any dataset, retaining the current filter state across view changes.
2. The system shall render bar charts comparing acceptance rates across schools or campuses using the Recharts library.
3. The system shall render line charts showing year-over-year trends for acceptance rates, applicant counts, or GPA using the Recharts library.
4. When the data for a chart contains `null` values (suppressed data), the system shall display a gap or visual indicator in the chart rather than plotting zero.

## Technical Context

Refers to D-design-002 (Recharts) and the chart component entries in `plan.md` (`AcceptanceRateBar.tsx`, `TrendLine.tsx`, `ChartTableToggle.tsx`). Charts render SVG via Recharts, which supports ARIA attributes for accessibility (addressed further in S21). The `DistributionPlot.tsx` component is deferred to S17 where it is needed for the comparison page.

## Estimated Scope

medium -- three components with Recharts integration and null-data handling
