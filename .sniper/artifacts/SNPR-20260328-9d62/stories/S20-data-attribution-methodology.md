---
id: S20
title: "Add data attribution and methodology notes"
status: ready
priority: 3
dependencies: [S10, S15, S16]
requirements: [R2, R5, R20]
owner: fullstack-dev
---

# S20: Add data attribution and methodology notes

## Description

Create the `MethodologyNote.tsx` component and ensure data attribution and methodology disclosures are consistently displayed throughout the application. Users should always understand where the data comes from, how acceptance rates are calculated, and the limitations of the data.

## Acceptance Criteria

1. The system shall display a methodology note wherever acceptance rates appear, explaining that acceptance rate is calculated as `admits / applicants` and is a derived metric not published directly by the UC.
2. The system shall display data attribution on every page, citing the UC Information Center as the data source with a link to the original data at `universityofcalifornia.edu`.
3. The system shall include a disclaimer stating that the University of California does not endorse this tool and that the data is republished for informational purposes.
4. When a user views any page, the system shall indicate the data vintage (most recent year available) and note the typical 1-2 year publication lag.

## Technical Context

Refers to requirements R2, R5, and R20 in the PRD, the `MethodologyNote.tsx` component, the `Footer.tsx` component (R20 attribution), and the `DataVintageNotice.tsx` component (R5). The footer attribution is established in S10; this story adds the methodology note component and ensures consistent placement across pages. Legal considerations from the discovery brief (constraint #5-7) inform the disclaimer language.

## Estimated Scope

small -- two small components with static content and consistent placement
