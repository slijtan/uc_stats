import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  buildSchoolIndex,
  buildCampusDataFiles,
  buildSummaryData,
  generateJsonFiles,
} from "../../scripts/transform/generate-json.ts";
import type { ComputedRecord, MetricsResult } from "../../scripts/transform/compute-metrics.ts";
import type { CampusSummary, CampusSlug } from "../../src/types/index.ts";

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

function makeSummary(overrides: Partial<CampusSummary> = {}): CampusSummary {
  return {
    campus: "berkeley",
    campusName: "UC Berkeley",
    year: 2024,
    public: {
      schoolCount: 2,
      totalApplicants: 300,
      totalAdmits: 130,
      acceptanceRate: 0.433,
      meanSchoolAcceptanceRate: 0.45,
      medianSchoolAcceptanceRate: 0.45,
      meanGpa: 3.7,
    },
    private: {
      schoolCount: 1,
      totalApplicants: 50,
      totalAdmits: 40,
      acceptanceRate: 0.8,
      meanSchoolAcceptanceRate: 0.8,
      medianSchoolAcceptanceRate: 0.8,
      meanGpa: 4.0,
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// buildSchoolIndex
// ---------------------------------------------------------------------------

describe("buildSchoolIndex", () => {
  it("creates an index from computed records", () => {
    const records = [
      makeComputedRecord({ schoolId: "001", school: "Lincoln High School", year: 2023 }),
      makeComputedRecord({ schoolId: "001", school: "Lincoln High School", year: 2024 }),
      makeComputedRecord({ schoolId: "002", school: "Washington High School", year: 2024 }),
    ];

    const index = buildSchoolIndex(records);
    expect(index.totalSchools).toBe(2);
    expect(index.schools).toHaveLength(2);
  });

  it("deduplicates schools across records", () => {
    const records = [
      makeComputedRecord({ schoolId: "001", campus: "berkeley", year: 2023 }),
      makeComputedRecord({ schoolId: "001", campus: "berkeley", year: 2024 }),
      makeComputedRecord({ schoolId: "001", campus: "davis", year: 2024 }),
    ];

    const index = buildSchoolIndex(records);
    expect(index.totalSchools).toBe(1);
  });

  it("aggregates available years across campuses", () => {
    const records = [
      makeComputedRecord({ schoolId: "001", campus: "berkeley", year: 2022 }),
      makeComputedRecord({ schoolId: "001", campus: "davis", year: 2023 }),
      makeComputedRecord({ schoolId: "001", campus: "berkeley", year: 2024 }),
    ];

    const index = buildSchoolIndex(records);
    expect(index.schools[0]!.yearsAvailable).toEqual([2022, 2023, 2024]);
  });

  it("includes all required school metadata fields", () => {
    const records = [
      makeComputedRecord({
        schoolId: "001",
        school: "Lincoln High School",
        schoolType: "public",
        county: "San Francisco",
        city: "San Francisco",
        ucName: "LINCOLN HS",
        matched: true,
      }),
    ];

    const index = buildSchoolIndex(records);
    const school = index.schools[0]!;
    expect(school.id).toBe("001");
    expect(school.name).toBe("Lincoln High School");
    expect(school.type).toBe("public");
    expect(school.county).toBe("San Francisco");
    expect(school.city).toBe("San Francisco");
    expect(school.ucName).toBe("LINCOLN HS");
    expect(school.matched).toBe(true);
    expect(school.matchMethod).toBe("exact");
  });

  it("sorts schools alphabetically by name", () => {
    const records = [
      makeComputedRecord({ schoolId: "002", school: "Washington High" }),
      makeComputedRecord({ schoolId: "001", school: "Lincoln High" }),
    ];

    const index = buildSchoolIndex(records);
    expect(index.schools[0]!.name).toBe("Lincoln High");
    expect(index.schools[1]!.name).toBe("Washington High");
  });

  it("includes generatedAt timestamp", () => {
    const index = buildSchoolIndex([makeComputedRecord()]);
    expect(index.generatedAt).toBeDefined();
    expect(new Date(index.generatedAt).getTime()).not.toBeNaN();
  });
});

// ---------------------------------------------------------------------------
// buildCampusDataFiles
// ---------------------------------------------------------------------------

describe("buildCampusDataFiles", () => {
  it("creates files for all 10 campuses", () => {
    const records = [makeComputedRecord({ campus: "berkeley" })];
    const files = buildCampusDataFiles(records);
    expect(files.size).toBe(10);
  });

  it("partitions records by campus", () => {
    const records = [
      makeComputedRecord({ campus: "berkeley", schoolId: "001" }),
      makeComputedRecord({ campus: "berkeley", schoolId: "002" }),
      makeComputedRecord({ campus: "davis", schoolId: "001" }),
    ];

    const files = buildCampusDataFiles(records);
    expect(files.get("berkeley")!.totalRecords).toBe(2);
    expect(files.get("davis")!.totalRecords).toBe(1);
    expect(files.get("irvine")!.totalRecords).toBe(0);
  });

  it("generates correct campus metadata", () => {
    const records = [
      makeComputedRecord({ campus: "berkeley", year: 2022 }),
      makeComputedRecord({ campus: "berkeley", year: 2024 }),
    ];

    const files = buildCampusDataFiles(records);
    const berkeley = files.get("berkeley")!;
    expect(berkeley.campus).toBe("berkeley");
    expect(berkeley.campusName).toBe("UC Berkeley");
    expect(berkeley.yearRange.min).toBe(2022);
    expect(berkeley.yearRange.max).toBe(2024);
  });

  it("strips pipeline metadata from admission records", () => {
    const records = [makeComputedRecord({ campus: "berkeley" })];
    const files = buildCampusDataFiles(records);
    const record = files.get("berkeley")!.records[0]!;

    // Should have AdmissionRecord fields
    expect(record.schoolId).toBeDefined();
    expect(record.year).toBeDefined();
    expect(record.applicants).toBeDefined();
    expect(record.admits).toBeDefined();
    expect(record.enrollees).toBeDefined();

    // Should NOT have pipeline metadata
    expect((record as unknown as Record<string, unknown>).school).toBeUndefined();
    expect((record as unknown as Record<string, unknown>).ucName).toBeUndefined();
    expect((record as unknown as Record<string, unknown>).county).toBeUndefined();
    expect((record as unknown as Record<string, unknown>).matchMethod).toBeUndefined();
    expect((record as unknown as Record<string, unknown>).acceptanceRate).toBeUndefined();
  });

  it("handles empty campus (no records)", () => {
    const files = buildCampusDataFiles([]);
    const merced = files.get("merced")!;
    expect(merced.totalRecords).toBe(0);
    expect(merced.records).toEqual([]);
    expect(merced.yearRange.min).toBe(0);
    expect(merced.yearRange.max).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// buildSummaryData
// ---------------------------------------------------------------------------

describe("buildSummaryData", () => {
  it("builds summary with correct latest year", () => {
    const summaries = [
      makeSummary({ year: 2022 }),
      makeSummary({ year: 2023 }),
      makeSummary({ year: 2024 }),
    ];

    const result = buildSummaryData(summaries);
    expect(result.latestYear).toBe(2024);
  });

  it("includes all summaries", () => {
    const summaries = [
      makeSummary({ campus: "berkeley", year: 2024 }),
      makeSummary({ campus: "davis", year: 2024 }),
    ];

    const result = buildSummaryData(summaries);
    expect(result.summaries).toHaveLength(2);
  });

  it("includes generatedAt timestamp", () => {
    const result = buildSummaryData([makeSummary()]);
    expect(result.generatedAt).toBeDefined();
    expect(new Date(result.generatedAt).getTime()).not.toBeNaN();
  });

  it("handles empty summaries", () => {
    const result = buildSummaryData([]);
    expect(result.latestYear).toBe(0);
    expect(result.summaries).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// generateJsonFiles (integration with file system)
// ---------------------------------------------------------------------------

describe("generateJsonFiles", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "uc-stats-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function makeMetricsResult(
    records: ComputedRecord[] = [],
    summaries: CampusSummary[] = [],
  ): MetricsResult {
    return { records, summaries };
  }

  it("creates the output directory if it does not exist", () => {
    const outputDir = path.join(tmpDir, "data", "nested");
    const metricsResult = makeMetricsResult([makeComputedRecord()], [makeSummary()]);

    generateJsonFiles(metricsResult, outputDir);
    expect(fs.existsSync(outputDir)).toBe(true);
  });

  it("writes exactly 12 files", () => {
    const metricsResult = makeMetricsResult(
      [makeComputedRecord()],
      [makeSummary()],
    );

    const result = generateJsonFiles(metricsResult, tmpDir);
    expect(result.filesWritten).toHaveLength(12);
  });

  it("writes a valid school-index.json", () => {
    const metricsResult = makeMetricsResult(
      [makeComputedRecord({ schoolId: "001", school: "Lincoln High" })],
      [],
    );

    generateJsonFiles(metricsResult, tmpDir);

    const indexPath = path.join(tmpDir, "school-index.json");
    expect(fs.existsSync(indexPath)).toBe(true);

    const data = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
    expect(data.totalSchools).toBe(1);
    expect(data.schools[0].id).toBe("001");
    expect(data.generatedAt).toBeDefined();
  });

  it("writes a valid summary.json", () => {
    const metricsResult = makeMetricsResult(
      [],
      [makeSummary({ campus: "berkeley", year: 2024 })],
    );

    generateJsonFiles(metricsResult, tmpDir);

    const summaryPath = path.join(tmpDir, "summary.json");
    expect(fs.existsSync(summaryPath)).toBe(true);

    const data = JSON.parse(fs.readFileSync(summaryPath, "utf-8"));
    expect(data.latestYear).toBe(2024);
    expect(data.summaries).toHaveLength(1);
  });

  it("writes campus-{slug}.json files for all 10 campuses", () => {
    const metricsResult = makeMetricsResult([makeComputedRecord()], []);

    generateJsonFiles(metricsResult, tmpDir);

    const expectedSlugs: CampusSlug[] = [
      "systemwide",
      "berkeley",
      "davis",
      "irvine",
      "la",
      "merced",
      "riverside",
      "san-diego",
      "santa-barbara",
      "santa-cruz",
    ];

    for (const slug of expectedSlugs) {
      const filePath = path.join(tmpDir, `campus-${slug}.json`);
      expect(fs.existsSync(filePath)).toBe(true);

      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      expect(data.campus).toBe(slug);
      expect(data.campusName).toBeDefined();
    }
  });

  it("returns correct metadata", () => {
    const records = [
      makeComputedRecord({ campus: "berkeley", schoolId: "001" }),
      makeComputedRecord({ campus: "berkeley", schoolId: "002" }),
      makeComputedRecord({ campus: "davis", schoolId: "001" }),
    ];
    const metricsResult = makeMetricsResult(records, []);

    const result = generateJsonFiles(metricsResult, tmpDir);
    expect(result.schoolCount).toBe(2);
    expect(result.totalRecords).toBe(3);
  });
});
