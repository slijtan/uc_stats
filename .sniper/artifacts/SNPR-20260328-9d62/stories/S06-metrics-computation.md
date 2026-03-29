---
id: S06
title: "Implement metrics computation for pipeline"
status: ready
priority: 1
dependencies: [S05]
requirements: [R2, R12]
owner: fullstack-dev
---

# S06: Implement metrics computation for pipeline

## Description

Create the `scripts/transform/compute-metrics.ts` script that calculates derived metrics from enriched admission records. This includes acceptance rates per school/campus/year, public vs. private group aggregates (total applicants, total admits, mean/median acceptance rates, mean GPA), and systemwide summaries.

## Acceptance Criteria

1. The system shall calculate acceptance rate as `admits / applicants` for each school-campus-year record, producing `null` when either value is `null` (suppressed data).
2. The system shall compute group aggregates for public and private school categories per campus and year, including: school count, total applicants, total admits, aggregate acceptance rate, mean school acceptance rate (unweighted), median school acceptance rate, and weighted mean GPA.
3. If a record has suppressed applicant or admit counts (`null`), then the system shall exclude that record from aggregate calculations rather than treating the null as zero.

## Technical Context

Refers to the `compute-metrics.ts` entry in the Data Pipeline Components table of `plan.md` and the `GroupAggregate` and `CampusSummary` interfaces in the Data Model section. The computed aggregates feed directly into `summary.json` and are also used to populate the `CampusData` files.

## Estimated Scope

medium -- arithmetic computations with careful null handling and statistical aggregations (mean, median)
