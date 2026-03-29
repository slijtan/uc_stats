---
id: S10
title: "Build application layout with header, footer, and routing"
status: ready
priority: 2
dependencies: [S01]
requirements: [R20, R5]
owner: fullstack-dev
---

# S10: Build application layout with header, footer, and routing

## Description

Create the application shell: `App.tsx` with hash-based client-side routing, `Header.tsx` with site navigation, `Footer.tsx` with data attribution, and `DataVintageNotice.tsx` for data freshness indication. This provides the persistent layout frame that all pages render within.

## Acceptance Criteria

1. The system shall provide hash-based client-side routing with four routes: `/#/` (landing), `/#/school/:schoolId` (school detail), `/#/compare` (public vs. private comparison), and `/#/compare/:schoolId1/:schoolId2` (school vs. school comparison).
2. The system shall display a persistent header with navigation links to the landing page and comparison page, visible on all routes.
3. The system shall display a persistent footer containing data attribution citing the UC Information Center as the data source, a link to the original data, and a disclaimer that the UC does not endorse this tool.
4. When any page loads, the system shall display a data vintage notice indicating the most recent year of available data and a note that UC data is typically published with a 1-2 year lag.

## Technical Context

Refers to the Routing section of `plan.md` (hash-based routing via `react-router-dom`), the layout components (`Header.tsx`, `Footer.tsx`, `DataVintageNotice.tsx`), and requirements R5 (data vintage) and R20 (data attribution). Hash routing ensures compatibility with any static host without server-side URL rewriting.

## Estimated Scope

medium -- routing setup, three layout components, navigation structure
