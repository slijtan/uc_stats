# Product Requirements Document: uc_stats

**Protocol:** SNPR-20260328-9d62
**Date:** 2026-03-28
**Author:** Product Manager Agent
**Version:** 1.0

---

## Overview

**uc_stats** is a static web application that visualizes University of California admissions data — applicants, admits, enrollees, and mean GPA — broken down by source high school in California. The product enables users to compare acceptance rates between **public and private high schools**, a dimension that no existing tool surfaces as its primary interactive feature.

The UC Information Center publishes admissions data by source school across all nine undergraduate campuses. While several third-party sites visualize this data (CollegeAcceptance.info, UniPal, Ask Ms. Sun), none centers the **public vs. private high school comparison** as the primary lens. FlowingData published a compelling editorial analysis showing that private school seniors apply to selective UCs at higher rates yet are admitted at roughly equal or lower rates than public school peers — but that analysis was a static, one-time visualization. uc_stats makes this comparison interactive, filterable, and explorable across schools, campuses, and years.

The product ships as a static site with pre-processed data (JSON). No backend server is required. Data extraction and processing scripts are included as part of the project to enable periodic manual updates.

---

## Target Users

### Primary: High School Students and Parents

High school juniors and seniors (and their parents) researching UC admissions. They want to understand how their high school's applicants have historically fared — acceptance rates, GPA profiles, and trends — and how their school compares to similar schools, especially across the public/private divide. They are asking questions like:

- "What is the UC acceptance rate from my high school?"
- "Do students from private schools get into Berkeley at higher rates than students from my public school?"
- "Which UC campuses admit the most students from my school?"
- "Has the trend been getting better or worse over the last few years?"

These users are typically not data-literate and need clear, intuitive visualizations with minimal jargon.

### Secondary: Educators and School Counselors

High school counselors and educators who advise students on UC applications. They want to compare their school's performance against peer schools (same county, same type, similar demographics) and track multi-year trends. They are comfortable with tables and data but still benefit from clear visual summaries.

---

## Requirements

### Core Data Visualization Features

**R1.** The system shall display UC admissions data (applicants, admits, enrollees, and mean GPA) for individual California high schools, covering approximately the last 10 years of available data (2015-2025).

**R2.** The system shall calculate and display an acceptance rate (admits / applicants) for each school, clearly labeled as a derived metric with the calculation method visible to users.

**R3.** The system shall allow users to view admissions data for each of the nine UC undergraduate campuses individually as well as a systemwide aggregate.

**R4.** The system shall display year-over-year trend data for a selected school, showing how acceptance rate, applicant count, and mean GPA have changed over the available time range.

**R5.** The system shall clearly indicate the data vintage (most recent year available) and note that UC data is typically published with a 1-2 year lag.

### Search and Filtering Capabilities

**R6.** The system shall provide a search interface that allows users to find a high school by name, with support for partial matching and common misspellings (fuzzy search).

**R7.** The system shall allow users to filter the school list by school type (public or private).

**R8.** The system shall allow users to filter by UC campus (individual campus or systemwide).

**R9.** The system shall allow users to filter by year or year range within the available data window.

**R10.** The system shall allow users to filter by county or geographic region within California.

### Public vs. Private Comparison Features (Core Differentiator)

**R11.** The system shall provide a dedicated comparison view that shows public school acceptance rates side-by-side with private school acceptance rates for a selected UC campus and year.

**R12.** The system shall display aggregate statistics comparing public and private high schools, including: median acceptance rate, mean acceptance rate, total applicants, total admits, and mean GPA — for a selected campus and year.

**R13.** The system shall visualize the distribution of acceptance rates for public schools vs. private schools (e.g., histogram, box plot, or dot plot) so users can see the full spread, not just averages.

**R14.** The system shall allow users to compare two specific schools side-by-side (one or both may be public or private), showing their admissions data across campuses and years.

**R15.** The system shall surface a prominent "Public vs. Private" summary on the landing page or main dashboard, making the core differentiator immediately visible to first-time users without requiring navigation.

### Data Presentation (Charts and Tables)

**R16.** The system shall present admissions data in both chart and table formats. Users shall be able to switch between chart view and table view for any dataset.

**R17.** Charts shall include, at minimum: bar charts for comparing acceptance rates across schools or campuses, and line charts for showing trends over time.

**R18.** Tables shall be sortable by any column (school name, acceptance rate, applicant count, mean GPA, etc.).

**R19.** The system shall show data completeness indicators — when data for a school or year is missing or suppressed (small cell sizes), the system shall indicate this rather than displaying zeros or omitting the school silently.

**R20.** The system shall include proper data attribution, citing the UC Information Center as the data source, with a link to the original data and a note that the UC does not endorse this tool.

### Responsive Design and Accessibility

**R21.** The system shall be usable on desktop browsers (1024px and wider) as the primary experience, and shall be functional (though potentially simplified) on tablet and mobile viewports.

**R22.** The system shall provide text-based alternatives to all chart visualizations (data tables) so that the information is accessible to users who cannot perceive charts.

**R23.** The system shall support keyboard navigation for all interactive elements (search, filters, tabs, sortable table headers).

**R24.** The system shall use sufficient color contrast (WCAG 2.1 AA) and shall not rely on color alone to convey information in charts.

### Data Pipeline

**R25.** The project shall include scripts to extract UC admissions data from Tableau CSV/Excel exports and transform it into the JSON format consumed by the static site.

**R26.** The project shall include scripts to match UC source school names to CDE school directory entries, producing a mapping that enriches school records with county and geographic data.

**R27.** The data processing scripts shall output a data-quality report identifying schools that could not be matched, years with missing data, and any records that were suppressed or excluded.

---

## Non-Functional Requirements

### Performance

**NFR1.** The initial page load (first contentful paint) shall complete within 3 seconds on a standard broadband connection (10 Mbps+).

**NFR2.** The total size of pre-processed data shipped to the client shall not exceed 5 MB (gzipped) for the 10-year dataset. If the full dataset exceeds this, data shall be split into lazy-loaded chunks (e.g., by campus or by year).

**NFR3.** Search and filter operations shall return results within 500 milliseconds of user input on a mid-range device.

### Accessibility

**NFR4.** The application shall conform to WCAG 2.1 Level AA for all non-chart content. Chart content shall have equivalent text alternatives (per R22).

**NFR5.** All interactive elements shall be reachable and operable via keyboard alone.

### Browser Support

**NFR6.** The application shall support the current and previous major version of Chrome, Firefox, Safari, and Edge. Internet Explorer is not supported.

### Data Integrity

**NFR7.** Derived metrics (acceptance rate) shall be calculated consistently and displayed with a clear methodology note. The raw counts (applicants, admits) shall always be available alongside derived percentages.

**NFR8.** The system shall never display fabricated, interpolated, or estimated data. If data is missing, it shall be explicitly marked as unavailable.

---

## Success Criteria

| # | Criterion | Measurement |
|---|-----------|-------------|
| SC1 | Users can find any California high school in the dataset within 10 seconds | Usability testing: 90% of test users locate their school within 10 seconds using search |
| SC2 | The public vs. private comparison is discoverable without guidance | Usability testing: 80% of first-time users find and interact with the public/private comparison view within 60 seconds |
| SC3 | Data covers at least 3,500 of the approximately 4,000 California high schools in the UC dataset | Automated data-quality report from R27 confirms coverage >= 87.5% |
| SC4 | Page load performance meets target | Lighthouse audit: First Contentful Paint < 3s on simulated 4G throttling |
| SC5 | Accessibility standards are met | Lighthouse accessibility score >= 90; manual WCAG 2.1 AA audit passes for non-chart content |
| SC6 | School name matching achieves high accuracy | >= 90% of UC source school names successfully matched to CDE directory entries |
| SC7 | Data accuracy is verifiable | For a random sample of 20 schools, all displayed metrics match the original UC Information Center Tableau dashboard values exactly |

---

## Out of Scope

The following items are explicitly excluded from the initial release:

1. **Non-UC systems** — CSU, community college, or private university admissions data are not included.
2. **Transfer admissions** — Only freshman/first-year admissions data is in scope.
3. **Out-of-state and international schools** — Only California public and private high schools.
4. **Individual student-level data** — Only aggregated school-level statistics.
5. **Admissions advice or predictions** — This is a data visualization tool, not a predictive model or counseling service.
6. **Real-time data** — Data is updated manually and periodically, not live.
7. **User accounts or personalization** — No login, no saved preferences, no user data collection.
8. **Mobile app** — Web only (responsive design, but no native app).
9. **Map/geographic view** — Table and chart views are sufficient for MVP. A map view may be added in a future release.
10. **Automated data extraction pipeline** — Data extraction is manual with included scripts, not a scheduled/automated pipeline.
11. **Ethnicity and gender breakdowns** — While the UC data includes these dimensions, the MVP focuses on the school-type (public/private) comparison. Demographic filters may be added later.
12. **Historical data before 2015** — The initial release covers approximately the last 10 years. The full 30-year history (back to 1994) may be added in a future release.
13. **Backend server or API** — The product is a static site. No server-side processing, database, or API layer.
14. **Automated deployment or CI/CD** — Deployment strategy is not in scope for MVP.

---

## Open Questions

### For the Architect

1. **Visualization library selection** — The discovery brief surveyed Recharts, ECharts, Chart.js, D3, and Highcharts. Which library best balances bundle size, TypeScript support, accessibility, and the chart types needed (bar, line, distribution plots)? Recommend one.

2. **Data chunking strategy** — Given ~4,000 schools x 10 years x 9 campuses, what is the expected JSON payload size? Should data be split by campus, by year, or loaded as a single file? What is the threshold for lazy loading?

3. **Fuzzy matching approach** — What algorithm or library should be used for school name matching between UC and CDE datasets? (e.g., Levenshtein distance, Fuse.js for client-side search, manual mapping table for known mismatches)

4. **Framework choice** — The config specifies TypeScript + npm but no frontend framework. Should this be React (Vite + React), or is a lighter approach (e.g., vanilla TS, Astro, SvelteKit) preferable given the static nature of the site?

5. **Data format** — Should the pre-processed data be a single JSON file, multiple JSON files (one per campus), or an SQLite database loaded via sql.js? Trade-offs between initial load time, interactivity, and complexity.
