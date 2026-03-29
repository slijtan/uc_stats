---
id: S07
title: "Generate campus-partitioned JSON data files"
status: ready
priority: 1
dependencies: [S06]
requirements: [R25, NFR2]
owner: fullstack-dev
---

# S07: Generate campus-partitioned JSON data files

## Description

Create the `scripts/transform/generate-json.ts` script that takes computed admission records and summary aggregates, partitions them by campus, and writes the 12 JSON files consumed by the frontend: `school-index.json`, `summary.json`, and 10 `campus-{slug}.json` files.

## Acceptance Criteria

1. The system shall generate a `school-index.json` file conforming to the `SchoolIndex` interface, containing metadata for all schools including name, type, county, city, UC name, match status, and available years.
2. The system shall generate a `summary.json` file conforming to the `SummaryData` interface, containing pre-computed public vs. private group aggregates for all campus-year combinations.
3. The system shall generate one `campus-{slug}.json` file for each of the 10 campuses (systemwide plus nine individual campuses), each conforming to the `CampusData` interface.
4. The system shall write all JSON files to the output directory specified via CLI argument, defaulting to `public/data/`.

## Technical Context

Refers to D-design-003 (campus-partitioned JSON files) and the `generate-json.ts` entry in the Data Pipeline Components table of `plan.md`. The file structure is defined in the Data Format section: `school-index.json`, `summary.json`, and `campus-{slug}.json` for each of the 10 campus slugs defined in the `CampusSlug` type.

## Estimated Scope

medium -- data partitioning and file I/O with well-defined output schemas
