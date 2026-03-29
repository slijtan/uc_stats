---
id: S21
title: "Implement data completeness indicators"
status: ready
priority: 3
dependencies: [S13, S14, S16]
requirements: [R19, NFR8]
owner: fullstack-dev
---

# S21: Implement data completeness indicators

## Description

Create the `MissingDataIndicator.tsx` component and integrate it throughout the application wherever data may be missing or suppressed. When data for a school, campus, or year is unavailable, the system should clearly indicate this rather than displaying zeros, leaving blanks, or omitting the school silently.

## Acceptance Criteria

1. When data for a school-campus-year combination has `null` values (suppressed by UC for small cell sizes), the system shall display a visual indicator (such as a dash, icon, or tooltip) explaining that the data was suppressed for privacy.
2. When a school has no admission records for a particular campus (no applicants), the system shall indicate "No applicants" or equivalent rather than showing zero or omitting the entry.
3. The system shall never display fabricated, interpolated, or estimated data; any value shown shall be either directly from the UC source data or a clearly labeled derived metric.
4. When viewing charts, the system shall render suppressed data points as visible gaps or distinct markers, not as zero-value data points that could be misinterpreted.

## Technical Context

Refers to the `MissingDataIndicator.tsx` component in `plan.md` and the Data Nullability Convention in the Data Model section. The three-way distinction (`null` = suppressed, `0` = explicit zero, absent record = no applicants) drives the indicator logic. This story ensures NFR8 compliance (never display fabricated data) and addresses R19 (data completeness indicators).

## Estimated Scope

medium -- reusable indicator component with integration across charts, tables, and detail views
