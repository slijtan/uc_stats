/**
 * S06: Metrics computation for the data pipeline
 *
 * Calculates derived metrics from enriched admission records:
 * - Acceptance rates per school/campus/year
 * - Public vs. private group aggregates
 * - Campus and systemwide summaries
 *
 * Usage (CLI):
 *   tsx scripts/transform/compute-metrics.ts --input enriched-records.json
 *
 * Usage (module):
 *   import { computePipelineMetrics } from './compute-metrics.ts';
 */

import * as fs from "node:fs";
import type { EnrichedRecord } from "./normalize-schools.ts";
import type {
  CampusSlug,
  GroupAggregate,
  CampusSummary,
} from "../../src/types/index.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A computed record including acceptance rate */
export interface ComputedRecord extends EnrichedRecord {
  acceptanceRate: number | null;
}

/** Result from the metrics computation */
export interface MetricsResult {
  /** Records with computed acceptance rates */
  records: ComputedRecord[];
  /** Pre-computed summaries for each campus/year combination */
  summaries: CampusSummary[];
}

// ---------------------------------------------------------------------------
// Acceptance rate computation
// ---------------------------------------------------------------------------

/**
 * Calculate acceptance rate for a single record.
 * Returns null if either applicants or admits is null, or applicants is 0.
 */
export function calculateAcceptanceRate(
  applicants: number | null,
  admits: number | null,
): number | null {
  if (applicants === null || admits === null || applicants === 0) {
    return null;
  }
  return admits / applicants;
}

/**
 * Add computed acceptance rates to enriched records.
 */
export function addAcceptanceRates(
  records: EnrichedRecord[],
): ComputedRecord[] {
  return records.map((record) => ({
    ...record,
    acceptanceRate: calculateAcceptanceRate(
      record.applicants,
      record.admits,
    ),
  }));
}

// ---------------------------------------------------------------------------
// Aggregate computation
// ---------------------------------------------------------------------------

/**
 * Compute the median of a sorted array of numbers.
 */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

/**
 * Compute group aggregate statistics for a set of records of a given school type.
 *
 * Records with null applicants/admits are excluded from totals and rate calculations.
 */
export function computeGroupAggregate(
  records: ComputedRecord[],
  schoolType: "public" | "private",
): GroupAggregate {
  const filtered = records.filter((r) => r.schoolType === schoolType);

  if (filtered.length === 0) {
    return {
      schoolCount: 0,
      totalApplicants: 0,
      totalAdmits: 0,
      acceptanceRate: 0,
      meanSchoolAcceptanceRate: 0,
      medianSchoolAcceptanceRate: 0,
      meanGpa: 0,
    };
  }

  // Unique schools
  const schoolIds = new Set(filtered.map((r) => r.schoolId));

  // Totals (exclude null values)
  let totalApplicants = 0;
  let totalAdmits = 0;
  const perSchoolRates: number[] = [];
  let gpaWeightedSum = 0;
  let gpaWeightTotal = 0;

  for (const record of filtered) {
    if (record.applicants !== null) {
      totalApplicants += record.applicants;

      if (record.gpaApplicants !== null) {
        gpaWeightedSum += record.gpaApplicants * record.applicants;
        gpaWeightTotal += record.applicants;
      }
    }

    if (record.admits !== null) {
      totalAdmits += record.admits;
    }

    if (record.acceptanceRate !== null) {
      perSchoolRates.push(record.acceptanceRate);
    }
  }

  const acceptanceRate =
    totalApplicants > 0 ? totalAdmits / totalApplicants : 0;

  const meanSchoolAcceptanceRate =
    perSchoolRates.length > 0
      ? perSchoolRates.reduce((sum, r) => sum + r, 0) / perSchoolRates.length
      : 0;

  const medianSchoolAcceptanceRate = median(perSchoolRates);

  const meanGpa = gpaWeightTotal > 0 ? gpaWeightedSum / gpaWeightTotal : 0;

  return {
    schoolCount: schoolIds.size,
    totalApplicants,
    totalAdmits,
    acceptanceRate,
    meanSchoolAcceptanceRate,
    medianSchoolAcceptanceRate,
    meanGpa,
  };
}

// ---------------------------------------------------------------------------
// Campus summary computation
// ---------------------------------------------------------------------------

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

/**
 * Compute campus summaries for all campus/year combinations.
 */
export function computeCampusSummaries(
  records: ComputedRecord[],
): CampusSummary[] {
  // Group records by campus and year
  const groups = new Map<string, ComputedRecord[]>();
  for (const record of records) {
    const key = `${record.campus}|${record.year}`;
    const group = groups.get(key);
    if (group) {
      group.push(record);
    } else {
      groups.set(key, [record]);
    }
  }

  const summaries: CampusSummary[] = [];
  for (const [key, groupRecords] of groups) {
    const [campus, yearStr] = key.split("|") as [CampusSlug, string];
    const year = parseInt(yearStr, 10);

    summaries.push({
      campus,
      campusName: CAMPUS_DISPLAY_NAMES[campus] ?? campus,
      year,
      public: computeGroupAggregate(groupRecords, "public"),
      private: computeGroupAggregate(groupRecords, "private"),
    });
  }

  // Sort by campus then year
  summaries.sort((a, b) => {
    if (a.campus !== b.campus) return a.campus.localeCompare(b.campus);
    return a.year - b.year;
  });

  return summaries;
}

// ---------------------------------------------------------------------------
// Main computation function
// ---------------------------------------------------------------------------

/**
 * Run the full metrics computation pipeline.
 *
 * @param enrichedRecords - Records from the normalization step
 * @returns Computed records with acceptance rates and campus summaries
 */
export function computePipelineMetrics(
  enrichedRecords: EnrichedRecord[],
): MetricsResult {
  const records = addAcceptanceRates(enrichedRecords);
  const summaries = computeCampusSummaries(records);

  return { records, summaries };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const inputIdx = args.indexOf("--input");
  const inputFile = inputIdx >= 0 ? args[inputIdx + 1] : undefined;

  if (!inputFile) {
    console.error(
      "Usage: tsx scripts/transform/compute-metrics.ts --input <enriched-records.json>",
    );
    process.exit(1);
  }

  try {
    const enrichedRecords: EnrichedRecord[] = JSON.parse(
      fs.readFileSync(inputFile, "utf-8"),
    );

    console.log(`Computing metrics for ${enrichedRecords.length} records...`);

    const result = computePipelineMetrics(enrichedRecords);

    console.log(`Computed ${result.summaries.length} campus/year summaries`);

    // Output JSON to stdout
    console.log(JSON.stringify(result, null, 2));
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
  (process.argv[1].endsWith("compute-metrics.ts") ||
    process.argv[1].endsWith("compute-metrics.js"));
if (isMainModule) {
  main();
}
