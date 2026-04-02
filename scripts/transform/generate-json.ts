/**
 * S07: Generate campus-partitioned JSON data files
 *
 * Takes computed admission records and summary aggregates, partitions them
 * by campus, and writes the 12 JSON files consumed by the frontend:
 *   - school-index.json
 *   - summary.json
 *   - campus-{slug}.json (x10)
 *
 * Usage (CLI):
 *   tsx scripts/transform/generate-json.ts --input computed.json --output ./public/data
 *
 * Usage (module):
 *   import { generateJsonFiles } from './generate-json.ts';
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type {
  School,
  SchoolIndex,
  SchoolQuality,
  CampusData,
  CampusSlug,
  SummaryData,
  CampusSummary,
  AdmissionRecord,
} from "../../src/types/index.ts";
import type { ComputedRecord, MetricsResult } from "./compute-metrics.ts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** All valid campus slugs */
const ALL_CAMPUS_SLUGS: CampusSlug[] = [
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

/** Campus slug to display name mapping */
const CAMPUS_DISPLAY_NAMES: Record<CampusSlug, string> = {
  systemwide: "UC Systemwide",
  berkeley: "UC Berkeley",
  davis: "UC Davis",
  irvine: "UC Irvine",
  la: "UCLA",
  merced: "UC Merced",
  riverside: "UC Riverside",
  "san-diego": "UC San Diego",
  "santa-barbara": "UC Santa Barbara",
  "santa-cruz": "UC Santa Cruz",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result from generating JSON files */
export interface GenerateResult {
  /** List of files that were written */
  filesWritten: string[];
  /** School index metadata */
  schoolCount: number;
  /** Total admission records across all campus files */
  totalRecords: number;
}

// ---------------------------------------------------------------------------
// School Index Generation
// ---------------------------------------------------------------------------

/**
 * Build the school index from computed records.
 * Deduplicates schools and aggregates available years.
 * Optionally attaches CDE quality metrics when a qualityMap is provided.
 */
export function buildSchoolIndex(
  records: ComputedRecord[],
  qualityMap?: Map<string, SchoolQuality>,
): SchoolIndex {
  const schoolMap = new Map<
    string,
    {
      id: string;
      name: string;
      type: "public" | "private";
      county: string;
      city: string;
      ucName: string;
      matched: boolean;
      matchMethod: "exact" | "normalized" | "fuzzy" | "override" | "unmatched";
      years: Set<number>;
      grade12Enrollment: Record<string, number>;
    }
  >();

  for (const record of records) {
    const existing = schoolMap.get(record.schoolId);
    if (existing) {
      existing.years.add(record.year);
      if (record.grade12Enrollment != null) {
        existing.grade12Enrollment[String(record.year)] = record.grade12Enrollment;
      }
    } else {
      const enr: Record<string, number> = {};
      if (record.grade12Enrollment != null) {
        enr[String(record.year)] = record.grade12Enrollment;
      }
      schoolMap.set(record.schoolId, {
        id: record.schoolId,
        name: record.school,
        type: record.schoolType,
        county: record.county,
        city: record.city,
        ucName: record.ucName,
        matched: record.matched,
        matchMethod: record.matchMethod,
        years: new Set([record.year]),
        grade12Enrollment: enr,
      });
    }
  }

  const schools: School[] = Array.from(schoolMap.values())
    .map((s) => {
      const school: School = {
        id: s.id,
        name: s.name,
        type: s.type,
        county: s.county,
        city: s.city,
        ucName: s.ucName,
        matched: s.matched,
        matchMethod: s.matchMethod,
        yearsAvailable: [...s.years].sort((a, b) => a - b),
        grade12Enrollment: s.grade12Enrollment,
      };
      const quality = qualityMap?.get(s.id);
      if (quality) {
        school.quality = quality;
      }
      return school;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    generatedAt: new Date().toISOString(),
    totalSchools: schools.length,
    schools,
  };
}

// ---------------------------------------------------------------------------
// Campus Data Generation
// ---------------------------------------------------------------------------

/**
 * Convert a ComputedRecord to an AdmissionRecord (strips pipeline metadata).
 */
function toAdmissionRecord(record: ComputedRecord): AdmissionRecord {
  return {
    schoolId: record.schoolId,
    year: record.year,
    schoolType: record.schoolType,
    applicants: record.applicants,
    admits: record.admits,
    enrollees: record.enrollees,
    gpaApplicants: record.gpaApplicants,
    gpaAdmits: record.gpaAdmits,
    gpaEnrollees: record.gpaEnrollees,
  };
}

/**
 * Build campus data files by partitioning records by campus slug.
 */
export function buildCampusDataFiles(
  records: ComputedRecord[],
): Map<CampusSlug, CampusData> {
  // Group records by campus
  const campusGroups = new Map<CampusSlug, ComputedRecord[]>();
  for (const record of records) {
    const group = campusGroups.get(record.campus);
    if (group) {
      group.push(record);
    } else {
      campusGroups.set(record.campus, [record]);
    }
  }

  const campusFiles = new Map<CampusSlug, CampusData>();

  for (const slug of ALL_CAMPUS_SLUGS) {
    const campusRecords = campusGroups.get(slug) ?? [];
    const admissionRecords = campusRecords.map(toAdmissionRecord);

    // Calculate year range
    const years = campusRecords.map((r) => r.year);
    const min = years.length > 0 ? Math.min(...years) : 0;
    const max = years.length > 0 ? Math.max(...years) : 0;

    campusFiles.set(slug, {
      campus: slug,
      campusName: CAMPUS_DISPLAY_NAMES[slug],
      yearRange: { min, max },
      totalRecords: admissionRecords.length,
      records: admissionRecords,
    });
  }

  return campusFiles;
}

// ---------------------------------------------------------------------------
// Summary Generation
// ---------------------------------------------------------------------------

/**
 * Build the summary data file from campus summaries.
 */
export function buildSummaryData(summaries: CampusSummary[]): SummaryData {
  const years = summaries.map((s) => s.year);
  const latestYear = years.length > 0 ? Math.max(...years) : 0;

  return {
    generatedAt: new Date().toISOString(),
    latestYear,
    summaries,
  };
}

// ---------------------------------------------------------------------------
// File Writing
// ---------------------------------------------------------------------------

/**
 * Generate all JSON files and write them to the output directory.
 *
 * @param metricsResult - Output from the compute-metrics step
 * @param outputDir - Directory to write JSON files to (created if not exists)
 * @param qualityMap - Optional map of CDS code to SchoolQuality metrics
 * @returns Metadata about the generated files
 */
export function generateJsonFiles(
  metricsResult: MetricsResult,
  outputDir: string,
  qualityMap?: Map<string, SchoolQuality>,
): GenerateResult {
  // Ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true });

  const filesWritten: string[] = [];
  let totalRecords = 0;

  // 1. Build and write school-index.json
  const schoolIndex = buildSchoolIndex(metricsResult.records, qualityMap);
  const schoolIndexPath = path.join(outputDir, "school-index.json");
  fs.writeFileSync(schoolIndexPath, JSON.stringify(schoolIndex, null, 2));
  filesWritten.push(schoolIndexPath);

  // 2. Build and write summary.json
  const summaryData = buildSummaryData(metricsResult.summaries);
  const summaryPath = path.join(outputDir, "summary.json");
  fs.writeFileSync(summaryPath, JSON.stringify(summaryData, null, 2));
  filesWritten.push(summaryPath);

  // 3. Build and write campus-{slug}.json files
  const campusFiles = buildCampusDataFiles(metricsResult.records);
  for (const [slug, campusData] of campusFiles) {
    const campusPath = path.join(outputDir, `campus-${slug}.json`);
    fs.writeFileSync(campusPath, JSON.stringify(campusData, null, 2));
    filesWritten.push(campusPath);
    totalRecords += campusData.totalRecords;
  }

  return {
    filesWritten,
    schoolCount: schoolIndex.totalSchools,
    totalRecords,
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const inputIdx = args.indexOf("--input");
  const outputIdx = args.indexOf("--output");

  const inputFile = inputIdx >= 0 ? args[inputIdx + 1] : undefined;
  const outputDir = outputIdx >= 0 ? args[outputIdx + 1] : "public/data";

  if (!inputFile) {
    console.error(
      "Usage: tsx scripts/transform/generate-json.ts --input <computed.json> [--output <dir>]",
    );
    process.exit(1);
  }

  try {
    const metricsResult: MetricsResult = JSON.parse(
      fs.readFileSync(inputFile, "utf-8"),
    );

    console.log(
      `Generating JSON files from ${metricsResult.records.length} records...`,
    );

    const result = generateJsonFiles(metricsResult, outputDir);

    console.log(`\nGenerated ${result.filesWritten.length} files:`);
    for (const file of result.filesWritten) {
      console.log(`  ${file}`);
    }
    console.log(`\nSchools: ${result.schoolCount}`);
    console.log(`Total records: ${result.totalRecords}`);
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
  (process.argv[1].endsWith("generate-json.ts") ||
    process.argv[1].endsWith("generate-json.js"));
if (isMainModule) {
  main();
}
