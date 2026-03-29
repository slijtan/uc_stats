---
id: S09
title: "Build pipeline orchestrator and npm scripts"
status: ready
priority: 2
dependencies: [S04, S05, S06, S07, S08]
requirements: [R25, R26, R27]
owner: fullstack-dev
---

# S09: Build pipeline orchestrator and npm scripts

## Description

Create the `scripts/pipeline.ts` orchestrator that runs the full data pipeline end-to-end (extract, transform, validate, generate) and wire up npm scripts for both the full pipeline and individual steps. This enables a developer to process raw UC data into the JSON files consumed by the frontend with a single command.

## Acceptance Criteria

1. When a developer runs `npm run pipeline -- --input ./raw-data --output ./public/data`, the system shall execute the full pipeline sequence: parse Tableau exports, normalize school names, compute metrics, generate JSON files, and produce a data quality report.
2. The system shall provide individual npm scripts (`pipeline:extract`, `pipeline:match`, `pipeline:generate`, `pipeline:validate`) that run each pipeline stage independently for debugging purposes.
3. If any pipeline stage fails with an error, then the system shall log a descriptive error message identifying the failing stage and stop execution rather than continuing with corrupt data.

## Technical Context

Refers to the Pipeline Execution section of `plan.md` and the `pipeline.ts` entry in the Data Pipeline Components table. The orchestrator coordinates the four pipeline scripts (S04-S08) in sequence. Uses `tsx` for TypeScript execution of pipeline scripts.

## Estimated Scope

small -- orchestration script wiring together existing pipeline stages with CLI argument handling
