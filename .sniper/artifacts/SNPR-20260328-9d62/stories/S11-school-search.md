---
id: S11
title: "Build school search component with fuzzy matching"
status: ready
priority: 2
dependencies: [S03, S10]
requirements: [R6]
owner: fullstack-dev
---

# S11: Build school search component with fuzzy matching

## Description

Create the `SchoolSearch.tsx` component and `useSchoolSearch.ts` hook that provide fuzzy search over the school index using Fuse.js. Users type a school name and receive instant, ranked results with support for partial matches and common misspellings.

## Acceptance Criteria

1. When a user types at least 2 characters into the search field, the system shall display a ranked list of matching schools using fuzzy matching that tolerates partial names, abbreviations, and common misspellings.
2. The system shall return search results within 500 milliseconds of user input on a mid-range device.
3. When a user selects a school from the search results, the system shall navigate to that school's detail page (`/#/school/:schoolId`).
4. While the school index is loading, the system shall display a loading indicator in the search field rather than appearing non-functional.

## Technical Context

Refers to D-design-004 (Fuse.js for client-side search) and the `SchoolSearch.tsx` and `useSchoolSearch.ts` entries in `plan.md`. Fuse.js operates over the `school-index.json` file (~4,000 entries, ~100 KB gzipped) loaded at startup via `dataService.getSchoolIndex()`. The NFR3 performance target (500ms) is easily achievable with Fuse.js on this data size.

## Estimated Scope

medium -- Fuse.js integration, search hook, result rendering with navigation
