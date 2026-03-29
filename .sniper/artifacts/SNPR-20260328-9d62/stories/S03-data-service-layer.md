---
id: S03
title: "Implement data service layer with fetch and caching"
status: ready
priority: 1
dependencies: [S02]
requirements: [R1, R3, NFR1, NFR2]
owner: fullstack-dev
---

# S03: Implement data service layer with fetch and caching

## Description

Build the `dataService.ts` and `computeService.ts` modules that fetch, cache, and query JSON data files. The data service is the single point of access for all data in the frontend, responsible for lazy-loading campus files on demand and caching them in memory for the session.

## Acceptance Criteria

1. When a campus data file is requested for the first time, the system shall fetch the corresponding `campus-{slug}.json` file over the network and store it in an in-memory cache.
2. When a campus data file is requested again within the same session, the system shall return the cached data without making an additional network request.
3. The system shall expose `getSchoolIndex()`, `getCampusData(campusSlug)`, and `getSummary()` functions that return typed data matching the interfaces defined in S02.
4. The system shall provide a `computeService` module that calculates acceptance rates (`admits / applicants`) and yield rates (`enrollees / admits`) from raw admission records, returning `null` when either operand is `null`.

## Technical Context

Refers to the Data Layer Components section and Data Caching Strategy section of `plan.md`. The service uses `fetch()` for network requests and a JavaScript `Map` for in-memory caching. The `computeService` handles client-side filtering by year, school type, and county, and produces comparison aggregates.

## Estimated Scope

medium -- fetch logic, caching, and computation functions with proper null handling
