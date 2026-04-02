/**
 * CDE School Quality Data Parser
 *
 * Parses California Department of Education accountability and quality data files
 * and produces a Map<cds, SchoolQuality> keyed by 14-digit CDS code.
 *
 * Supported data sources:
 *   - CCI (College/Career Indicator)
 *   - ACGR (Adjusted Cohort Graduation Rate)
 *   - CAASPP (Smarter Balanced Assessments)
 *   - CGR (College-Going Rate)
 *   - Chronic (Chronic Absenteeism)
 *   - Suspension
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { parse } from "csv-parse/sync";
import type { SchoolQuality } from "../../src/types/index.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse a numeric value, returning undefined for suppressed/invalid values */
function parseNum(val: string | undefined): number | undefined {
  if (val === undefined || val === null) return undefined;
  const trimmed = val.trim();
  if (trimmed === "" || trimmed === "*" || trimmed === "--" || trimmed === "N/A") return undefined;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : undefined;
}

/** Zero-pad and concatenate county/district/school codes into a 14-digit CDS code */
function buildCds(county: string, district: string, school: string): string {
  return (
    (county ?? "").trim().padStart(2, "0") +
    (district ?? "").trim().padStart(5, "0") +
    (school ?? "").trim().padStart(7, "0")
  );
}

/** Read and parse a tab-delimited file */
function readTabFile(filePath: string): Record<string, string>[] {
  const content = fs.readFileSync(filePath, "utf-8");
  return parse(content, {
    delimiter: "\t",
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  }) as Record<string, string>[];
}

/** Read and parse a caret-delimited file (CAASPP) */
function readCaretFile(filePath: string): Record<string, string>[] {
  const content = fs.readFileSync(filePath, "utf-8");
  return parse(content, {
    delimiter: "^",
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  }) as Record<string, string>[];
}

/** Find the most recently modified .txt file in a directory */
function findMostRecentTxt(dir: string): string | undefined {
  if (!fs.existsSync(dir)) return undefined;

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".txt"))
    .map((f) => ({
      name: f,
      mtime: fs.statSync(path.join(dir, f)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);

  return files.length > 0 ? path.join(dir, files[0].name) : undefined;
}

// ---------------------------------------------------------------------------
// CCI Parser
// ---------------------------------------------------------------------------

/**
 * Parse the CCI (College/Career Indicator) download file.
 *
 * Columns: cds, rtype, studentgroup, currstatus (% Prepared),
 *          curr_aprep_pct (% Approaching), curr_nprep_pct (% Not Prepared)
 * Filter: rtype === "S" (school level) AND studentgroup === "ALL"
 */
export function parseCciFile(filePath: string): Map<string, Partial<SchoolQuality>> {
  const result = new Map<string, Partial<SchoolQuality>>();
  const rows = readTabFile(filePath);

  for (const row of rows) {
    if (row["rtype"] !== "S" || row["studentgroup"] !== "ALL") continue;

    const cds = (row["cds"] ?? "").trim();
    if (cds.length !== 14) continue;

    const cci = parseNum(row["currstatus"]);
    const cciApproaching = parseNum(row["curr_aprep_pct"]);
    const cciNotPrepared = parseNum(row["curr_nprep_pct"]);

    if (cci === undefined && cciApproaching === undefined && cciNotPrepared === undefined) continue;

    const quality: Partial<SchoolQuality> = {};
    if (cci !== undefined) quality.cci = cci;
    if (cciApproaching !== undefined) quality.cciApproaching = cciApproaching;
    if (cciNotPrepared !== undefined) quality.cciNotPrepared = cciNotPrepared;

    result.set(cds, quality);
  }

  return result;
}

// ---------------------------------------------------------------------------
// ACGR Parser
// ---------------------------------------------------------------------------

/**
 * Parse the ACGR (Adjusted Cohort Graduation Rate) file.
 *
 * Columns: AggregateLevel, CountyCode, DistrictCode, SchoolCode, ReportingCategory,
 *          Regular HS Diploma Graduates (Rate), Met UC/CSU Grad Req's (Rate), Dropout (Rate)
 * Filter: AggregateLevel === "S" AND ReportingCategory === "TA"
 */
export function parseAcgrFile(filePath: string): Map<string, Partial<SchoolQuality>> {
  const result = new Map<string, Partial<SchoolQuality>>();
  const rows = readTabFile(filePath);

  for (const row of rows) {
    if (row["AggregateLevel"] !== "S" || row["ReportingCategory"] !== "TA") continue;

    const cds = buildCds(row["CountyCode"], row["DistrictCode"], row["SchoolCode"]);
    if (cds.length !== 14) continue;

    const gradRate = parseNum(row["Regular HS Diploma Graduates (Rate)"]);
    const agRate = parseNum(row["Met UC/CSU Grad Req's (Rate)"]);
    const dropoutRate = parseNum(row["Dropout (Rate)"]);

    if (gradRate === undefined && agRate === undefined && dropoutRate === undefined) continue;

    const quality: Partial<SchoolQuality> = {};
    if (gradRate !== undefined) quality.gradRate = gradRate;
    if (agRate !== undefined) quality.agRate = agRate;
    if (dropoutRate !== undefined) quality.dropoutRate = dropoutRate;

    result.set(cds, quality);
  }

  return result;
}

// ---------------------------------------------------------------------------
// CAASPP Parser
// ---------------------------------------------------------------------------

/**
 * Parse the CAASPP (Smarter Balanced) results file.
 * NOTE: This file is caret-delimited (^), not tab-delimited.
 *
 * Columns: County Code, District Code, School Code, Type ID, Test ID,
 *          Student Group ID, Grade, Mean Scale Score, Percentage Standard Met and Above
 * Filter: Type ID === "7" (school) AND Student Group ID === "1" (all students)
 *         AND Grade === "11" (grade 11)
 * Test ID "1" = ELA, Test ID "2" = Math
 */
export function parseCaasppFile(filePath: string): Map<string, Partial<SchoolQuality>> {
  const result = new Map<string, Partial<SchoolQuality>>();
  const rows = readCaretFile(filePath);

  for (const row of rows) {
    if (
      row["Type ID"] !== "7" ||
      row["Student Group ID"] !== "1" ||
      row["Grade"] !== "11"
    ) continue;

    const cds = buildCds(row["County Code"], row["District Code"], row["School Code"]);
    if (cds.length !== 14) continue;

    const testId = row["Test ID"];
    const meanScore = parseNum(row["Mean Scale Score"]);
    const pctMetAbove = parseNum(row["Percentage Standard Met and Above"]);

    if (meanScore === undefined && pctMetAbove === undefined) continue;

    const existing = result.get(cds) ?? {};

    if (testId === "1") {
      // ELA
      if (meanScore !== undefined) existing.caasppEla = meanScore;
      if (pctMetAbove !== undefined) existing.caasppElaPctMet = pctMetAbove;
    } else if (testId === "2") {
      // Math
      if (meanScore !== undefined) existing.caasppMath = meanScore;
      if (pctMetAbove !== undefined) existing.caasppMathPctMet = pctMetAbove;
    }

    result.set(cds, existing);
  }

  return result;
}

// ---------------------------------------------------------------------------
// CGR Parser
// ---------------------------------------------------------------------------

/**
 * Parse the CGR (College-Going Rate) file.
 *
 * Columns: AggregateLevel, CountyCode, DistrictCode, SchoolCode,
 *          ReportingCategory, CompleterType,
 *          College Going Rate - Total (12 Months),
 *          Enrolled UC (12 Months), Enrolled CSU (12 Months)
 * Filter: AggregateLevel === "S" AND ReportingCategory === "TA"
 *         AND CompleterType === "TA" (total all completer types)
 */
export function parseCgrFile(filePath: string): Map<string, Partial<SchoolQuality>> {
  const result = new Map<string, Partial<SchoolQuality>>();
  const rows = readTabFile(filePath);

  for (const row of rows) {
    if (
      row["AggregateLevel"] !== "S" ||
      row["ReportingCategory"] !== "TA" ||
      row["CompleterType"] !== "TA"
    ) continue;

    const cds = buildCds(row["CountyCode"], row["DistrictCode"], row["SchoolCode"]);
    if (cds.length !== 14) continue;

    const collegeGoingRate = parseNum(row["College Going Rate - Total (12 Months)"]);
    const collegeGoingUC = parseNum(row["Enrolled UC (12 Months)"]);
    const collegeGoingCSU = parseNum(row["Enrolled CSU (12 Months)"]);

    if (collegeGoingRate === undefined && collegeGoingUC === undefined && collegeGoingCSU === undefined) continue;

    const quality: Partial<SchoolQuality> = {};
    if (collegeGoingRate !== undefined) quality.collegeGoingRate = collegeGoingRate;
    if (collegeGoingUC !== undefined) quality.collegeGoingUC = collegeGoingUC;
    if (collegeGoingCSU !== undefined) quality.collegeGoingCSU = collegeGoingCSU;

    result.set(cds, quality);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Chronic Absenteeism Parser
// ---------------------------------------------------------------------------

/**
 * Parse the Chronic Absenteeism download file.
 *
 * Columns: cds, rtype, studentgroup, currstatus
 * Filter: rtype === "S" AND studentgroup === "ALL"
 */
export function parseChronicFile(filePath: string): Map<string, Partial<SchoolQuality>> {
  const result = new Map<string, Partial<SchoolQuality>>();
  const rows = readTabFile(filePath);

  for (const row of rows) {
    if (row["rtype"] !== "S" || row["studentgroup"] !== "ALL") continue;

    const cds = (row["cds"] ?? "").trim();
    if (cds.length !== 14) continue;

    const chronicAbsentRate = parseNum(row["currstatus"]);
    if (chronicAbsentRate === undefined) continue;

    result.set(cds, { chronicAbsentRate });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Suspension Parser
// ---------------------------------------------------------------------------

/**
 * Parse the Suspension download file.
 *
 * Columns: cds, rtype, type, studentgroup, currstatus
 * Filter: rtype === "S" AND studentgroup === "ALL"
 * The `type` column indicates count type — we use "UD" (unduplicated) which
 * is the standard suspension rate metric.
 */
export function parseSuspensionFile(filePath: string): Map<string, Partial<SchoolQuality>> {
  const result = new Map<string, Partial<SchoolQuality>>();
  const rows = readTabFile(filePath);

  for (const row of rows) {
    if (row["rtype"] !== "S" || row["studentgroup"] !== "ALL" || row["type"] !== "UD") continue;

    const cds = (row["cds"] ?? "").trim();
    if (cds.length !== 14) continue;

    const suspensionRate = parseNum(row["currstatus"]);
    if (suspensionRate === undefined) continue;

    result.set(cds, { suspensionRate });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Merge
// ---------------------------------------------------------------------------

/**
 * Merge multiple partial SchoolQuality maps into a single complete map.
 * Later maps override earlier maps for the same field, but in practice each
 * source contributes distinct fields.
 */
export function mergeCdeQuality(
  ...maps: Map<string, Partial<SchoolQuality>>[]
): Map<string, SchoolQuality> {
  const merged = new Map<string, SchoolQuality>();

  for (const map of maps) {
    for (const [cds, partial] of map) {
      const existing = merged.get(cds) ?? ({} as SchoolQuality);
      merged.set(cds, { ...existing, ...partial });
    }
  }

  return merged;
}

// ---------------------------------------------------------------------------
// Top-level loader
// ---------------------------------------------------------------------------

/**
 * Load all CDE quality data from a base directory.
 * Expects subdirectories: cci/, acgr/, caaspp/, cgr/, chronic/, suspension/
 * Each subdirectory may contain one or more .txt files; the most recently
 * modified one is used.
 */
export function loadCdeQualityData(cdeDir: string): Map<string, SchoolQuality> {
  const maps: Map<string, Partial<SchoolQuality>>[] = [];

  const sources: {
    name: string;
    subdir: string;
    parser: (filePath: string) => Map<string, Partial<SchoolQuality>>;
  }[] = [
    { name: "CCI", subdir: "cci", parser: parseCciFile },
    { name: "ACGR", subdir: "acgr", parser: parseAcgrFile },
    { name: "CAASPP", subdir: "caaspp", parser: parseCaasppFile },
    { name: "CGR", subdir: "cgr", parser: parseCgrFile },
    { name: "Chronic", subdir: "chronic", parser: parseChronicFile },
    { name: "Suspension", subdir: "suspension", parser: parseSuspensionFile },
  ];

  for (const source of sources) {
    const dir = path.join(cdeDir, source.subdir);
    const filePath = findMostRecentTxt(dir);

    if (!filePath) {
      console.log(`  CDE Quality: ${source.name} — no data file found in ${dir}`);
      continue;
    }

    try {
      const map = source.parser(filePath);
      console.log(`  CDE Quality: ${source.name} — ${map.size} schools from ${path.basename(filePath)}`);
      maps.push(map);
    } catch (err) {
      console.warn(
        `  CDE Quality: ${source.name} — error parsing ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return mergeCdeQuality(...maps);
}
