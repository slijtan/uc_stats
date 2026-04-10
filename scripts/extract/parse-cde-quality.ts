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

/** Find the most recently modified .xlsx file in a directory */
function findMostRecentXlsx(dir: string): string | undefined {
  if (!fs.existsSync(dir)) return undefined;

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".xlsx"))
    .map((f) => ({
      name: f,
      mtime: fs.statSync(path.join(dir, f)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);

  return files.length > 0 ? path.join(dir, files[0].name) : undefined;
}

/** Normalize column name by stripping carriage returns, newlines, and extra whitespace */
function normalizeColName(name: string): string {
  return name.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
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
    const cciPathwayAp = parseNum(row["curr_prep_ap_pct"]);
    const cciPathwayIb = parseNum(row["curr_prep_ibexam_pct"]);
    const cciPathwayCollegeCredit = parseNum(row["curr_prep_collegecredit_pct"]);
    const cciPathwayAg = parseNum(row["curr_prep_agplus_pct"]);
    const cciPathwayCte = parseNum(row["curr_prep_cteplus_pct"]);
    const cciPathwayBiliteracy = parseNum(row["curr_prep_ssb_pct"]);
    const cciPathwayMilitary = parseNum(row["curr_prep_milsci_pct"]);

    if (cci === undefined && cciApproaching === undefined && cciNotPrepared === undefined) continue;

    const quality: Partial<SchoolQuality> = {};
    if (cci !== undefined) quality.cci = cci;
    if (cciApproaching !== undefined) quality.cciApproaching = cciApproaching;
    if (cciNotPrepared !== undefined) quality.cciNotPrepared = cciNotPrepared;
    if (cciPathwayAp !== undefined) quality.cciPathwayAp = cciPathwayAp;
    if (cciPathwayIb !== undefined) quality.cciPathwayIb = cciPathwayIb;
    if (cciPathwayCollegeCredit !== undefined) quality.cciPathwayCollegeCredit = cciPathwayCollegeCredit;
    if (cciPathwayAg !== undefined) quality.cciPathwayAg = cciPathwayAg;
    if (cciPathwayCte !== undefined) quality.cciPathwayCte = cciPathwayCte;
    if (cciPathwayBiliteracy !== undefined) quality.cciPathwayBiliteracy = cciPathwayBiliteracy;
    if (cciPathwayMilitary !== undefined) quality.cciPathwayMilitary = cciPathwayMilitary;

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

    const completers = parseNum(row["High School Completers"]);
    const collegeGoingRate = parseNum(row["College Going Rate - Total (12 Months)"]);
    const collegeGoingUC = parseNum(row["Enrolled UC (12 Months)"]);
    const collegeGoingCSU = parseNum(row["Enrolled CSU (12 Months)"]);
    const enrolledCCC = parseNum(row["Enrolled CCC (12 Months)"]);
    const enrolledInStatePrivate = parseNum(row["Enrolled In-State Private (2 and 4 Year) (12 Months)"]);
    const enrolledOutOfState = parseNum(row["Enrolled Out-of-State (12 Months)"]);

    if (collegeGoingRate === undefined && collegeGoingUC === undefined && collegeGoingCSU === undefined) continue;

    const quality: Partial<SchoolQuality> = {};
    if (collegeGoingRate !== undefined) quality.collegeGoingRate = collegeGoingRate;
    if (collegeGoingUC !== undefined) quality.collegeGoingUC = collegeGoingUC;
    if (collegeGoingCSU !== undefined) quality.collegeGoingCSU = collegeGoingCSU;

    // Compute rates for institution breakdowns using completers as denominator
    if (completers !== undefined && completers > 0) {
      if (enrolledCCC !== undefined) {
        quality.collegeGoingCCC = Math.round((enrolledCCC / completers) * 1000) / 10;
      }
      if (enrolledInStatePrivate !== undefined) {
        quality.collegeGoingInStatePrivate = Math.round((enrolledInStatePrivate / completers) * 1000) / 10;
      }
      if (enrolledOutOfState !== undefined) {
        quality.collegeGoingOutOfState = Math.round((enrolledOutOfState / completers) * 1000) / 10;
      }
    }

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
// FRPM Parser
// ---------------------------------------------------------------------------

/**
 * Parse the FRPM (Free or Reduced-Price Meals) XLSX file.
 *
 * The file has a title row on the 'FRPM School-Level Data' sheet, with actual
 * column headers on row 2. Column names contain \r\n characters.
 *
 * Key columns: County Code, District Code, School Code,
 *   Percent (%) Eligible FRPM (K-12) — stored as decimal (0–1)
 */
export async function parseFrpmFile(filePath: string): Promise<Map<string, Partial<SchoolQuality>>> {
  const result = new Map<string, Partial<SchoolQuality>>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const XLSX = await import("xlsx") as any;
  const readFile = XLSX.readFile ?? XLSX.default?.readFile;
  const sheetToJson = XLSX.utils?.sheet_to_json ?? XLSX.default?.utils?.sheet_to_json;

  if (!readFile || !sheetToJson) {
    throw new Error("Failed to load xlsx library");
  }

  const workbook = readFile(filePath);

  // Find the school-level data sheet
  const sheetName = workbook.SheetNames.find(
    (n: string) => n.toLowerCase().includes("school") && n.toLowerCase().includes("data"),
  ) ?? workbook.SheetNames[1];
  if (!sheetName) {
    throw new Error(`No school-level data sheet found in ${path.basename(filePath)}`);
  }

  const sheet = workbook.Sheets[sheetName]!;
  // range: 1 skips the title row so row 2 becomes the header
  const rows = sheetToJson(sheet, { range: 1 }) as Record<string, unknown>[];

  for (const row of rows) {
    // Build a normalized lookup for column access
    const normalizedRow = new Map<string, unknown>();
    for (const [key, val] of Object.entries(row)) {
      normalizedRow.set(normalizeColName(key), val);
    }

    const countyCode = String(normalizedRow.get("county code") ?? "").trim().padStart(2, "0");
    const districtCode = String(normalizedRow.get("district code") ?? "").trim().padStart(5, "0");
    const schoolCode = String(normalizedRow.get("school code") ?? "").trim().padStart(7, "0");
    const cds = countyCode + districtCode + schoolCode;
    if (cds.length !== 14 || cds === "00000000000000") continue;

    // The percentage is stored as a decimal (0.739 = 73.9%)
    const frpmPctRaw = normalizedRow.get("percent (%) eligible frpm (k-12)");
    if (frpmPctRaw === undefined || frpmPctRaw === null || frpmPctRaw === "") continue;

    const frpmDecimal = typeof frpmPctRaw === "number"
      ? frpmPctRaw
      : Number(String(frpmPctRaw));
    if (!Number.isFinite(frpmDecimal)) continue;

    // Convert decimal to percentage, round to 1 decimal place
    const freeReducedMealPct = Math.round(frpmDecimal * 1000) / 10;

    result.set(cds, { freeReducedMealPct });
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
export async function loadCdeQualityData(cdeDir: string): Promise<Map<string, SchoolQuality>> {
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

  // FRPM (XLSX format — handled separately)
  const frpmDir = path.join(cdeDir, "frpm");
  const frpmFile = findMostRecentXlsx(frpmDir);
  if (frpmFile) {
    try {
      const frpmMap = await parseFrpmFile(frpmFile);
      console.log(`  CDE Quality: FRPM — ${frpmMap.size} schools from ${path.basename(frpmFile)}`);
      maps.push(frpmMap);
    } catch (err) {
      console.warn(
        `  CDE Quality: FRPM — error parsing ${frpmFile}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  } else {
    console.log(`  CDE Quality: FRPM — no data file found in ${frpmDir}`);
  }

  return mergeCdeQuality(...maps);
}
