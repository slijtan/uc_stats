---
id: S22
title: "Implement responsive design for tablet and mobile viewports"
status: ready
priority: 3
dependencies: [S15, S16, S17, S18]
requirements: [R21]
owner: fullstack-dev
---

# S22: Implement responsive design for tablet and mobile viewports

## Description

Adapt the application layout, charts, tables, and filter components to be functional across desktop (1024px+), tablet (768px-1023px), and mobile (<768px) viewports. Desktop is the primary experience; tablet and mobile may be simplified but must remain functional.

## Acceptance Criteria

1. The system shall provide a full-featured layout at desktop viewports (1024px and wider) with side-by-side comparisons, full data tables, and standard chart sizes.
2. While the viewport width is between 768px and 1023px (tablet), the system shall reflow content into a single-column layout where necessary, maintaining all functionality with adjusted component sizing.
3. While the viewport width is below 768px (mobile), the system shall present a simplified layout with horizontally scrollable tables, stacked chart views, and a collapsible filter panel, while retaining access to all core features.
4. The system shall ensure that charts resize responsively and remain readable at all supported viewport widths, using Recharts' `ResponsiveContainer` component.

## Technical Context

Refers to R21 in the PRD (desktop primary, tablet and mobile functional). Recharts provides a `ResponsiveContainer` component for chart resizing. CSS media queries or container queries handle layout adjustments. The filter components (S12) should collapse into an expandable panel on smaller viewports to preserve screen real estate.

## Estimated Scope

medium -- CSS responsive adjustments across all pages and components, chart responsive containers
