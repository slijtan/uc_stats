# School Quality & Equity Analysis — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add CDE school quality metrics and a new Equity Analysis page to explore the relationship between school quality and UC admissions outcomes.

**Architecture:** Download CDE quality data (CCI, CAASPP, graduation/A-G, college-going, chronic absenteeism, suspension rates), parse into a SchoolQuality type, attach to school-index.json via pipeline. Build a new `/equity` page with interactive scatter plot, stat cards, school search/highlight, and quartile breakdown. Enrich existing School Detail and By College pages with quality metrics.

**Tech Stack:** React 19, TypeScript, Recharts (scatter chart), Vitest, CDE CSV/TXT files, Vite

---

### Task 1: Download CDE Data Files

**Files:**
- Create: `scripts/download/fetch-cde-quality.sh`
- Create: `raw-data/cde/cci/`, `raw-data/cde/caaspp/`, `raw-data/cde/acgr/`, `raw-data/cde/cgr/`, `raw-data/cde/chronic/`, `raw-data/cde/suspension/`

- [ ] **Step 1: Create download script**

```bash
#!/bin/bash
# scripts/download/fetch-cde-quality.sh
# Downloads CDE school quality data files
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RAW_DATA="${SCRIPT_DIR}/../../raw-data/cde"

echo "=== Downloading CDE Quality Data ==="

# CCI (College/Career Indicator)
mkdir -p "$RAW_DATA/cci"
echo "Downloading CCI data..."
curl -L -o "$RAW_DATA/cci/cci2324.xlsx" \
  "https://www3.cde.ca.gov/researchfiles/cadashboard/ccidatafile2024.xlsx"

# CAASPP Grade 11 Research File (statewide, all students)
mkdir -p "$RAW_DATA/caaspp"
echo "Downloading CAASPP data..."
curl -L -o "$RAW_DATA/caaspp/sb_ca2024_all.zip" \
  "https://caaspp-elpac.ets.org/caaspp/DashViewReportSB?ps=true&lstTestYear=2024&lstTestType=B&lstGroup=1&lstGrade=13&lstSchoolType=A&lstCounty=00&lstDistrict=00000&lstSchool=0000000&lstFocus=a"

# ACGR (Graduation + A-G Completion)
mkdir -p "$RAW_DATA/acgr"
echo "Downloading ACGR data..."
curl -L -o "$RAW_DATA/acgr/acgr2324.txt" \
  "https://www3.cde.ca.gov/demo-downloads/acgr/acgr24-v2.txt"

# College-Going Rate
mkdir -p "$RAW_DATA/cgr"
echo "Downloading College-Going Rate data..."
curl -L -o "$RAW_DATA/cgr/cgr2223.txt" \
  "https://www3.cde.ca.gov/demo-downloads/pse/cgr22.txt"

# Chronic Absenteeism
mkdir -p "$RAW_DATA/chronic"
echo "Downloading Chronic Absenteeism data..."
curl -L -o "$RAW_DATA/chronic/chronic2324.xlsx" \
  "https://www3.cde.ca.gov/researchfiles/cadashboard/chronicdatafile2024.xlsx"

# Suspension Rate
mkdir -p "$RAW_DATA/suspension"
echo "Downloading Suspension Rate data..."
curl -L -o "$RAW_DATA/suspension/suspension2324.xlsx" \
  "https://www3.cde.ca.gov/researchfiles/cadashboard/suspdatafile2024.xlsx"

echo "=== All downloads complete ==="
ls -la "$RAW_DATA/cci/" "$RAW_DATA/caaspp/" "$RAW_DATA/acgr/" "$RAW_DATA/cgr/" "$RAW_DATA/chronic/" "$RAW_DATA/suspension/"
```

- [ ] **Step 2: Run the download script**

Run: `chmod +x scripts/download/fetch-cde-quality.sh && bash scripts/download/fetch-cde-quality.sh`

Note: CDE URLs may have changed. If any download fails (404), manually find the correct URL by visiting:
- CCI: https://www.cde.ca.gov/ta/ac/cm/ccidatafiles.asp
- CAASPP: https://caaspp-elpac.ets.org/caaspp/ResearchFileListSB
- ACGR: https://www.cde.ca.gov/ds/ad/filesacgr.asp
- CGR: https://www.cde.ca.gov/ds/ad/pse.asp
- Chronic: https://www.cde.ca.gov/ta/ac/cm/chronicdatafiles.asp
- Suspension: https://www.cde.ca.gov/ta/ac/cm/suspdatafiles.asp

- [ ] **Step 3: Inspect downloaded files to understand format**

Run: `head -5 raw-data/cde/acgr/*.txt` and inspect XLSX files to understand column names and delimiters. Record the actual column names for use in the parser.

- [ ] **Step 4: Commit**

```bash
git add scripts/download/fetch-cde-quality.sh
git commit -m "feat: add CDE quality data download script"
```

---

### Task 2: Add SchoolQuality Type

**Files:**
- Modify: `src/types/index.ts`
- Test: `tests/pipeline/parse-cde-quality.test.ts` (created in Task 3)

- [ ] **Step 1: Add SchoolQuality interface to types**

Add to `src/types/index.ts` after the existing `School` interface (around line 52):

```typescript
export interface SchoolQuality {
  // CDE College/Career Indicator
  cci?: number;
  cciApproaching?: number;
  cciNotPrepared?: number;

  // CDE CAASPP Grade 11
  caasppEla?: number;
  caasppMath?: number;
  caasppElaPctMet?: number;
  caasppMathPctMet?: number;

  // CDE Graduation & A-G
  gradRate?: number;
  agRate?: number;
  dropoutRate?: number;

  // CDE College-Going Rate
  collegeGoingRate?: number;
  collegeGoingUC?: number;
  collegeGoingCSU?: number;

  // CDE Climate Indicators
  chronicAbsentRate?: number;
  suspensionRate?: number;

  // SchoolDigger (future)
  schoolDiggerRank?: number;
  schoolDiggerStars?: number;

  // Metadata
  dataYear?: number;
}
```

- [ ] **Step 2: Add quality field to School interface**

In the same file, add `quality?: SchoolQuality;` to the `School` interface after `grade12Enrollment`:

```typescript
export interface School {
  id: SchoolId;
  name: string;
  type: SchoolType;
  county: string;
  city: string;
  ucName: string;
  matched: boolean;
  matchMethod: "exact" | "normalized" | "fuzzy" | "override" | "unmatched";
  yearsAvailable: number[];
  grade12Enrollment: Record<string, number>;
  quality?: SchoolQuality;  // ← NEW
}
```

- [ ] **Step 3: Verify build passes**

Run: `npx tsc -b --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add SchoolQuality type and quality field to School interface"
```

---

### Task 3: Build CDE Quality Data Parser

**Files:**
- Create: `scripts/extract/parse-cde-quality.ts`
- Create: `tests/pipeline/parse-cde-quality.test.ts`

- [ ] **Step 1: Write tests for the CDE quality parser**

```typescript
// tests/pipeline/parse-cde-quality.test.ts
import { describe, it, expect } from "vitest";
import { parseCciFile, parseAcgrFile, parseCaasppFile, parseCgrFile, parseChronicFile, parseSuspensionFile, mergeCdeQuality } from "../../scripts/extract/parse-cde-quality";
import type { SchoolQuality } from "../../src/types";

describe("parseCdeQuality", () => {
  describe("mergeCdeQuality", () => {
    it("merges CCI, ACGR, and CAASPP data by CDS code", () => {
      const cci = new Map<string, Partial<SchoolQuality>>([
        ["01234567890123", { cci: 65.2, cciApproaching: 20.1, cciNotPrepared: 14.7 }],
      ]);
      const acgr = new Map<string, Partial<SchoolQuality>>([
        ["01234567890123", { gradRate: 92.5, agRate: 55.3, dropoutRate: 3.1 }],
      ]);
      const caaspp = new Map<string, Partial<SchoolQuality>>([
        ["01234567890123", { caasppEla: 25.4, caasppMath: -10.2, caasppElaPctMet: 62.0, caasppMathPctMet: 38.0 }],
      ]);
      const cgr = new Map<string, Partial<SchoolQuality>>();
      const chronic = new Map<string, Partial<SchoolQuality>>();
      const suspension = new Map<string, Partial<SchoolQuality>>();

      const result = mergeCdeQuality(cci, acgr, caaspp, cgr, chronic, suspension);
      const school = result.get("01234567890123");

      expect(school).toBeDefined();
      expect(school!.cci).toBe(65.2);
      expect(school!.gradRate).toBe(92.5);
      expect(school!.caasppEla).toBe(25.4);
    });

    it("handles schools with only partial data", () => {
      const cci = new Map<string, Partial<SchoolQuality>>([
        ["01234567890123", { cci: 50.0 }],
      ]);
      const result = mergeCdeQuality(cci, new Map(), new Map(), new Map(), new Map(), new Map());
      const school = result.get("01234567890123");

      expect(school).toBeDefined();
      expect(school!.cci).toBe(50.0);
      expect(school!.gradRate).toBeUndefined();
    });

    it("returns empty map when no data provided", () => {
      const result = mergeCdeQuality(new Map(), new Map(), new Map(), new Map(), new Map(), new Map());
      expect(result.size).toBe(0);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/pipeline/parse-cde-quality.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the CDE quality parser**

Create `scripts/extract/parse-cde-quality.ts`. This is a large file — the parser must handle each CDE file format. The actual column names depend on what was downloaded in Task 1. Inspect the files first, then implement parsers for each.

```typescript
// scripts/extract/parse-cde-quality.ts
import * as fs from "fs";
import * as path from "path";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import type { SchoolQuality } from "../src/types";

// ========== INDIVIDUAL FILE PARSERS ==========

/**
 * Parse CCI (College/Career Indicator) XLSX file.
 * CDE publishes this as Excel. We want school-level rows where
 * rtype = "S" (school level) and studentgroup = "ALL" (all students).
 */
export function parseCciFile(filePath: string): Map<string, Partial<SchoolQuality>> {
  const result = new Map<string, Partial<SchoolQuality>>();
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

  for (const row of rows) {
    // Filter: school-level, all students
    const rtype = String(row["rtype"] ?? row["Rtype"] ?? row["RTYPE"] ?? "");
    const group = String(row["studentgroup"] ?? row["StudentGroup"] ?? row["currstatus"] ?? "").toUpperCase();
    if (rtype.toUpperCase() !== "S") continue;
    if (group && group !== "ALL" && !group.includes("ALL")) continue;

    const cds = String(row["cds"] ?? row["CDS"] ?? row["CDSCode"] ?? row["cdscode"] ?? "").replace(/\D/g, "");
    if (cds.length < 14) continue;

    const prepared = parseFloat(String(row["currstatus"] ?? row["CurrStatus"] ?? row["report_rate_prepared"] ?? row["Prepared"] ?? ""));
    const approaching = parseFloat(String(row["currstatusapproaching"] ?? row["Approaching"] ?? row["report_rate_approaching"] ?? ""));
    const notPrepared = parseFloat(String(row["currstatusnotprepared"] ?? row["NotPrepared"] ?? row["report_rate_not_prepared"] ?? ""));

    if (isNaN(prepared)) continue;

    result.set(cds, {
      cci: prepared,
      cciApproaching: isNaN(approaching) ? undefined : approaching,
      cciNotPrepared: isNaN(notPrepared) ? undefined : notPrepared,
    });
  }
  return result;
}

/**
 * Parse ACGR (Adjusted Cohort Graduation Rate) TXT file.
 * Tab-delimited. Want: school-level, all students, most recent cohort.
 * Key columns: CDS_CODE, RATE (grad rate), UC_CSU_RATE or AG_RATE (A-G completion).
 */
export function parseAcgrFile(filePath: string): Map<string, Partial<SchoolQuality>> {
  const result = new Map<string, Partial<SchoolQuality>>();
  const content = fs.readFileSync(filePath, "utf-8");
  const rows = parse(content, {
    columns: true,
    delimiter: "\t",
    skip_empty_lines: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  for (const row of rows) {
    // Filter: school-level, all students/demographics
    const reportingCategory = (row["REPORTING_CATEGORY"] ?? row["reporting_category"] ?? "").toUpperCase();
    const aggregateLevel = (row["AGGREGATE_LEVEL"] ?? row["aggregate_level"] ?? "").toUpperCase();
    const charterYn = row["CHARTER_YN"] ?? row["charter_yn"] ?? "";

    // We want school-level (aggregateLevel "S" or "9") and all students (reportingCategory "TA" or blank)
    if (aggregateLevel !== "S" && aggregateLevel !== "9") {
      // Try alternative: check if there's a county/district/school code pattern
      const countyCode = row["COUNTY_CODE"] ?? row["county_code"] ?? "";
      const districtCode = row["DISTRICT_CODE"] ?? row["district_code"] ?? "";
      const schoolCode = row["SCHOOL_CODE"] ?? row["school_code"] ?? "";
      if (!schoolCode || schoolCode === "0000000") continue;
    }

    if (reportingCategory && reportingCategory !== "TA") continue;

    const cds = String(
      row["CDS_CODE"] ?? row["cds_code"] ??
      `${(row["COUNTY_CODE"] ?? "").padStart(2, "0")}${(row["DISTRICT_CODE"] ?? "").padStart(5, "0")}${(row["SCHOOL_CODE"] ?? "").padStart(7, "0")}`
    ).replace(/\D/g, "");
    if (cds.length < 14 || cds === "00000000000000") continue;

    const gradRate = parseFloat(row["REGULAR_HS_DIPLOMA_RATE_(PERCENT)"] ?? row["Regular HS Diploma Rate"] ?? row["RATE"] ?? "");
    const agRate = parseFloat(row["MET_UC_CSU_GRAD_RATE_(PERCENT)"] ?? row["Met UC/CSU Grad Rate"] ?? row["UC_CSU_RATE"] ?? "");
    const dropoutRate = parseFloat(row["DROPOUT_RATE_(PERCENT)"] ?? row["Dropout Rate"] ?? row["DROPOUT"] ?? "");

    if (isNaN(gradRate) && isNaN(agRate)) continue;

    result.set(cds, {
      gradRate: isNaN(gradRate) ? undefined : gradRate,
      agRate: isNaN(agRate) ? undefined : agRate,
      dropoutRate: isNaN(dropoutRate) ? undefined : dropoutRate,
    });
  }
  return result;
}

/**
 * Parse CAASPP research file (caret-delimited CSV).
 * We want grade 13 (grade "overall" or 11), school-level, all students.
 */
export function parseCaasppFile(filePath: string): Map<string, Partial<SchoolQuality>> {
  const result = new Map<string, Partial<SchoolQuality>>();
  const content = fs.readFileSync(filePath, "utf-8");
  const rows = parse(content, {
    columns: true,
    delimiter: "^",
    skip_empty_lines: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  for (const row of rows) {
    const gradeStr = row["Grade"] ?? row["grade"] ?? row["Test_Grade"] ?? "";
    const grade = parseInt(gradeStr, 10);
    // Grade 13 = "All Grades" in CAASPP, Grade 11 = 11th grade specifically
    // We prefer grade 11 for high schools
    if (grade !== 11 && grade !== 13) continue;

    const typeId = row["Type_Id"] ?? row["type_id"] ?? "";
    if (typeId !== "7" && typeId !== "09" && typeId !== "10") {
      // type_id 7 = school, 9 and 10 are also school-level
      // If no type_id, check school code
      const schoolCode = row["School_Code"] ?? row["school_code"] ?? "";
      if (!schoolCode || schoolCode === "0000000") continue;
    }

    const subgroup = row["Subgroup_ID"] ?? row["subgroup_id"] ?? row["Student_Group_ID"] ?? "";
    if (subgroup !== "1" && subgroup !== "001") continue; // 1 = All Students

    const testId = row["Test_Id"] ?? row["test_id"] ?? "";
    const countyCode = (row["County_Code"] ?? row["county_code"] ?? "").padStart(2, "0");
    const districtCode = (row["District_Code"] ?? row["district_code"] ?? "").padStart(5, "0");
    const schoolCode = (row["School_Code"] ?? row["school_code"] ?? "").padStart(7, "0");
    const cds = `${countyCode}${districtCode}${schoolCode}`;
    if (cds.length < 14 || cds === "00000000000000") continue;

    const meanDfs = parseFloat(row["Mean_Scale_Score"] ?? "");
    const pctMet = parseFloat(row["Percentage_Standard_Met_and_Above"] ?? row["Pctg_Met_Exceeded"] ?? "");

    // testId 1 = ELA, testId 2 = Math (in CAASPP schema)
    const existing = result.get(cds) ?? {};
    if (testId === "1") {
      existing.caasppEla = isNaN(meanDfs) ? undefined : meanDfs;
      existing.caasppElaPctMet = isNaN(pctMet) ? undefined : pctMet;
    } else if (testId === "2") {
      existing.caasppMath = isNaN(meanDfs) ? undefined : meanDfs;
      existing.caasppMathPctMet = isNaN(pctMet) ? undefined : pctMet;
    }
    result.set(cds, existing);
  }
  return result;
}

/**
 * Parse College-Going Rate (CGR) TXT file.
 * Tab-delimited. School-level, all students.
 */
export function parseCgrFile(filePath: string): Map<string, Partial<SchoolQuality>> {
  const result = new Map<string, Partial<SchoolQuality>>();
  if (!fs.existsSync(filePath)) return result;

  const content = fs.readFileSync(filePath, "utf-8");
  const rows = parse(content, {
    columns: true,
    delimiter: "\t",
    skip_empty_lines: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  for (const row of rows) {
    const aggregateLevel = (row["AggregateLevel"] ?? row["AGGREGATE_LEVEL"] ?? row["aggregate_level"] ?? "").toUpperCase();
    if (aggregateLevel !== "S" && aggregateLevel !== "SCH") {
      const schoolCode = row["SchoolCode"] ?? row["SCHOOL_CODE"] ?? "";
      if (!schoolCode || schoolCode === "0000000") continue;
    }

    const reportingCategory = (row["ReportingCategory"] ?? row["REPORTING_CATEGORY"] ?? "").toUpperCase();
    if (reportingCategory && reportingCategory !== "TA") continue;

    const cds = String(
      row["CDSCode"] ?? row["CDS_CODE"] ??
      `${(row["CountyCode"] ?? "").padStart(2, "0")}${(row["DistrictCode"] ?? "").padStart(5, "0")}${(row["SchoolCode"] ?? "").padStart(7, "0")}`
    ).replace(/\D/g, "");
    if (cds.length < 14) continue;

    const totalRate = parseFloat(row["CollegeGoingRate16Mos"] ?? row["CGR_16MO"] ?? row["Total16MoRate"] ?? "");
    const ucRate = parseFloat(row["UCRate"] ?? row["UC_RATE"] ?? "");
    const csuRate = parseFloat(row["CSURate"] ?? row["CSU_RATE"] ?? "");

    if (isNaN(totalRate)) continue;

    result.set(cds, {
      collegeGoingRate: totalRate,
      collegeGoingUC: isNaN(ucRate) ? undefined : ucRate,
      collegeGoingCSU: isNaN(csuRate) ? undefined : csuRate,
    });
  }
  return result;
}

/**
 * Parse Chronic Absenteeism XLSX file from CA Dashboard.
 * School-level, all students.
 */
export function parseChronicFile(filePath: string): Map<string, Partial<SchoolQuality>> {
  const result = new Map<string, Partial<SchoolQuality>>();
  if (!fs.existsSync(filePath)) return result;

  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

  for (const row of rows) {
    const rtype = String(row["rtype"] ?? row["Rtype"] ?? row["RTYPE"] ?? "").toUpperCase();
    if (rtype !== "S") continue;

    const group = String(row["studentgroup"] ?? row["StudentGroup"] ?? "").toUpperCase();
    if (group && group !== "ALL") continue;

    const cds = String(row["cds"] ?? row["CDS"] ?? row["CDSCode"] ?? "").replace(/\D/g, "");
    if (cds.length < 14) continue;

    const rate = parseFloat(String(row["currstatus"] ?? row["CurrStatus"] ?? row["chronicrate"] ?? ""));
    if (isNaN(rate)) continue;

    result.set(cds, { chronicAbsentRate: rate });
  }
  return result;
}

/**
 * Parse Suspension Rate XLSX file from CA Dashboard.
 * School-level, all students.
 */
export function parseSuspensionFile(filePath: string): Map<string, Partial<SchoolQuality>> {
  const result = new Map<string, Partial<SchoolQuality>>();
  if (!fs.existsSync(filePath)) return result;

  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

  for (const row of rows) {
    const rtype = String(row["rtype"] ?? row["Rtype"] ?? row["RTYPE"] ?? "").toUpperCase();
    if (rtype !== "S") continue;

    const group = String(row["studentgroup"] ?? row["StudentGroup"] ?? "").toUpperCase();
    if (group && group !== "ALL") continue;

    const cds = String(row["cds"] ?? row["CDS"] ?? row["CDSCode"] ?? "").replace(/\D/g, "");
    if (cds.length < 14) continue;

    const rate = parseFloat(String(row["currstatus"] ?? row["CurrStatus"] ?? row["susprate"] ?? ""));
    if (isNaN(rate)) continue;

    result.set(cds, { suspensionRate: rate });
  }
  return result;
}

// ========== MERGE ==========

/**
 * Merge all CDE quality data sources into a single map by CDS code.
 */
export function mergeCdeQuality(
  cci: Map<string, Partial<SchoolQuality>>,
  acgr: Map<string, Partial<SchoolQuality>>,
  caaspp: Map<string, Partial<SchoolQuality>>,
  cgr: Map<string, Partial<SchoolQuality>>,
  chronic: Map<string, Partial<SchoolQuality>>,
  suspension: Map<string, Partial<SchoolQuality>>,
): Map<string, SchoolQuality> {
  const allCds = new Set<string>();
  [cci, acgr, caaspp, cgr, chronic, suspension].forEach(m => m.forEach((_, k) => allCds.add(k)));

  const result = new Map<string, SchoolQuality>();
  for (const cds of allCds) {
    const merged: SchoolQuality = {
      ...cci.get(cds),
      ...acgr.get(cds),
      ...caaspp.get(cds),
      ...cgr.get(cds),
      ...chronic.get(cds),
      ...suspension.get(cds),
    };
    result.set(cds, merged);
  }
  return result;
}

// ========== DIRECTORY LOADER ==========

/**
 * Load all CDE quality data from a directory structure.
 * Expects: cdeDir/cci/, cdeDir/caaspp/, cdeDir/acgr/, cdeDir/cgr/, cdeDir/chronic/, cdeDir/suspension/
 */
export function loadCdeQualityData(cdeDir: string): Map<string, SchoolQuality> {
  const findFile = (subdir: string, extensions: string[]): string | null => {
    const dir = path.join(cdeDir, subdir);
    if (!fs.existsSync(dir)) return null;
    const files = fs.readdirSync(dir).filter(f => extensions.some(ext => f.endsWith(ext)));
    // Sort by name descending to get most recent year first
    files.sort((a, b) => b.localeCompare(a));
    return files.length > 0 ? path.join(dir, files[0]) : null;
  };

  const cciFile = findFile("cci", [".xlsx", ".xls"]);
  const caasppFile = findFile("caaspp", [".txt", ".csv"]);
  const acgrFile = findFile("acgr", [".txt"]);
  const cgrFile = findFile("cgr", [".txt"]);
  const chronicFile = findFile("chronic", [".xlsx", ".xls"]);
  const suspensionFile = findFile("suspension", [".xlsx", ".xls"]);

  console.log("CDE Quality Data files found:");
  console.log(`  CCI: ${cciFile ?? "NOT FOUND"}`);
  console.log(`  CAASPP: ${caasppFile ?? "NOT FOUND"}`);
  console.log(`  ACGR: ${acgrFile ?? "NOT FOUND"}`);
  console.log(`  CGR: ${cgrFile ?? "NOT FOUND"}`);
  console.log(`  Chronic: ${chronicFile ?? "NOT FOUND"}`);
  console.log(`  Suspension: ${suspensionFile ?? "NOT FOUND"}`);

  const cci = cciFile ? parseCciFile(cciFile) : new Map();
  const caaspp = caasppFile ? parseCaasppFile(caasppFile) : new Map();
  const acgr = acgrFile ? parseAcgrFile(acgrFile) : new Map();
  const cgr = cgrFile ? parseCgrFile(cgrFile) : new Map();
  const chronic = chronicFile ? parseChronicFile(chronicFile) : new Map();
  const suspension = suspensionFile ? parseSuspensionFile(suspensionFile) : new Map();

  console.log(`  CCI schools: ${cci.size}`);
  console.log(`  CAASPP schools: ${caaspp.size}`);
  console.log(`  ACGR schools: ${acgr.size}`);
  console.log(`  CGR schools: ${cgr.size}`);
  console.log(`  Chronic schools: ${chronic.size}`);
  console.log(`  Suspension schools: ${suspension.size}`);

  return mergeCdeQuality(cci, acgr, caaspp, cgr, chronic, suspension);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/pipeline/parse-cde-quality.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/extract/parse-cde-quality.ts tests/pipeline/parse-cde-quality.test.ts
git commit -m "feat: add CDE quality data parser with tests"
```

---

### Task 4: Integrate Quality Data into Pipeline

**Files:**
- Modify: `scripts/pipeline.ts`
- Modify: `scripts/transform/generate-json.ts`

- [ ] **Step 1: Import and call quality data loader in pipeline.ts**

In `scripts/pipeline.ts`, after the normalize stage and before compute-metrics:

```typescript
import { loadCdeQualityData } from "./extract/parse-cde-quality";
```

Add a new stage between normalize and compute:

```typescript
// Stage 2.5: Enrich with CDE quality data
console.log("\n=== Stage 2.5: Enriching with CDE Quality Data ===");
const qualityMap = loadCdeQualityData(options.cdeDir);
console.log(`Quality data loaded for ${qualityMap.size} schools`);
```

Pass `qualityMap` to `generateJsonFiles`.

- [ ] **Step 2: Modify generate-json.ts to include quality in school-index.json**

In `scripts/transform/generate-json.ts`, modify the `buildSchoolIndex` function to accept a quality map parameter and attach quality data to each school:

```typescript
export function buildSchoolIndex(
  records: ComputedRecord[],
  qualityMap?: Map<string, SchoolQuality>,
): SchoolIndex {
  // ... existing school deduplication logic ...

  // After building the school object, attach quality:
  if (qualityMap) {
    const quality = qualityMap.get(school.id);
    if (quality) {
      school.quality = quality;
    }
  }

  // ... rest of existing logic ...
}
```

Update `generateJsonFiles` signature to accept and pass through the quality map.

- [ ] **Step 3: Run pipeline to verify it works**

Run: `npx tsx scripts/pipeline.ts --input ./raw-data --output ./public/data --cde-dir ./raw-data/cde --report-dir ./reports`

Verify: `school-index.json` now contains `quality` fields on schools. Check with:
`node -e "const d = require('./public/data/school-index.json'); const withQ = d.schools.filter(s => s.quality); console.log(withQ.length + '/' + d.totalSchools + ' schools have quality data')"`

- [ ] **Step 4: Run existing tests to ensure nothing broke**

Run: `npm test`
Expected: All existing tests PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/pipeline.ts scripts/transform/generate-json.ts
git commit -m "feat: integrate CDE quality data into pipeline and school-index.json"
```

---

### Task 5: Build Statistics Utility

**Files:**
- Create: `src/services/statsService.ts`
- Create: `tests/pipeline/stats-service.test.ts`

- [ ] **Step 1: Write tests for statistics computation**

```typescript
// tests/pipeline/stats-service.test.ts
import { describe, it, expect } from "vitest";
import { computeCorrelation, computeQuartileStats, computeLinearRegression } from "../../src/services/statsService";

describe("statsService", () => {
  const points = [
    { x: 10, y: 5 },
    { x: 20, y: 10 },
    { x: 30, y: 15 },
    { x: 40, y: 20 },
    { x: 50, y: 25 },
    { x: 60, y: 30 },
    { x: 70, y: 35 },
    { x: 80, y: 40 },
  ];

  describe("computeCorrelation", () => {
    it("returns 1.0 for perfect positive correlation", () => {
      const { r, r2 } = computeCorrelation(points);
      expect(r).toBeCloseTo(1.0, 5);
      expect(r2).toBeCloseTo(1.0, 5);
    });

    it("returns 0 for empty input", () => {
      const { r } = computeCorrelation([]);
      expect(r).toBe(0);
    });

    it("classifies correlation strength correctly", () => {
      const { label } = computeCorrelation(points);
      expect(label).toBe("Strong positive");
    });
  });

  describe("computeQuartileStats", () => {
    it("computes average Y per quartile", () => {
      const quartiles = computeQuartileStats(points);
      expect(quartiles).toHaveLength(4);
      expect(quartiles[0].avgY).toBeCloseTo(7.5, 1); // bottom 25%: avg of 5, 10
      expect(quartiles[3].avgY).toBeCloseTo(37.5, 1); // top 25%: avg of 35, 40
    });

    it("computes equity gap", () => {
      const quartiles = computeQuartileStats(points);
      const gap = quartiles[3].avgY / quartiles[0].avgY;
      expect(gap).toBeCloseTo(5.0, 1);
    });
  });

  describe("computeLinearRegression", () => {
    it("returns slope and intercept for perfect line", () => {
      const { slope, intercept } = computeLinearRegression(points);
      expect(slope).toBeCloseTo(0.5, 5);
      expect(intercept).toBeCloseTo(0, 5);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/pipeline/stats-service.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement stats service**

```typescript
// src/services/statsService.ts

export interface Point {
  x: number;
  y: number;
}

export interface CorrelationResult {
  r: number;
  r2: number;
  label: string;
}

export interface QuartileResult {
  label: string;
  avgY: number;
  count: number;
  minX: number;
  maxX: number;
}

export interface RegressionResult {
  slope: number;
  intercept: number;
}

export function computeCorrelation(points: Point[]): CorrelationResult {
  if (points.length < 3) return { r: 0, r2: 0, label: "Insufficient data" };

  const n = points.length;
  const mx = points.reduce((a, p) => a + p.x, 0) / n;
  const my = points.reduce((a, p) => a + p.y, 0) / n;
  let sxx = 0, syy = 0, sxy = 0;
  for (const p of points) {
    sxx += (p.x - mx) ** 2;
    syy += (p.y - my) ** 2;
    sxy += (p.x - mx) * (p.y - my);
  }
  const r = sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0;
  const r2 = r * r;

  const absR = Math.abs(r);
  const direction = r >= 0 ? "positive" : "negative";
  let label: string;
  if (absR > 0.7) label = `Strong ${direction}`;
  else if (absR > 0.4) label = `Moderate ${direction}`;
  else if (absR > 0.2) label = `Weak ${direction}`;
  else label = "No correlation";

  return { r, r2, label };
}

export function computeQuartileStats(points: Point[]): QuartileResult[] {
  if (points.length < 4) return [];

  const sorted = [...points].sort((a, b) => a.x - b.x);
  const n = sorted.length;
  const labels = ["Bottom 25%", "25th–50th", "50th–75th", "Top 25%"];

  return [0, 1, 2, 3].map((q) => {
    const start = Math.floor((n * q) / 4);
    const end = Math.floor((n * (q + 1)) / 4);
    const slice = sorted.slice(start, end);
    const avgY = slice.reduce((a, p) => a + p.y, 0) / slice.length;
    return {
      label: labels[q],
      avgY,
      count: slice.length,
      minX: slice[0]?.x ?? 0,
      maxX: slice[slice.length - 1]?.x ?? 0,
    };
  });
}

export function computeLinearRegression(points: Point[]): RegressionResult {
  if (points.length < 2) return { slope: 0, intercept: 0 };

  const n = points.length;
  const mx = points.reduce((a, p) => a + p.x, 0) / n;
  const my = points.reduce((a, p) => a + p.y, 0) / n;
  let sxx = 0, sxy = 0;
  for (const p of points) {
    sxx += (p.x - mx) ** 2;
    sxy += (p.x - mx) * (p.y - my);
  }
  const slope = sxx > 0 ? sxy / sxx : 0;
  const intercept = my - slope * mx;
  return { slope, intercept };
}

export function computeEquityGap(points: Point[]): { gap: number; label: string } {
  const quartiles = computeQuartileStats(points);
  if (quartiles.length < 4 || quartiles[0].avgY === 0) return { gap: 0, label: "—" };
  const gap = quartiles[3].avgY / quartiles[0].avgY;

  let label: string;
  if (gap > 2.0) label = "superlinear — advantage compounds significantly";
  else if (gap > 1.3) label = "moderately superlinear — higher-quality schools have a disproportionate edge";
  else if (gap > 0.8) label = "roughly proportional — school quality tracks linearly with admissions";
  else label = "sublinear — lower-ranked schools may receive an equity boost";

  return { gap, label };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/pipeline/stats-service.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/statsService.ts tests/pipeline/stats-service.test.ts
git commit -m "feat: add statistics service for correlation, quartiles, and regression"
```

---

### Task 6: Build Equity Analysis Page

**Files:**
- Create: `src/pages/EquityAnalysisPage.tsx`
- Modify: `src/App.tsx` (add route)
- Modify: `src/components/layout/Header.tsx` (add nav link)

This is the largest task. Build the full equity analysis page with:
- Controls (X-axis, Y-axis, campus, year, school search)
- Scatter plot using Recharts
- Stat cards (Correlation, Equity Gap, R², School Count)
- School highlight (search + click)
- Insight sentence
- Quartile breakdown

- [ ] **Step 1: Create the EquityAnalysisPage component**

Create `src/pages/EquityAnalysisPage.tsx` following the prototype structure. The page should:

1. Load school index and campus data via `dataService`
2. Compute scatter plot points from school quality data (X-axis) and admission records (Y-axis)
3. Use Recharts `ScatterChart` with multiple datasets (public/private/selected)
4. Render stat cards, insight text, and quartile bars
5. Include school search typeahead with keyboard navigation
6. Support clicking dots to select schools

Key implementation notes:
- Use `useMemo` for expensive computations (point generation, stats, quartiles)
- Use existing `CampusMultiSelect` pattern for campus selector (but single-select here)
- Import `computeCorrelation`, `computeQuartileStats`, `computeLinearRegression`, `computeEquityGap` from `statsService`
- Recharts scatter: use `<ScatterChart>` with `<Scatter>` components, custom `<Cell>` for per-dot colors
- For trend line: use `<ReferenceLine>` or a separate `<Line>` dataset
- For tooltip: use Recharts custom `<Tooltip>` component (follow TrendLine.tsx pattern)
- Match the dark theme from the prototype using CSS variables

- [ ] **Step 2: Add route to App.tsx**

Add to `src/App.tsx`:
```typescript
import { EquityAnalysisPage } from "./pages/EquityAnalysisPage";

// In Routes:
<Route path="/equity" element={<EquityAnalysisPage />} />
```

- [ ] **Step 3: Add nav link to Header.tsx**

Add to `src/components/layout/Header.tsx` navigation links:
```typescript
<NavLink to="/equity" className={({isActive}) => isActive ? 'active' : ''} onClick={closeMenu}>
  Equity Analysis
</NavLink>
```

- [ ] **Step 4: Verify the page loads in browser**

Run: `npm run dev`
Navigate to: `http://localhost:5173/#/equity`
Expected: Page renders with scatter plot, controls, stat cards

- [ ] **Step 5: Commit**

```bash
git add src/pages/EquityAnalysisPage.tsx src/App.tsx src/components/layout/Header.tsx
git commit -m "feat: add Equity Analysis page with scatter plot, stats, and school search"
```

---

### Task 7: Add School Quality Section to School Detail Page

**Files:**
- Modify: `src/pages/SchoolDetailPage.tsx`

- [ ] **Step 1: Add quality metrics card grid to SchoolDetailPage**

After the school header section and before the campus metrics, add a "School Quality" section. Render a grid of metric cards showing CCI, CAASPP ELA/Math, grad rate, A-G rate, college-going rate, chronic absenteeism, and suspension rate.

For private schools or schools without quality data, show a muted info message: "No state performance data available for private schools."

Pattern: use a simple flex/grid of cards, each showing the metric name, value, and an optional color indicator.

```typescript
// Inside SchoolDetailPage, after header section:
{school && (
  <section className="quality-section">
    <h2>School Quality Metrics</h2>
    {school.quality ? (
      <div className="quality-grid">
        {school.quality.cci != null && (
          <div className="quality-card">
            <div className="quality-label">CCI % Prepared</div>
            <div className="quality-value">{school.quality.cci.toFixed(1)}%</div>
          </div>
        )}
        {/* ... similar cards for each metric ... */}
      </div>
    ) : (
      <p className="no-data-message">
        {school.type === "private"
          ? "No state performance data available for private schools."
          : "No quality data available for this school."}
      </p>
    )}
  </section>
)}
```

- [ ] **Step 2: Add CSS for quality section**

Add styles to `src/styles/global.css` for `.quality-section`, `.quality-grid`, `.quality-card`, `.quality-label`, `.quality-value`, `.no-data-message`.

- [ ] **Step 3: Verify in browser**

Navigate to a school detail page (e.g., `http://localhost:5173/#/school/19647331930791`).
Expected: Quality metrics section visible with data.

- [ ] **Step 4: Commit**

```bash
git add src/pages/SchoolDetailPage.tsx src/styles/global.css
git commit -m "feat: add school quality metrics section to school detail page"
```

---

### Task 8: Add Quality Columns and Filter to By College Page

**Files:**
- Modify: `src/pages/ByCollegePage.tsx`

- [ ] **Step 1: Add CCI column to the table**

Add a "CCI" column to the desktop table and mobile cards in `ByCollegePage.tsx`. Display `school.quality?.cci?.toFixed(1)` with "—" fallback for missing data. Make it sortable.

- [ ] **Step 2: Add quality tier filter**

Add a new filter dropdown: "Quality Tier" with options: All, Top 25%, Top 50%, Bottom 50%, Bottom 25%. Filter is based on CCI value — compute quartile thresholds from the full school list, then filter.

- [ ] **Step 3: Verify in browser**

Navigate to By College page. Verify CCI column shows, sorting works, and quality tier filter narrows results.

- [ ] **Step 4: Commit**

```bash
git add src/pages/ByCollegePage.tsx
git commit -m "feat: add CCI column and quality tier filter to By College page"
```

---

### Task 9: Final Integration Testing and Polish

**Files:**
- Various existing files

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Run pipeline end-to-end**

Run: `npx tsx scripts/pipeline.ts --input ./raw-data --output ./public/data --cde-dir ./raw-data/cde --report-dir ./reports`
Expected: Pipeline completes, quality data attached to schools

- [ ] **Step 4: Manual smoke test**

Test all pages in browser:
- `/` (By College) — CCI column shows, quality tier filter works
- `/equity` — scatter plot renders, controls work, school search highlights, quartile breakdown shows
- `/school/{id}` — quality metrics section shows for public schools, "no data" for private
- Verify no console errors

- [ ] **Step 5: Commit any polish fixes**

```bash
git add -A
git commit -m "fix: polish equity analysis feature and fix integration issues"
```
