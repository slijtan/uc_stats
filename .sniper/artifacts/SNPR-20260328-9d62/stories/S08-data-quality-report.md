---
id: S08
title: "Generate data quality report"
status: ready
priority: 2
dependencies: [S07]
requirements: [R27]
owner: fullstack-dev
---

# S08: Generate data quality report

## Description

Create the `scripts/validate/data-quality-report.ts` script that analyzes the pipeline output and produces a comprehensive quality report. The report identifies unmatched schools, years with missing data, suppressed records, and overall coverage statistics. This is the final step of the data pipeline.

## Acceptance Criteria

1. The system shall output a report listing all schools that could not be matched to a CDE directory entry, including their UC source names and the number of admission records associated with each.
2. The system shall report the overall match rate (percentage of UC source schools successfully matched to CDE entries) and flag if it falls below the 90% target (SC6).
3. The system shall identify years with missing or incomplete data for each campus, and list records where applicant or admit counts were suppressed.
4. The system shall produce both a human-readable Markdown report and a machine-readable JSON summary of quality metrics.

## Technical Context

Refers to the `data-quality-report.ts` entry in the Data Pipeline Components table of `plan.md` and success criterion SC6 (>= 90% school name matching). The report supports ongoing data quality monitoring as new years of data are added.

## Estimated Scope

medium -- analysis logic over pipeline output with two output formats
