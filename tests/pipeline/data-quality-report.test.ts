import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  findSuppressedRecords,
  analyzeUnmatchedSchools,
  analyzeCampusCoverage,
  generateDataQualityReport,
  formatMarkdownReport,
  writeReport,
} from "../../scripts/validate/data-quality-report.ts";
import type { ComputedRecord } from "../../scripts/transform/compute-metrics.ts";
import type { MatchStats } from "../../scripts/transform/normalize-schools.ts";

// ---------------------------------------------------------------------------
// Helper factories
// ---------------------------------------------------------------------------

function makeComputedRecord(
  overrides: Partial<ComputedRecord> = {},
): ComputedRecord {
  return {
    school: "Lincoln High School",
    ucName: "Lincoln High School",
    campus: "berkeley",
    year: 2024,
    applicants: 100,
    admits: 50,
    enrollees: 20,
    gpaApplicants: 3.85,
    gpaAdmits: 4.10,
    gpaEnrollees: 4.15,
    schoolId: "001",
    schoolType: "public",
    county: "San Francisco",
    city: "San Francisco",
    matched: true,
    matchMethod: "exact",
    acceptanceRate: 0.5,
    grade12Enrollment: null,
    ...overrides,
  };
}

function makeMatchStats(overrides: Partial<MatchStats> = {}): MatchStats {
  return {
    totalUniqueSchools: 5,
    exactMatches: 3,
    normalizedMatches: 1,
    fuzzyMatches: 0,
    overrideMatches: 0,
    unmatched: 1,
    matchRate: 0.8,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// findSuppressedRecords
// ---------------------------------------------------------------------------

describe("findSuppressedRecords", () => {
  it("returns empty array when no records have null fields", () => {
    const records = [makeComputedRecord()];
    const { suppressed, totalCount } = findSuppressedRecords(records);
    expect(suppressed).toHaveLength(0);
    expect(totalCount).toBe(0);
  });

  it("identifies records with null applicants", () => {
    const records = [makeComputedRecord({ applicants: null })];
    const { suppressed } = findSuppressedRecords(records);
    expect(suppressed).toHaveLength(1);
    expect(suppressed[0]!.suppressedFields).toContain("applicants");
  });

  it("identifies records with multiple null fields", () => {
    const records = [
      makeComputedRecord({
        applicants: null,
        admits: null,
        gpaApplicants: null,
      }),
    ];
    const { suppressed } = findSuppressedRecords(records);
    expect(suppressed).toHaveLength(1);
    expect(suppressed[0]!.suppressedFields).toHaveLength(3);
    expect(suppressed[0]!.suppressedFields).toContain("applicants");
    expect(suppressed[0]!.suppressedFields).toContain("admits");
    expect(suppressed[0]!.suppressedFields).toContain("gpaApplicants");
  });

  it("includes school and campus info in suppressed record", () => {
    const records = [
      makeComputedRecord({
        schoolId: "001",
        school: "Lincoln High",
        campus: "berkeley",
        year: 2024,
        admits: null,
      }),
    ];
    const { suppressed } = findSuppressedRecords(records);
    expect(suppressed[0]!.schoolId).toBe("001");
    expect(suppressed[0]!.schoolName).toBe("Lincoln High");
    expect(suppressed[0]!.campus).toBe("berkeley");
    expect(suppressed[0]!.year).toBe(2024);
  });

  it("counts only records with at least one null field", () => {
    const records = [
      makeComputedRecord({ admits: null }),
      makeComputedRecord({ school: "Another School" }), // no nulls
      makeComputedRecord({ gpaEnrollees: null }),
    ];
    const { suppressed, totalCount } = findSuppressedRecords(records);
    expect(suppressed).toHaveLength(2);
    expect(totalCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// analyzeUnmatchedSchools
// ---------------------------------------------------------------------------

describe("analyzeUnmatchedSchools", () => {
  it("returns empty array when all schools are matched", () => {
    const records = [makeComputedRecord({ matched: true })];
    const result = analyzeUnmatchedSchools(records);
    expect(result).toHaveLength(0);
  });

  it("identifies unmatched schools", () => {
    const records = [
      makeComputedRecord({
        schoolId: "unmatched-1",
        ucName: "Unknown School",
        matched: false,
      }),
    ];
    const result = analyzeUnmatchedSchools(records);
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("Unknown School");
  });

  it("counts records per unmatched school", () => {
    const records = [
      makeComputedRecord({
        schoolId: "unmatched-1",
        ucName: "Unknown School",
        matched: false,
        year: 2022,
      }),
      makeComputedRecord({
        schoolId: "unmatched-1",
        ucName: "Unknown School",
        matched: false,
        year: 2023,
      }),
      makeComputedRecord({
        schoolId: "unmatched-1",
        ucName: "Unknown School",
        matched: false,
        year: 2024,
      }),
    ];
    const result = analyzeUnmatchedSchools(records);
    expect(result).toHaveLength(1);
    expect(result[0]!.recordCount).toBe(3);
  });

  it("sorts by record count descending", () => {
    const records = [
      makeComputedRecord({
        schoolId: "unmatched-1",
        ucName: "School A",
        matched: false,
      }),
      makeComputedRecord({
        schoolId: "unmatched-2",
        ucName: "School B",
        matched: false,
      }),
      makeComputedRecord({
        schoolId: "unmatched-2",
        ucName: "School B",
        matched: false,
        year: 2023,
      }),
    ];
    const result = analyzeUnmatchedSchools(records);
    expect(result[0]!.name).toBe("School B");
    expect(result[0]!.recordCount).toBe(2);
    expect(result[1]!.name).toBe("School A");
    expect(result[1]!.recordCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// analyzeCampusCoverage
// ---------------------------------------------------------------------------

describe("analyzeCampusCoverage", () => {
  it("identifies years present per campus", () => {
    const records = [
      makeComputedRecord({ campus: "berkeley", year: 2022 }),
      makeComputedRecord({ campus: "berkeley", year: 2023 }),
      makeComputedRecord({ campus: "berkeley", year: 2024 }),
    ];

    const result = analyzeCampusCoverage(records);
    const berkeley = result.find((c) => c.campus === "berkeley");
    expect(berkeley).toBeDefined();
    expect(berkeley!.yearsPresent).toEqual([2022, 2023, 2024]);
  });

  it("identifies missing years when expected years provided", () => {
    const records = [
      makeComputedRecord({ campus: "berkeley", year: 2022 }),
      makeComputedRecord({ campus: "berkeley", year: 2024 }),
    ];

    const result = analyzeCampusCoverage(records, [2022, 2023, 2024]);
    const berkeley = result.find((c) => c.campus === "berkeley");
    expect(berkeley!.yearsMissing).toEqual([2023]);
  });

  it("counts records per campus", () => {
    const records = [
      makeComputedRecord({ campus: "berkeley" }),
      makeComputedRecord({ campus: "berkeley", schoolId: "002" }),
      makeComputedRecord({ campus: "davis" }),
    ];

    const result = analyzeCampusCoverage(records);
    const berkeley = result.find((c) => c.campus === "berkeley");
    expect(berkeley!.recordCount).toBe(2);
  });

  it("sorts results alphabetically by campus", () => {
    const records = [
      makeComputedRecord({ campus: "davis" }),
      makeComputedRecord({ campus: "berkeley" }),
    ];

    const result = analyzeCampusCoverage(records);
    expect(result[0]!.campus).toBe("berkeley");
    expect(result[1]!.campus).toBe("davis");
  });
});

// ---------------------------------------------------------------------------
// generateDataQualityReport (integration)
// ---------------------------------------------------------------------------

describe("generateDataQualityReport", () => {
  it("generates a complete quality report", () => {
    const records = [
      makeComputedRecord({ matched: true }),
      makeComputedRecord({ matched: false, schoolId: "unmatched-1", ucName: "Unknown" }),
    ];
    const matchStats = makeMatchStats();

    const report = generateDataQualityReport(records, matchStats);

    expect(report.generatedAt).toBeDefined();
    expect(report.matchStats).toBe(matchStats);
    expect(report.overall.totalRecords).toBe(2);
    expect(report.overall.totalSchools).toBe(2);
  });

  it("reports correct suppression rate", () => {
    const records = [
      makeComputedRecord({ applicants: null }),
      makeComputedRecord({}),
      makeComputedRecord({}),
      makeComputedRecord({}),
    ];
    const report = generateDataQualityReport(records, makeMatchStats());
    expect(report.overall.suppressionRate).toBeCloseTo(0.25);
  });

  it("flags when match rate fails threshold", () => {
    const lowMatchStats = makeMatchStats({ matchRate: 0.7 });
    const report = generateDataQualityReport([], lowMatchStats);
    expect(report.overall.matchRatePassesThreshold).toBe(false);
  });

  it("passes threshold when match rate >= 90%", () => {
    const highMatchStats = makeMatchStats({ matchRate: 0.95 });
    const report = generateDataQualityReport([], highMatchStats);
    expect(report.overall.matchRatePassesThreshold).toBe(true);
  });

  it("computes coverage percentage", () => {
    const records = [
      makeComputedRecord({ campus: "berkeley", year: 2023 }),
      makeComputedRecord({ campus: "berkeley", year: 2024 }),
      makeComputedRecord({ campus: "davis", year: 2024 }),
      // Missing: davis 2023
    ];
    const report = generateDataQualityReport(records, makeMatchStats());
    // 3 actual combinations out of 4 possible (2 campuses x 2 years)
    expect(report.overall.coveragePercentage).toBeCloseTo(0.75);
  });
});

// ---------------------------------------------------------------------------
// formatMarkdownReport
// ---------------------------------------------------------------------------

describe("formatMarkdownReport", () => {
  it("includes report title", () => {
    const report = generateDataQualityReport([], makeMatchStats());
    const markdown = formatMarkdownReport(report);
    expect(markdown).toContain("# Data Quality Report");
  });

  it("includes match statistics section", () => {
    const report = generateDataQualityReport([], makeMatchStats());
    const markdown = formatMarkdownReport(report);
    expect(markdown).toContain("## School Name Matching");
    expect(markdown).toContain("Exact matches");
  });

  it("includes unmatched schools section when present", () => {
    const records = [
      makeComputedRecord({
        matched: false,
        schoolId: "unmatched-1",
        ucName: "Unknown School",
      }),
    ];
    const report = generateDataQualityReport(records, makeMatchStats());
    const markdown = formatMarkdownReport(report);
    expect(markdown).toContain("## Unmatched Schools");
    expect(markdown).toContain("Unknown School");
  });

  it("includes overall statistics", () => {
    const report = generateDataQualityReport(
      [makeComputedRecord()],
      makeMatchStats(),
    );
    const markdown = formatMarkdownReport(report);
    expect(markdown).toContain("## Overall Statistics");
    expect(markdown).toContain("Total records");
  });

  it("includes PASS/FAIL indicator for match rate", () => {
    const passingStats = makeMatchStats({ matchRate: 0.95 });
    const passingReport = generateDataQualityReport([], passingStats);
    expect(formatMarkdownReport(passingReport)).toContain("PASS");

    const failingStats = makeMatchStats({ matchRate: 0.7 });
    const failingReport = generateDataQualityReport([], failingStats);
    expect(formatMarkdownReport(failingReport)).toContain("FAIL");
  });
});

// ---------------------------------------------------------------------------
// writeReport (file system)
// ---------------------------------------------------------------------------

describe("writeReport", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "uc-stats-report-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes both markdown and JSON files", () => {
    const report = generateDataQualityReport(
      [makeComputedRecord()],
      makeMatchStats(),
    );

    const { markdownPath, jsonPath } = writeReport(report, tmpDir);

    expect(fs.existsSync(markdownPath)).toBe(true);
    expect(fs.existsSync(jsonPath)).toBe(true);
  });

  it("writes valid JSON", () => {
    const report = generateDataQualityReport(
      [makeComputedRecord()],
      makeMatchStats(),
    );

    const { jsonPath } = writeReport(report, tmpDir);
    const data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
    expect(data.overall.totalRecords).toBe(1);
  });

  it("writes readable Markdown", () => {
    const report = generateDataQualityReport(
      [makeComputedRecord()],
      makeMatchStats(),
    );

    const { markdownPath } = writeReport(report, tmpDir);
    const content = fs.readFileSync(markdownPath, "utf-8");
    expect(content).toContain("# Data Quality Report");
  });

  it("creates output directory if it does not exist", () => {
    const nested = path.join(tmpDir, "a", "b", "c");
    const report = generateDataQualityReport([], makeMatchStats());

    writeReport(report, nested);
    expect(fs.existsSync(nested)).toBe(true);
  });
});
