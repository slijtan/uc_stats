---
id: S14
title: "Build sortable data table component"
status: ready
priority: 2
dependencies: [S03, S10]
requirements: [R18]
owner: fullstack-dev
---

# S14: Build sortable data table component

## Description

Create the `SchoolTable.tsx` component that displays admissions data in a table format with sortable columns. This is the table counterpart to the chart views and is used as the default accessible alternative to charts across all pages.

## Acceptance Criteria

1. The system shall display admissions data in a tabular format with columns for school name, acceptance rate, applicant count, admit count, enrollee count, and mean GPA.
2. When a user clicks a column header, the system shall sort the table by that column in ascending order; clicking the same header again shall reverse to descending order.
3. The system shall visually indicate the currently active sort column and sort direction.
4. When a user clicks a school name in the table, the system shall navigate to that school's detail page.

## Technical Context

Refers to the `SchoolTable.tsx` entry in `plan.md` under the tables component group. The table receives data from the data service layer (S03) after filtering. Sortable columns should support both numeric and string sorting. The table also serves as the accessible alternative to chart views per R22.

## Estimated Scope

medium -- table component with multi-column sorting logic and navigation integration
