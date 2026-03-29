---
id: S05
title: "Implement school name normalization and UC-to-CDE matching"
status: ready
priority: 1
dependencies: [S02, S04]
requirements: [R26]
owner: fullstack-dev
---

# S05: Implement school name normalization and UC-to-CDE matching

## Description

Create the `scripts/transform/normalize-schools.ts` script that matches UC source school names to CDE (California Department of Education) directory entries. This enriches each school record with county, city, school type, and CDE school ID. The matching pipeline uses a multi-step strategy: exact match, normalized match, Jaro-Winkler similarity, and manual overrides.

## Acceptance Criteria

1. When a UC source school name exactly matches a CDE directory entry, the system shall link the two records and mark the school as matched.
2. When an exact match fails, the system shall attempt a normalized match (lowercase, remove punctuation, standardize abbreviations such as "HS" to "High School") before escalating to fuzzy matching.
3. When normalized matching fails, the system shall apply Jaro-Winkler similarity with a threshold of 0.85 or higher to identify probable matches.
4. When a school name appears in the manual override file (`scripts/data/school-name-overrides.json`), the system shall use the override mapping regardless of algorithmic match results.
5. If a school cannot be matched by any method, then the system shall flag it as unmatched and include it in output with `matched: false` and the original UC name preserved.

## Technical Context

Refers to D-design-004 in `plan.md` (Jaro-Winkler + manual overrides) and the `normalize-schools.ts` entry in the pipeline component table. Uses the `jaro-winkler` npm package. The manual overrides file is committed to the repo and grows over time as unmatched schools are resolved. CDE data sources are documented in the discovery brief section 2.

## Estimated Scope

large -- multi-step matching algorithm with fuzzy logic and manual override support
