---
id: S04
title: "Build Tableau CSV/Excel export parser"
status: ready
priority: 1
dependencies: [S02]
requirements: [R25]
owner: fullstack-dev
---

# S04: Build Tableau CSV/Excel export parser

## Description

Create the `scripts/extract/parse-tableau-export.ts` script that reads raw CSV and Excel files exported from the UC Information Center's Tableau dashboards and produces structured TypeScript objects (arrays of raw admission records). This is the first stage of the data pipeline.

## Acceptance Criteria

1. When given a Tableau CSV export file, the system shall parse it into an array of structured admission record objects with normalized column names and correct data types (numbers for counts and GPAs, strings for school names and campus names).
2. When given a Tableau Excel (.xlsx) export file, the system shall parse it into the same structured format as a CSV input.
3. If a CSV or Excel file contains malformed rows (missing required columns, non-numeric values in numeric fields), then the system shall log a warning identifying the row and continue processing remaining rows without crashing.
4. The system shall handle character encoding issues (UTF-8 BOM, special characters in school names) and produce clean string output.

## Technical Context

Refers to the Data Pipeline Components table in `plan.md` and the `parse-tableau-export.ts` entry. Uses `csv-parse` and `xlsx` npm packages as dev dependencies. Input format is the Tableau "Download > Crosstab" export; exact column schema should be documented from an actual export per open question #14 in the discovery brief.

## Estimated Scope

medium -- file parsing with error handling and two input formats (CSV and Excel)
