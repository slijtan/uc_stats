/**
 * S09: Pipeline orchestrator
 *
 * Runs the full data pipeline end-to-end:
 *   1. Parse Tableau exports (extract)
 *   2. Normalize school names (transform)
 *   3. Compute metrics (transform)
 *   4. Generate JSON files (transform)
 *   5. Generate data quality report (validate)
 *
 * Usage:
 *   tsx scripts/pipeline.ts --input ./raw-data --output ./public/data
 *
 * Options:
 *   --input <dir>     Directory containing Tableau CSV/Excel exports (required)
 *   --output <dir>    Output directory for JSON files (default: ./public/data)
 *   --cde-dir <dir>   Directory containing CDE school CSV files (default: <input>/cde)
 *   --report-dir <dir> Directory for quality report output (default: ./reports)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { parseTableauExports } from "./extract/parse-tableau-export.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import {
  normalizeSchools,
  parseCdeDirectory,
  parseCensusEnrollmentFile,
  parseHistoricalEnrollmentFile,
  parsePrivateSchoolEnrollmentFile,
  mergeEnrollmentMaps,
  buildNcesCrosswalk,
} from "./transform/normalize-schools.ts";
import type { EnrollmentMap } from "./transform/normalize-schools.ts";
import { computePipelineMetrics } from "./transform/compute-metrics.ts";
import { generateJsonFiles } from "./transform/generate-json.ts";
import { loadCdeQualityData, mergeCdeQuality } from "./extract/parse-cde-quality.ts";
import { parseCrdcFile, findCrdcFile } from "./extract/parse-crdc.ts";
import {
  generateDataQualityReport,
  writeReport,
} from "./validate/data-quality-report.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PipelineOptions {
  inputDir: string;
  outputDir: string;
  cdeDir: string;
  reportDir: string;
}

export interface PipelineResult {
  /** Number of raw records parsed */
  rawRecordCount: number;
  /** Number of enriched records after normalization */
  enrichedRecordCount: number;
  /** Number of JSON files generated */
  filesGenerated: number;
  /** Match rate from school name normalization */
  matchRate: number;
  /** Whether the match rate passes the 90% threshold */
  matchRatePassesThreshold: boolean;
}

// ---------------------------------------------------------------------------
// Pipeline stages
// ---------------------------------------------------------------------------

/**
 * Run the full pipeline.
 */
export async function runPipeline(
  options: PipelineOptions,
): Promise<PipelineResult> {
  const { inputDir, outputDir, cdeDir, reportDir } = options;

  // -----------------------------------------------------------------------
  // Stage 1: Parse Tableau exports
  // -----------------------------------------------------------------------
  console.log("=== Stage 1: Parsing Tableau exports ===");

  // Auto-detect UC data subdirectory
  const ucDir = path.join(inputDir, "uc");
  const ucInputDir = fs.existsSync(ucDir) ? ucDir : inputDir;
  console.log(`  Input directory: ${ucInputDir}`);

  const { records: rawRecords, warnings: parseWarnings } =
    await parseTableauExports(ucInputDir);

  if (parseWarnings.length > 0) {
    console.log(`  Warnings: ${parseWarnings.length}`);
    for (const w of parseWarnings) {
      console.warn(`    ${w}`);
    }
  }

  console.log(`  Parsed ${rawRecords.length} raw records`);

  if (rawRecords.length === 0) {
    throw new Error(
      "No records were parsed from the input files. Check the input directory and file format.",
    );
  }

  // -----------------------------------------------------------------------
  // Stage 2: Normalize school names
  // -----------------------------------------------------------------------
  console.log("\n=== Stage 2: Normalizing school names ===");
  console.log(`  CDE directory: ${cdeDir}`);

  let cdeRecords;
  try {
    cdeRecords = parseCdeDirectory(cdeDir);
  } catch {
    console.log(
      `  Warning: CDE directory not found or empty at ${cdeDir}. Proceeding without CDE matching.`,
    );
    cdeRecords = [];
  }

  // Load manual overrides
  const overridesPath = path.resolve(
    __dirname,
    "data/school-name-overrides.json",
  );
  const overrides: Record<string, string> = fs.existsSync(overridesPath)
    ? JSON.parse(fs.readFileSync(overridesPath, "utf-8"))
    : {};

  // Load CDE enrollment data (grade 12 counts, year-aware)
  let enrollmentMap: EnrollmentMap = new Map();
  if (fs.existsSync(cdeDir)) {
    const allFiles = fs.readdirSync(cdeDir);
    const maps: EnrollmentMap[] = [];

    // Census Day files (cdenroll*.txt) — 2023-24 and 2024-25
    const censusFiles = allFiles.filter((f) => f.toLowerCase().startsWith("cdenroll") && f.endsWith(".txt"));
    for (const file of censusFiles) {
      const m = parseCensusEnrollmentFile(path.join(cdeDir, file));
      let count = 0;
      for (const yearMap of m.values()) count += yearMap.size;
      console.log(`  Census enrollment: ${file} → ${m.size} schools`);
      maps.push(m);
    }

    // Historical files (enr*.txt) — 2014-2022
    const histFiles = allFiles.filter((f) => /^enr\d{6}/.test(f.toLowerCase()) && f.endsWith(".txt"));
    for (const file of histFiles) {
      const m = parseHistoricalEnrollmentFile(path.join(cdeDir, file));
      console.log(`  Historical enrollment: ${file} → ${m.size} schools`);
      maps.push(m);
    }

    // Private School Affidavit files (privateschooldata*.xlsx) — Grade 12 enrollment for private schools
    const privateFiles = allFiles.filter((f) => /^privateschooldata\d{4}\.xlsx$/i.test(f));
    for (const file of privateFiles) {
      const m = await parsePrivateSchoolEnrollmentFile(path.join(cdeDir, file));
      console.log(`  Private school enrollment: ${file} → ${m.size} schools`);
      maps.push(m);
    }

    if (maps.length > 0) {
      enrollmentMap = mergeEnrollmentMaps(...maps);
      let totalEntries = 0;
      for (const yearMap of enrollmentMap.values()) totalEntries += yearMap.size;
      console.log(`  Merged enrollment: ${enrollmentMap.size} schools, ${totalEntries} school-year entries`);
    } else {
      console.log("  Warning: No CDE enrollment files found. Application rate will be unavailable.");
    }
  }

  console.log(
    `  Loaded ${cdeRecords.length} CDE schools, ${Object.keys(overrides).length} overrides`,
  );

  const normResult = normalizeSchools(rawRecords, cdeRecords, overrides, enrollmentMap);

  console.log(`  Match statistics:`);
  console.log(
    `    Exact: ${normResult.stats.exactMatches}, Normalized: ${normResult.stats.normalizedMatches}, Fuzzy: ${normResult.stats.fuzzyMatches}, Override: ${normResult.stats.overrideMatches}`,
  );
  console.log(`    Unmatched: ${normResult.stats.unmatched}`);
  console.log(
    `    Match rate: ${(normResult.stats.matchRate * 100).toFixed(1)}%`,
  );

  // -----------------------------------------------------------------------
  // Stage 2b: Load CDE quality data
  // -----------------------------------------------------------------------
  console.log("\n=== Stage 2b: Loading CDE quality data ===");

  let qualityMap = new Map<string, import("../src/types/index.ts").SchoolQuality>();
  try {
    qualityMap = await loadCdeQualityData(cdeDir);
    console.log(`  Loaded quality data for ${qualityMap.size} schools`);
  } catch (err) {
    console.log(
      `  Warning: Could not load CDE quality data: ${err instanceof Error ? err.message : String(err)}. Proceeding without quality metrics.`,
    );
  }

  // -----------------------------------------------------------------------
  // Stage 2c: Load CRDC data (AP course access)
  // -----------------------------------------------------------------------
  console.log("\n=== Stage 2c: Loading CRDC data ===");

  const crdcDir = path.join(inputDir, "crdc");
  const crdcFile = findCrdcFile(crdcDir);
  if (crdcFile) {
    try {
      // Build NCES-to-CDS crosswalk from CDE records
      const ncesCrosswalk = buildNcesCrosswalk(cdeRecords);
      console.log(`  NCES crosswalk: ${ncesCrosswalk.size} entries`);

      const crdcMap = parseCrdcFile(crdcFile, ncesCrosswalk);
      console.log(`  CRDC: ${crdcMap.size} schools with AP data from ${path.basename(crdcFile)}`);

      // Merge CRDC data into quality map
      if (crdcMap.size > 0) {
        qualityMap = mergeCdeQuality(qualityMap, crdcMap);
      }
    } catch (err) {
      console.log(
        `  Warning: Could not load CRDC data: ${err instanceof Error ? err.message : String(err)}. Proceeding without AP course data.`,
      );
    }
  } else {
    console.log(`  CRDC: no preprocessed data file found in ${crdcDir}`);
  }

  // -----------------------------------------------------------------------
  // Stage 3: Compute metrics
  // -----------------------------------------------------------------------
  console.log("\n=== Stage 3: Computing metrics ===");

  const metricsResult = computePipelineMetrics(normResult.records);

  console.log(`  Computed metrics for ${metricsResult.records.length} records`);
  console.log(
    `  Generated ${metricsResult.summaries.length} campus/year summaries`,
  );

  // -----------------------------------------------------------------------
  // Stage 4: Generate JSON files
  // -----------------------------------------------------------------------
  console.log("\n=== Stage 4: Generating JSON files ===");
  console.log(`  Output directory: ${outputDir}`);

  const generateResult = generateJsonFiles(metricsResult, outputDir, qualityMap);

  console.log(`  Written ${generateResult.filesWritten.length} files:`);
  for (const file of generateResult.filesWritten) {
    console.log(`    ${file}`);
  }
  console.log(`  Schools: ${generateResult.schoolCount}`);
  console.log(`  Total records: ${generateResult.totalRecords}`);

  // -----------------------------------------------------------------------
  // Stage 5: Generate quality report
  // -----------------------------------------------------------------------
  console.log("\n=== Stage 5: Generating data quality report ===");
  console.log(`  Report directory: ${reportDir}`);

  const qualityReport = generateDataQualityReport(
    metricsResult.records,
    normResult.stats,
  );

  const { markdownPath, jsonPath } = writeReport(qualityReport, reportDir);

  console.log(`  Markdown report: ${markdownPath}`);
  console.log(`  JSON report: ${jsonPath}`);
  console.log(
    `  Match rate: ${(qualityReport.matchStats.matchRate * 100).toFixed(1)}% ${qualityReport.overall.matchRatePassesThreshold ? "(PASS)" : "(FAIL)"}`,
  );

  // -----------------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------------
  console.log("\n=== Pipeline Complete ===");
  console.log(`  Raw records parsed:   ${rawRecords.length}`);
  console.log(`  Enriched records:     ${normResult.records.length}`);
  console.log(`  Files generated:      ${generateResult.filesWritten.length}`);
  console.log(
    `  Match rate:           ${(normResult.stats.matchRate * 100).toFixed(1)}%`,
  );
  console.log(
    `  Suppressed records:   ${qualityReport.overall.totalSuppressedRecords}`,
  );

  return {
    rawRecordCount: rawRecords.length,
    enrichedRecordCount: normResult.records.length,
    filesGenerated: generateResult.filesWritten.length,
    matchRate: normResult.stats.matchRate,
    matchRatePassesThreshold:
      qualityReport.overall.matchRatePassesThreshold,
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(): PipelineOptions {
  const args = process.argv.slice(2);

  function getArg(name: string, defaultValue?: string): string | undefined {
    const idx = args.indexOf(name);
    return idx >= 0 ? args[idx + 1] : defaultValue;
  }

  const inputDir = getArg("--input");
  if (!inputDir) {
    console.error(
      "Usage: tsx scripts/pipeline.ts --input <dir> [--output <dir>] [--cde-dir <dir>] [--report-dir <dir>]",
    );
    console.error("\nOptions:");
    console.error(
      "  --input <dir>       Directory containing Tableau CSV/Excel exports (required)",
    );
    console.error(
      "  --output <dir>      Output directory for JSON files (default: ./public/data)",
    );
    console.error(
      "  --cde-dir <dir>     Directory containing CDE school CSV files (default: <input>/cde)",
    );
    console.error(
      "  --report-dir <dir>  Directory for quality report output (default: ./reports)",
    );
    process.exit(1);
  }

  return {
    inputDir,
    outputDir: getArg("--output", "public/data")!,
    cdeDir: getArg("--cde-dir", path.join(inputDir, "cde"))!,
    reportDir: getArg("--report-dir", "reports")!,
  };
}

// Run CLI if executed directly
const isMainModule =
  process.argv[1] &&
  (process.argv[1].endsWith("pipeline.ts") ||
    process.argv[1].endsWith("pipeline.js"));
if (isMainModule) {
  const options = parseArgs();
  runPipeline(options).catch((err) => {
    console.error(
      `\nPipeline failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  });
}
