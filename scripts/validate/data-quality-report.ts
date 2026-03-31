/**
 * S08: Data quality report generator
 *
 * Analyzes pipeline output and produces a comprehensive quality report:
 * - Matched vs. unmatched schools
 * - Years with missing data
 * - Suppressed records
 * - Coverage percentage
 *
 * Outputs both a Markdown report and a JSON summary.
 *
 * Usage (CLI):
 *   tsx scripts/validate/data-quality-report.ts --output ./reports
 *
 * Usage (module):
 *   import { generateDataQualityReport } from './data-quality-report.ts';
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ComputedRecord } from "../transform/compute-metrics.ts";
import type { MatchStats } from "../transform/normalize-schools.ts";
import type { CampusSlug } from "../../src/types/index.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Information about a suppressed record */
export interface SuppressedRecord {
  schoolId: string;
  schoolName: string;
  campus: CampusSlug;
  year: number;
  suppressedFields: string[];
}

/** Missing data analysis for a campus */
export interface CampusCoverage {
  campus: CampusSlug;
  yearsPresent: number[];
  yearsMissing: number[];
  recordCount: number;
}

/** The complete quality report data */
export interface QualityReport {
  /** When the report was generated */
  generatedAt: string;
  /** Match statistics from the normalization step */
  matchStats: MatchStats;
  /** List of unmatched school names with record counts */
  unmatchedSchools: Array<{ name: string; recordCount: number }>;
  /** Records with suppressed (null) data */
  suppressedRecords: SuppressedRecord[];
  /** Coverage per campus */
  campusCoverage: CampusCoverage[];
  /** Overall statistics */
  overall: {
    totalRecords: number;
    totalSchools: number;
    totalSuppressedRecords: number;
    suppressionRate: number;
    coveragePercentage: number;
    matchRatePassesThreshold: boolean;
  };
}

// ---------------------------------------------------------------------------
// Analysis functions
// ---------------------------------------------------------------------------

/**
 * Find records with suppressed (null) data fields.
 */
export function findSuppressedRecords(
  records: ComputedRecord[],
): { suppressed: SuppressedRecord[]; totalCount: number } {
  const suppressed: SuppressedRecord[] = [];
  let totalCount = 0;
  const MAX_SAMPLES = 100;

  for (const record of records) {
    const suppressedFields: string[] = [];

    if (record.applicants === null) suppressedFields.push("applicants");
    if (record.admits === null) suppressedFields.push("admits");
    if (record.enrollees === null) suppressedFields.push("enrollees");
    if (record.gpaApplicants === null) suppressedFields.push("gpaApplicants");
    if (record.gpaAdmits === null) suppressedFields.push("gpaAdmits");
    if (record.gpaEnrollees === null) suppressedFields.push("gpaEnrollees");

    if (suppressedFields.length > 0) {
      totalCount++;
      if (suppressed.length < MAX_SAMPLES) {
        suppressed.push({
          schoolId: record.schoolId,
          schoolName: record.school,
          campus: record.campus,
          year: record.year,
          suppressedFields,
        });
      }
    }
  }

  return { suppressed, totalCount };
}

/**
 * Analyze unmatched schools and count their records.
 */
export function analyzeUnmatchedSchools(
  records: ComputedRecord[],
): Array<{ name: string; recordCount: number }> {
  const unmatchedMap = new Map<string, { name: string; count: number }>();

  for (const record of records) {
    if (!record.matched) {
      const existing = unmatchedMap.get(record.schoolId);
      if (existing) {
        existing.count++;
      } else {
        unmatchedMap.set(record.schoolId, {
          name: record.ucName,
          count: 1,
        });
      }
    }
  }

  return Array.from(unmatchedMap.values())
    .map((entry) => ({
      name: entry.name,
      recordCount: entry.count,
    }))
    .sort((a, b) => b.recordCount - a.recordCount);
}

/**
 * Analyze campus data coverage across years.
 *
 * @param records - All computed records
 * @param expectedYears - The expected range of years (e.g., [2015, 2016, ..., 2025])
 */
export function analyzeCampusCoverage(
  records: ComputedRecord[],
  expectedYears?: number[],
): CampusCoverage[] {
  // Determine expected years from data if not provided
  let minYear = Infinity;
  let maxYear = -Infinity;
  for (const r of records) {
    if (r.year < minYear) minYear = r.year;
    if (r.year > maxYear) maxYear = r.year;
  }
  if (!isFinite(minYear)) { minYear = 0; maxYear = 0; }
  const expected =
    expectedYears ??
    Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i);

  // Group by campus
  const campusGroups = new Map<CampusSlug, Set<number>>();
  const campusCounts = new Map<CampusSlug, number>();
  for (const record of records) {
    const years = campusGroups.get(record.campus);
    if (years) {
      years.add(record.year);
    } else {
      campusGroups.set(record.campus, new Set([record.year]));
    }
    campusCounts.set(record.campus, (campusCounts.get(record.campus) ?? 0) + 1);
  }

  const coverage: CampusCoverage[] = [];
  for (const [campus, yearsSet] of campusGroups) {
    const yearsPresent = [...yearsSet].sort((a, b) => a - b);
    const yearsMissing = expected.filter((y) => !yearsSet.has(y));

    coverage.push({
      campus,
      yearsPresent,
      yearsMissing,
      recordCount: campusCounts.get(campus) ?? 0,
    });
  }

  return coverage.sort((a, b) => a.campus.localeCompare(b.campus));
}

// ---------------------------------------------------------------------------
// Report generation
// ---------------------------------------------------------------------------

/**
 * Generate the full data quality report.
 *
 * @param records - Computed records from the metrics step
 * @param matchStats - Match statistics from the normalization step
 * @param expectedYears - Optional expected year range
 */
export function generateDataQualityReport(
  records: ComputedRecord[],
  matchStats: MatchStats,
  expectedYears?: number[],
): QualityReport {
  const unmatchedSchools = analyzeUnmatchedSchools(records);
  const { suppressed: suppressedRecords, totalCount: totalSuppressedCount } = findSuppressedRecords(records);
  const campusCoverage = analyzeCampusCoverage(records, expectedYears);

  const totalSchools = new Set(records.map((r) => r.schoolId)).size;
  const suppressionRate =
    records.length > 0 ? totalSuppressedCount / records.length : 0;

  // Coverage: what fraction of campus-year combinations have data
  const allCampuses = new Set(records.map((r) => r.campus));
  const allYears = new Set(records.map((r) => r.year));
  const totalPossibleCombinations = allCampuses.size * allYears.size;
  const actualCombinations = new Set(
    records.map((r) => `${r.campus}|${r.year}`),
  ).size;
  const coveragePercentage =
    totalPossibleCombinations > 0
      ? actualCombinations / totalPossibleCombinations
      : 0;

  return {
    generatedAt: new Date().toISOString(),
    matchStats,
    unmatchedSchools,
    suppressedRecords,
    campusCoverage,
    overall: {
      totalRecords: records.length,
      totalSchools,
      totalSuppressedRecords: totalSuppressedCount,
      suppressionRate,
      coveragePercentage,
      matchRatePassesThreshold: matchStats.matchRate >= 0.9,
    },
  };
}

// ---------------------------------------------------------------------------
// Output formatting
// ---------------------------------------------------------------------------

/**
 * Format the quality report as a Markdown string.
 */
export function formatMarkdownReport(report: QualityReport): string {
  const lines: string[] = [];

  lines.push("# Data Quality Report");
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push("");

  // Match statistics
  lines.push("## School Name Matching");
  lines.push("");
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(
    `| Total unique schools | ${report.matchStats.totalUniqueSchools} |`,
  );
  lines.push(`| Exact matches | ${report.matchStats.exactMatches} |`);
  lines.push(
    `| Normalized matches | ${report.matchStats.normalizedMatches} |`,
  );
  lines.push(`| Fuzzy matches | ${report.matchStats.fuzzyMatches} |`);
  lines.push(`| Override matches | ${report.matchStats.overrideMatches} |`);
  lines.push(`| Unmatched | ${report.matchStats.unmatched} |`);
  lines.push(
    `| **Match rate** | **${(report.matchStats.matchRate * 100).toFixed(1)}%** ${report.overall.matchRatePassesThreshold ? "(PASS >= 90%)" : "(FAIL < 90%)"} |`,
  );
  lines.push("");

  // Unmatched schools
  if (report.unmatchedSchools.length > 0) {
    lines.push("## Unmatched Schools");
    lines.push("");
    lines.push("| School Name | Records |");
    lines.push("|-------------|---------|");
    for (const school of report.unmatchedSchools) {
      lines.push(`| ${school.name} | ${school.recordCount} |`);
    }
    lines.push("");
  }

  // Overall statistics
  lines.push("## Overall Statistics");
  lines.push("");
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total records | ${report.overall.totalRecords} |`);
  lines.push(`| Total schools | ${report.overall.totalSchools} |`);
  lines.push(
    `| Suppressed records | ${report.overall.totalSuppressedRecords} |`,
  );
  lines.push(
    `| Suppression rate | ${(report.overall.suppressionRate * 100).toFixed(1)}% |`,
  );
  lines.push(
    `| Coverage | ${(report.overall.coveragePercentage * 100).toFixed(1)}% |`,
  );
  lines.push("");

  // Campus coverage
  if (report.campusCoverage.length > 0) {
    lines.push("## Campus Coverage");
    lines.push("");
    lines.push("| Campus | Records | Years Present | Years Missing |");
    lines.push("|--------|---------|---------------|---------------|");
    for (const campus of report.campusCoverage) {
      const present = campus.yearsPresent.join(", ");
      const missing =
        campus.yearsMissing.length > 0
          ? campus.yearsMissing.join(", ")
          : "None";
      lines.push(
        `| ${campus.campus} | ${campus.recordCount} | ${present} | ${missing} |`,
      );
    }
    lines.push("");
  }

  // Suppressed records summary
  if (report.suppressedRecords.length > 0) {
    lines.push("## Suppressed Records");
    lines.push("");
    lines.push(
      `Total: ${report.suppressedRecords.length} records have at least one suppressed field.`,
    );
    lines.push("");

    // Show first 20 as examples
    const sample = report.suppressedRecords.slice(0, 20);
    lines.push("| School | Campus | Year | Suppressed Fields |");
    lines.push("|--------|--------|------|-------------------|");
    for (const rec of sample) {
      lines.push(
        `| ${rec.schoolName} | ${rec.campus} | ${rec.year} | ${rec.suppressedFields.join(", ")} |`,
      );
    }
    if (report.suppressedRecords.length > 20) {
      lines.push(
        `| ... | ... | ... | (${report.suppressedRecords.length - 20} more) |`,
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Write the quality report to files.
 */
export function writeReport(
  report: QualityReport,
  outputDir: string,
): { markdownPath: string; jsonPath: string } {
  fs.mkdirSync(outputDir, { recursive: true });

  const markdownPath = path.join(outputDir, "data-quality-report.md");
  const jsonPath = path.join(outputDir, "data-quality-report.json");

  fs.writeFileSync(markdownPath, formatMarkdownReport(report));
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  return { markdownPath, jsonPath };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const outputIdx = args.indexOf("--output");
  const inputIdx = args.indexOf("--input");

  const outputDir = outputIdx >= 0 ? args[outputIdx + 1] : "./reports";
  const inputFile = inputIdx >= 0 ? args[inputIdx + 1] : undefined;

  if (!inputFile) {
    console.error(
      "Usage: tsx scripts/validate/data-quality-report.ts --input <pipeline-data.json> [--output <dir>]",
    );
    process.exit(1);
  }

  try {
    const data = JSON.parse(fs.readFileSync(inputFile, "utf-8")) as {
      records: ComputedRecord[];
      matchStats: MatchStats;
    };

    const report = generateDataQualityReport(
      data.records,
      data.matchStats,
    );

    const { markdownPath, jsonPath } = writeReport(report, outputDir!);

    console.log(`Markdown report: ${markdownPath}`);
    console.log(`JSON report: ${jsonPath}`);
    console.log(
      `\nMatch rate: ${(report.matchStats.matchRate * 100).toFixed(1)}% ${report.overall.matchRatePassesThreshold ? "(PASS)" : "(FAIL)"}`,
    );
    console.log(`Suppressed records: ${report.overall.totalSuppressedRecords}`);
    console.log(
      `Coverage: ${(report.overall.coveragePercentage * 100).toFixed(1)}%`,
    );
  } catch (err) {
    console.error(
      `Error: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  }
}

// Run CLI if executed directly
const isMainModule =
  process.argv[1] &&
  (process.argv[1].endsWith("data-quality-report.ts") ||
    process.argv[1].endsWith("data-quality-report.js"));
if (isMainModule) {
  main();
}
