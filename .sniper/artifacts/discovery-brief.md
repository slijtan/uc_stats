# Discovery Brief: uc_stats

**Protocol:** SNPR-20260328-9d62
**Date:** 2026-03-28
**Author:** Analyst Agent

---

## Findings

### 1. Primary Data Source: UC Information Center

The University of California publishes official admissions data through the **UC Information Center**, specifically the "Admissions by source school" page:
- **URL:** https://www.universityofcalifornia.edu/about-us/information-center/admissions-source-school
- **Last updated:** March 12, 2026

**Available metrics per source school:**
- Number of applicants (unduplicated systemwide)
- Number of admits
- Number of enrollees
- Mean high school GPA (for freshman applicants, admits, and enrollees)

**Filters/dimensions available:**
- By UC campus (individual campus or systemwide)
- By school type: **CA Public** (including charter schools), **CA Private**, Non-CA Domestic, Foreign Institution
- By ethnicity
- By gender
- By GPA range
- By year (data goes back to approximately 1994; UC Merced data starts 2005)

**Data format:** The UC Information Center uses **embedded Tableau dashboards**. Data can be exported via Tableau's "Download > Crosstab" feature as CSV or Excel (.xlsx). There is no public REST API. A PDF guide for download instructions is referenced on the source school page.

**Fact:** The data explicitly categorizes schools as "CA Public" (including charters) and "CA Private," which directly supports the project requirement to distinguish public vs. private high schools.

### 2. Supplementary Data Source: California Department of Education

The California Department of Education (CDE) maintains a school directory with downloadable data files:
- **Public schools:** https://www.cde.ca.gov/ds/si/ds/pubschls.asp (Excel and tab-delimited text)
- **Private schools:** https://www.cde.ca.gov/ds/si/ps/index.asp (Excel and text)
- **School directory:** https://www.cde.ca.gov/schooldirectory/

This data includes school names, CDS codes, addresses, counties, school types, and status. It can be used to enrich UC admissions data with geographic information (county, city, coordinates) for mapping features.

**Assumption:** The CDE school directory names should be cross-referenceable with UC Information Center source school names, though name matching may require fuzzy matching or manual mapping.

### 3. Additional Data Source: UCOP Institutional Research

The UC Office of the President (UCOP) publishes preliminary admissions data during admissions cycles:
- **URL:** https://www.ucop.edu/institutional-research-academic-planning/content-analysis/ug-admissions/ug-data.html
- Contains preliminary application and admissions data (e.g., Fall 2026 applications)
- Final data is directed to the UC Information Center

### 4. Existing Competitor Analysis

Several third-party sites already visualize this data:

#### a. CollegeAcceptance.info
- **URL:** https://collegeacceptance.info
- Covers 1994-2025, all CA high schools
- Searchable by school, filterable by year, campus, and ethnicity
- Appears to be a React application
- **Strengths:** 30+ years of historical data, clean search interface
- **Weaknesses:** Unclear if it distinguishes public vs. private as a primary comparison axis

#### b. UniPal
- **URL:** https://www.gounipal.com/uc/dashboard
- Offers a "UC Dashboard" and "High School Explorer"
- Shows admission rates by UC campus with bar charts
- Fall 2025 data visible (932,627 total applicants, 347,645 admits)
- **Strengths:** Clean dashboard layout, campus comparison, bubble plot visualizations
- **Weaknesses:** Focused more on campus-level data than school-level comparison

#### c. Ask Ms. Sun
- **URL:** https://askmssun.com/uc-information-center/
- Provides guided access to UC Information Center Tableau dashboards
- 30 years of historical data
- Hover-based interactivity on Tableau visualizations
- **Strengths:** Comprehensive guide, includes discipline-level data
- **Weaknesses:** Essentially a wrapper around official Tableau dashboards, not a custom visualization

#### d. FlowingData / San Francisco Chronicle
- **URL:** https://flowingdata.com/2023/03/29/uc-admission-rates/
- Scatter plot visualization comparing public vs. private school admission rates
- **Key finding from their analysis:** Private school seniors were 20 percentage points more likely to apply to UCLA/Berkeley than public school peers, yet admitted at roughly equal rates. Average private school applicant had 18.3% admission chance vs. 25.8% for public school applicants.
- **Strengths:** Directly addresses the public vs. private comparison; strong editorial analysis
- **Weaknesses:** Static visualization (not interactive), single point-in-time analysis

#### e. Engaging Data
- **URL:** https://engaging-data.com/uc-admission-rates-by-major/
- Marimekko chart showing acceptance rates by major at each UC
- **Not directly comparable:** Focuses on major-level data, not school-level

**Key gap in existing tools:** No existing tool prominently features a **side-by-side public vs. private high school comparison** as its primary visualization paradigm. FlowingData did this editorially but not as an interactive tool. This represents the primary differentiation opportunity for uc_stats.

### 5. Technology Landscape

The project config specifies TypeScript with npm. Relevant visualization library options:

| Library | License | TypeScript | React | Strengths | Weaknesses |
|---------|---------|------------|-------|-----------|------------|
| **Recharts** | MIT | Built-in types | Native React | Composable components, large community, stable (~10 years) | Limited chart types vs. ECharts |
| **Apache ECharts** | Apache 2.0 | Supported | Via echarts-for-react | 20+ chart types, handles 10M+ data points, Canvas/SVG/WebGL rendering | Steeper learning curve, larger bundle |
| **Chart.js** | MIT | @types/chart.js | Via react-chartjs-2 | Easy setup, good animations, zoom/pan | Less customizable than D3/ECharts |
| **D3.js** | ISC | @types/d3 | Manual integration | Maximum flexibility, maps/geo support | Steep learning curve, verbose |
| **Highcharts** | Commercial | Built-in | Via highcharts-react | Enterprise-grade, comprehensive | Requires paid license for commercial use |

**For map visualizations** (if showing schools geographically):
- Leaflet (open source, lightweight) with react-leaflet
- Mapbox GL JS (free tier available, better styling)
- D3-geo for custom map projections

### 6. Data Volume Estimates

- California has approximately 2,500+ public high schools and 1,500+ private high schools
- With ~30 years of data, 9 UC campuses, and multiple ethnicity categories, the full dataset could be substantial (hundreds of thousands of rows)
- **Assumption:** For a static web page (no backend), pre-processed JSON data files or a SQLite-in-browser approach may be needed

---

## Constraints

### Data Access Constraints
1. **No public API exists** for UC admissions data. Data must be extracted from Tableau dashboards via crosstab export (CSV/Excel) or scraped/pre-processed.
2. **Tableau export limitations:** Crosstab downloads reflect currently applied filters, meaning multiple exports may be needed to capture all dimensions.
3. **Data freshness:** The UC Information Center is updated periodically (last update March 2026). There is no real-time feed.
4. **Data suppression:** Small cell sizes may be suppressed in official data for privacy (common in education data reporting).

### Legal/Licensing Constraints
5. **No explicit open data license** found on UC admissions data. The UC terms of use (https://admission.universityofcalifornia.edu/terms-of-use.html) prohibit commercial activity for personal financial gain on UCOP websites but do not specifically address third-party reuse of published statistics.
6. **Fact vs. expression:** Under U.S. copyright law, facts (data points) are generally not copyrightable, though specific expressions (tables, charts) may be. Reprocessing and re-presenting the underlying data in a new visualization is generally permissible. **This is an assumption, not legal advice.**
7. The UC name and branding should not be used in a way that implies endorsement.

### Technical Constraints
8. **Stack:** TypeScript with npm (per config.yaml). Frontend framework not yet specified.
9. **Static site preferred** (implied by "web page" in project description) -- no backend server mentioned.
10. **Browser compatibility:** Standard modern browsers (Chrome, Firefox, Safari, Edge). IE11 not assumed.

### Data Quality Constraints
11. **School name matching:** UC data uses school names that may not exactly match CDE directory names. Fuzzy matching or a manual mapping table may be required.
12. **Charter schools are classified as public** in the UC data, which may or may not match user expectations.

---

## Risks

### High Priority
1. **Data extraction difficulty** -- Extracting comprehensive multi-year, multi-campus, multi-dimension data from Tableau dashboards without an API is labor-intensive and fragile. If Tableau dashboard structure changes, the extraction process breaks.
   - *Mitigation:* Consider whether existing third-party datasets (e.g., from CollegeAcceptance.info or community-maintained datasets) are available, or invest in a robust one-time extraction with manual verification.

2. **Data completeness** -- Not all high schools may appear in the UC data (schools with zero applicants may be omitted). Private schools with very few applicants may have data suppressed.
   - *Mitigation:* Document data coverage limitations prominently in the UI.

### Medium Priority
3. **Data staleness** -- UC data is typically released with a 1-2 year lag (e.g., Fall 2024 final data released in 2025-2026). Users may expect current-year data.
   - *Mitigation:* Clearly display the data vintage and update cadence.

4. **Performance with large datasets** -- 30 years of data across 4,000+ schools, 9 campuses, and multiple demographics could produce a large client-side payload.
   - *Mitigation:* Lazy loading, data chunking, or pre-aggregation strategies.

5. **Acceptance rate calculation accuracy** -- The UC data provides applicant, admit, and enrollee counts but does not directly publish an "acceptance rate." Calculated rates (admits/applicants) are straightforward but should be clearly labeled as derived.
   - *Mitigation:* Show the calculation method transparently.

### Lower Priority
6. **Legal risk** -- While reuse of factual government data is generally permissible, the UC has not published an explicit open-data license for this dataset. Risk is low but non-zero.
   - *Mitigation:* Include clear data attribution. Avoid implying UC endorsement.

7. **Accessibility compliance** -- Data visualizations (charts, maps) are inherently challenging for screen readers.
   - *Mitigation:* Plan for WCAG 2.1 AA compliance from the start: alt text for charts, data tables as alternatives, keyboard navigation.

---

## Out of Scope

Based on the project description ("a web page that visualizes UC acceptance rate information for public and private high schools in California"), the following are explicitly out of scope:

1. **Non-UC systems** -- CSU, community college, or private university admissions data
2. **Transfer admissions** -- Focus is on freshman/first-year admissions only (unless the architect decides otherwise)
3. **Out-of-state and international schools** -- Focus is on California public and private high schools
4. **Individual student-level data** -- Only aggregated school-level statistics
5. **Admissions advice or predictions** -- This is a data visualization tool, not an admissions counselor
6. **Real-time data** -- Data will be updated periodically, not live
7. **User accounts or personalization** -- Static data visualization, no login
8. **Mobile app** -- Web page only (though should be responsive)
9. **Data collection or scraping infrastructure** -- The data pipeline for extracting UC data is a prerequisite but not part of the web visualization itself

---

## Open Questions

### For the Product Manager
1. **What is the primary user persona?** High school students/parents choosing where to apply? Educators comparing school performance? Journalists investigating equity? The visualization approach differs significantly by audience.
2. **What year range should be displayed?** The full 1994-2025 range or a more recent subset (e.g., last 5-10 years)?
3. **Should the comparison focus primarily on public vs. private, or should other dimensions (ethnicity, campus, GPA) be equally prominent?**
4. **Is a map view required?** Showing schools geographically adds significant complexity but may be high value.
5. **What is the data update strategy?** Manual periodic updates? Automated extraction from Tableau?
6. **Should charter schools be categorized as public (as UC does) or called out separately?**

### For the Architect
7. **Static site or server-rendered?** A purely static site (e.g., Vite + React) could work if data is pre-processed into JSON. A server would enable dynamic queries but adds deployment complexity.
8. **Data storage approach:** Pre-processed JSON files, SQLite in-browser (via sql.js), or IndexedDB for large datasets?
9. **Which visualization library?** Recharts for React-native simplicity, ECharts for power/variety, or D3 for maximum control? See the comparison table in Findings section 5.
10. **How should the data extraction/ETL pipeline be handled?** One-time manual download from Tableau, or an automated script?
11. **Should the project include the data extraction tooling** (scripts to download and process UC Tableau data) or assume pre-processed data as input?

### Unresolved Research Questions
12. **Can the full UC Information Center dataset be downloaded in bulk?** The Tableau crosstab export is filter-dependent, which may require dozens of individual downloads to capture all combinations. Need to verify whether the "Data download instructions" PDF referenced on the source school page provides a bulk download option.
13. **Do any community-maintained, pre-processed versions of this dataset exist** (e.g., on GitHub, Kaggle, or data.gov)?
14. **What is the exact schema of the Tableau crosstab export?** Column names, data types, and structure need to be documented from an actual export.
