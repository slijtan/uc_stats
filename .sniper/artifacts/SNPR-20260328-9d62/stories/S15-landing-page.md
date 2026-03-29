---
id: S15
title: "Build landing page with public vs. private dashboard"
status: ready
priority: 2
dependencies: [S03, S11, S12, S13]
requirements: [R15]
owner: fullstack-dev
---

# S15: Build landing page with public vs. private dashboard

## Description

Create the `LandingPage.tsx` component that serves as the entry point to the application. The landing page surfaces a prominent public vs. private summary dashboard, making the core differentiator immediately visible to first-time users. It also provides school search and "explore by campus" navigation.

## Acceptance Criteria

1. The system shall display a headline comparison showing public vs. private high school aggregate acceptance rates for the most recent year of data, visible without scrolling on a standard desktop viewport.
2. The system shall display summary statistics for both public and private school groups, including: total applicants, total admits, aggregate acceptance rate, and mean GPA for the default campus (Systemwide).
3. When a user selects a different campus from the campus filter on the landing page, the system shall update the public vs. private summary to reflect that campus's data.
4. The system shall include the school search component (S11) prominently positioned so users can immediately search for their school.
5. The system shall provide navigation to explore data by individual UC campus.

## Technical Context

Refers to the `LandingPage` entry in the Frontend Page Components table of `plan.md` (URL route: `/`). Data is sourced from `summary.json` (~10 KB gzipped) and optionally `campus-systemwide.json` (~300 KB gzipped), loaded at startup per the Frontend Data Loading Flow. The landing page is the critical first impression and directly addresses success criterion SC2 (80% of first-time users find the public/private comparison within 60 seconds).

## Estimated Scope

large -- primary user-facing page combining summary data, comparison charts, search, and campus navigation
