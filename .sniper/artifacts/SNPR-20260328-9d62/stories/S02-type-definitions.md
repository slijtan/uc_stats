---
id: S02
title: "Define all TypeScript interfaces and type aliases"
status: ready
priority: 1
dependencies: [S01]
requirements: [R1, R2, R19]
owner: fullstack-dev
---

# S02: Define all TypeScript interfaces and type aliases

## Description

Create the complete set of TypeScript interfaces and type aliases in `src/types/index.ts` as specified in the architecture plan's Data Model section. These types define the contract between the data pipeline output and the frontend consumption layer, and are foundational to every subsequent story.

## Acceptance Criteria

1. The system shall export type definitions for `SchoolId`, `SchoolType`, `CampusSlug`, `School`, `SchoolIndex`, `AdmissionRecord`, `CampusData`, `GroupAggregate`, `CampusSummary`, `SummaryData`, `ComputedMetrics`, and `SchoolAdmissionView` from a single types module.
2. The system shall enforce the data nullability convention described in the architecture plan: `null` for suppressed data, `0` for explicit zero, and absent records for non-existent school/campus/year combinations.
3. When a developer imports from the types module, the system shall provide IntelliSense-compatible type information including JSDoc comments for all interfaces and fields.

## Technical Context

Refers to the Data Model section of `plan.md`, specifically the TypeScript Interfaces subsection and the Data Nullability Convention. These types are shared between the data pipeline scripts (`scripts/`) and the frontend (`src/`).

## Estimated Scope

small -- transcribing and documenting the defined interfaces from the architecture plan
