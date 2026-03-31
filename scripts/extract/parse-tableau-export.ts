/**
 * S04: Tableau CSV/Excel export parser
 *
 * Reads Tableau CSV and Excel exports from the UC Information Center
 * and produces structured arrays of raw admission records.
 *
 * Supports two formats:
 *   1. Actual Tableau format: separate ethnicity CSV (pivoted App/Adm/Enr rows)
 *      and GPA CSV files, detected by filename pattern (fr_eth_*, fr_gpa_*)
 *   2. Generic flat format: single CSV with columns like School, Campus, Year,
 *      Applicants, Admits, etc. (used in tests/older exports)
 *
 * Usage (CLI):
 *   tsx scripts/extract/parse-tableau-export.ts --input ./raw-data/uc
 *
 * Usage (module):
 *   import { parseTableauExports } from './parse-tableau-export.ts';
 *   const records = await parseTableauExports('./raw-data/uc');
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { parse as csvParse } from "csv-parse/sync";
import * as XLSX from "xlsx";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Raw parsed row from a Tableau export before normalization */
export interface RawAdmissionRecord {
  school: string;
  campus: string;
  year: number;
  applicants: number | null;
  admits: number | null;
  enrollees: number | null;
  gpaApplicants: number | null;
  gpaAdmits: number | null;
  gpaEnrollees: number | null;
  /** School type from UC data (ca_public → public, ca_private → private) */
  schoolType?: "public" | "private";
  /** City from UC data */
  city?: string;
  /** County from UC data */
  county?: string;
}

/** Result from parsing a single file */
export interface ParseResult {
  file: string;
  records: RawAdmissionRecord[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Column mapping (generic/legacy format)
// ---------------------------------------------------------------------------

/**
 * Maps various Tableau column naming conventions to our normalized field names.
 * Keys are lowercase versions of source column names.
 */
const COLUMN_ALIASES: Record<string, keyof RawAdmissionRecord> = {
  // School name
  school: "school",
  "source school": "school",
  "high school": "school",
  "school name": "school",

  // Campus name
  campus: "campus",
  "uc campus": "campus",
  "campus name": "campus",

  // Year
  year: "year",
  "admit year": "year",
  "academic year": "year",
  "fall year": "year",

  // Applicants
  applicants: "applicants",
  "# applicants": "applicants",
  "num applicants": "applicants",
  "number of applicants": "applicants",
  apps: "applicants",

  // Admits
  admits: "admits",
  admitted: "admits",
  "# admitted": "admits",
  "# admits": "admits",
  "num admits": "admits",
  "number of admits": "admits",
  "number admitted": "admits",

  // Enrollees
  enrollees: "enrollees",
  enrolled: "enrollees",
  "# enrolled": "enrollees",
  "# enrollees": "enrollees",
  "num enrollees": "enrollees",
  "number of enrollees": "enrollees",
  "number enrolled": "enrollees",

  // GPA fields
  "gpa applicants": "gpaApplicants",
  "applicant gpa": "gpaApplicants",
  "mean gpa applicants": "gpaApplicants",
  "avg gpa applicants": "gpaApplicants",

  "gpa admits": "gpaAdmits",
  "admit gpa": "gpaAdmits",
  "mean gpa admits": "gpaAdmits",
  "avg gpa admits": "gpaAdmits",

  "gpa enrollees": "gpaEnrollees",
  "enrollee gpa": "gpaEnrollees",
  "mean gpa enrollees": "gpaEnrollees",
  "avg gpa enrollees": "gpaEnrollees",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Strip a UTF-8 BOM from the beginning of a string if present.
 */
function stripBom(text: string): string {
  if (text.charCodeAt(0) === 0xfeff) {
    return text.slice(1);
  }
  return text;
}

/**
 * Map raw CSV/Excel header names to normalized field names.
 * Returns a mapping of source column index to target field name.
 */
export function mapColumns(
  headers: string[],
): Map<number, keyof RawAdmissionRecord> {
  const mapping = new Map<number, keyof RawAdmissionRecord>();
  for (let i = 0; i < headers.length; i++) {
    const normalized = headers[i]!.toLowerCase().trim();
    const field = COLUMN_ALIASES[normalized];
    if (field) {
      mapping.set(i, field);
    }
  }
  return mapping;
}

/**
 * Parse a numeric value from a CSV cell.
 * Returns null for suppressed data (marked with "*", empty, or non-numeric).
 */
export function parseNumericValue(
  value: string | number | undefined | null,
): number | null {
  if (value === undefined || value === null) return null;

  // If already a number (from xlsx), handle it directly
  if (typeof value === "number") {
    return isNaN(value) ? null : value;
  }

  const trimmed = value.trim();

  // Suppressed data indicators
  if (trimmed === "" || trimmed === "*" || trimmed === "-" || trimmed === "N/A") {
    return null;
  }

  // Remove commas from numbers (e.g., "1,234")
  const cleaned = trimmed.replace(/,/g, "");
  const num = Number(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Parse a single row of data into a RawAdmissionRecord.
 * Returns null if required fields (school, campus, year) are missing.
 */
export function parseRow(
  row: Record<string, string | number>,
  columnMapping: Map<number, keyof RawAdmissionRecord>,
  headers: string[],
  rowIndex: number,
): { record: RawAdmissionRecord | null; warning: string | null } {
  // Build a field-value map from the row using column mapping
  const fields: Partial<Record<keyof RawAdmissionRecord, string | number>> = {};
  for (let i = 0; i < headers.length; i++) {
    const field = columnMapping.get(i);
    if (field) {
      fields[field] = row[headers[i]!] as string | number;
    }
  }

  // Validate required fields
  const school =
    fields.school !== undefined ? String(fields.school).trim() : "";
  const campus =
    fields.campus !== undefined ? String(fields.campus).trim() : "";
  const yearVal = parseNumericValue(fields.year as string | number | undefined);

  if (!school || !campus || yearVal === null) {
    const missing: string[] = [];
    if (!school) missing.push("school");
    if (!campus) missing.push("campus");
    if (yearVal === null) missing.push("year");
    return {
      record: null,
      warning: `Row ${rowIndex + 1}: Missing required field(s): ${missing.join(", ")}`,
    };
  }

  return {
    record: {
      school,
      campus,
      year: yearVal,
      applicants: parseNumericValue(
        fields.applicants as string | number | undefined,
      ),
      admits: parseNumericValue(fields.admits as string | number | undefined),
      enrollees: parseNumericValue(
        fields.enrollees as string | number | undefined,
      ),
      gpaApplicants: parseNumericValue(
        fields.gpaApplicants as string | number | undefined,
      ),
      gpaAdmits: parseNumericValue(
        fields.gpaAdmits as string | number | undefined,
      ),
      gpaEnrollees: parseNumericValue(
        fields.gpaEnrollees as string | number | undefined,
      ),
    },
    warning: null,
  };
}

// ---------------------------------------------------------------------------
// Generic CSV Parsing (legacy/test format)
// ---------------------------------------------------------------------------

/**
 * Parse a Tableau CSV export file (generic flat format).
 */
export function parseCsvFile(filePath: string): ParseResult {
  const warnings: string[] = [];
  const records: RawAdmissionRecord[] = [];

  let content: string;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    content = stripBom(raw);
  } catch (err) {
    return {
      file: filePath,
      records: [],
      warnings: [
        `Failed to read file: ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  }

  let rows: Record<string, string>[];
  try {
    rows = csvParse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    }) as Record<string, string>[];
  } catch (err) {
    return {
      file: filePath,
      records: [],
      warnings: [
        `Failed to parse CSV: ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  }

  if (rows.length === 0) {
    return { file: filePath, records: [], warnings: ["File contains no data rows"] };
  }

  // Get headers from the first row's keys
  const headers = Object.keys(rows[0]!);
  const columnMapping = mapColumns(headers);

  // Verify we have the required columns mapped
  const mappedFields = new Set(columnMapping.values());
  const requiredFields: (keyof RawAdmissionRecord)[] = [
    "school",
    "campus",
    "year",
  ];
  const missingRequired = requiredFields.filter((f) => !mappedFields.has(f));
  if (missingRequired.length > 0) {
    warnings.push(
      `Missing required columns: ${missingRequired.join(", ")}. Found columns: ${headers.join(", ")}`,
    );
    return { file: filePath, records: [], warnings };
  }

  // Parse each row
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const { record, warning } = parseRow(row, columnMapping, headers, i);
    if (warning) {
      warnings.push(warning);
    }
    if (record) {
      records.push(record);
    }
  }

  return { file: filePath, records, warnings };
}

// ---------------------------------------------------------------------------
// Excel Parsing
// ---------------------------------------------------------------------------

/**
 * Parse a Tableau Excel (.xlsx) export file.
 */
export function parseExcelFile(filePath: string): ParseResult {
  const warnings: string[] = [];
  const records: RawAdmissionRecord[] = [];

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.readFile(filePath);
  } catch (err) {
    return {
      file: filePath,
      records: [],
      warnings: [
        `Failed to read Excel file: ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  }

  // Process the first sheet
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return {
      file: filePath,
      records: [],
      warnings: ["Excel file contains no sheets"],
    };
  }

  const sheet = workbook.Sheets[sheetName]!;
  const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet);

  if (rows.length === 0) {
    return {
      file: filePath,
      records: [],
      warnings: ["Excel sheet contains no data rows"],
    };
  }

  // Get headers from the first row's keys
  const headers = Object.keys(rows[0]!);
  const columnMapping = mapColumns(headers);

  // Verify required columns
  const mappedFields = new Set(columnMapping.values());
  const requiredFields: (keyof RawAdmissionRecord)[] = [
    "school",
    "campus",
    "year",
  ];
  const missingRequired = requiredFields.filter((f) => !mappedFields.has(f));
  if (missingRequired.length > 0) {
    warnings.push(
      `Missing required columns: ${missingRequired.join(", ")}. Found columns: ${headers.join(", ")}`,
    );
    return { file: filePath, records: [], warnings };
  }

  // Parse each row
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const { record, warning } = parseRow(row, columnMapping, headers, i);
    if (warning) {
      warnings.push(warning);
    }
    if (record) {
      records.push(record);
    }
  }

  return { file: filePath, records, warnings };
}

// ---------------------------------------------------------------------------
// Actual Tableau Format Parsing (ethnicity + GPA CSVs)
// ---------------------------------------------------------------------------

/** Generate a merge key for school+campus+year */
function recordKey(school: string, campus: string, year: number): string {
  return `${school}\t${campus}\t${year}`;
}

/** Parse school_type column value to typed enum */
function parseSchoolType(val: string): "public" | "private" {
  return val.toLowerCase().includes("private") ? "private" : "public";
}

/**
 * Find a column value case-insensitively from a CSV row.
 * Tries exact match first, then case-insensitive.
 */
function getField(row: Record<string, string>, ...candidates: string[]): string {
  for (const key of candidates) {
    if (row[key] !== undefined) return row[key]!;
  }
  // Case-insensitive fallback
  const rowKeys = Object.keys(row);
  const lowerCandidates = candidates.map((c) => c.toLowerCase());
  for (const key of rowKeys) {
    if (lowerCandidates.includes(key.toLowerCase())) return row[key]!;
  }
  return "";
}

/**
 * Find a column value by partial match (for columns like "County/State/ Country").
 */
function getFieldByPattern(row: Record<string, string>, pattern: string): string {
  const lower = pattern.toLowerCase();
  for (const key of Object.keys(row)) {
    if (key.toLowerCase().includes(lower)) return row[key]!;
  }
  return "";
}

/** Intermediate record from ethnicity CSV before merging */
interface EthPartialRecord {
  school: string;
  campus: string;
  year: number;
  schoolType: "public" | "private";
  city: string;
  county: string;
  applicants: number | null;
  admits: number | null;
  enrollees: number | null;
}

/**
 * Parse a UC ethnicity CSV file (actual Tableau format).
 *
 * Format: Each school/campus/year has up to 3 rows (Count=App, Adm, Enr).
 * The "All" column contains the total count for that count type.
 * Per-campus files have a "campus" column; universitywide files do not.
 */
export function parseEthnicityCsv(filePath: string): {
  records: Map<string, EthPartialRecord>;
  warnings: string[];
} {
  const warnings: string[] = [];
  const recordMap = new Map<string, EthPartialRecord>();

  let content: string;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    content = stripBom(raw);
  } catch (err) {
    return {
      records: recordMap,
      warnings: [`Failed to read file: ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  let rows: Record<string, string>[];
  try {
    rows = csvParse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    }) as Record<string, string>[];
  } catch (err) {
    return {
      records: recordMap,
      warnings: [`Failed to parse CSV: ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  if (rows.length === 0) {
    return { records: recordMap, warnings: ["File contains no data rows"] };
  }

  // Detect if this is a per-campus file (has 'campus' column)
  const headers = Object.keys(rows[0]!);
  const hasCampusCol = headers.some((h) => h.toLowerCase() === "campus");

  let rowCount = 0;
  for (const row of rows) {
    const school = getField(row, "School", "school").trim();
    const campus = hasCampusCol
      ? getField(row, "campus", "Campus").trim()
      : "Systemwide";
    const yearStr = getField(row, "year", "Year").trim();
    const year = parseInt(yearStr, 10);

    if (!school || !year || isNaN(year)) continue;

    const countType = getField(row, "Count", "count").trim();
    const allValue = parseNumericValue(getField(row, "All", "all"));
    const schoolType = parseSchoolType(getField(row, "school_type", "School_Type"));
    const city = getField(row, "City", "city").trim();
    const county = getFieldByPattern(row, "county").trim();

    const key = recordKey(school, campus, year);
    let rec = recordMap.get(key);
    if (!rec) {
      rec = {
        school,
        campus,
        year,
        schoolType,
        city,
        county,
        applicants: null,
        admits: null,
        enrollees: null,
      };
      recordMap.set(key, rec);
    }

    const countLower = countType.toLowerCase();
    if (countLower === "app") {
      rec.applicants = allValue;
    } else if (countLower === "adm") {
      rec.admits = allValue;
    } else if (countLower === "enr") {
      rec.enrollees = allValue;
    }

    rowCount++;
  }

  console.log(`  Parsed ${rowCount} ethnicity rows → ${recordMap.size} school/campus/year records`);
  return { records: recordMap, warnings };
}

/** GPA data for a single school/campus/year */
interface GpaData {
  gpaApplicants: number | null;
  gpaAdmits: number | null;
  gpaEnrollees: number | null;
}

/**
 * Parse a UC GPA CSV file (actual Tableau format).
 *
 * Format: One row per school/campus/year with App GPA, Adm GPA, Enrl GPA.
 * Per-campus files have a "campus" column; universitywide files do not.
 */
export function parseGpaCsv(filePath: string): {
  gpaMap: Map<string, GpaData>;
  warnings: string[];
} {
  const warnings: string[] = [];
  const gpaMap = new Map<string, GpaData>();

  let content: string;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    content = stripBom(raw);
  } catch (err) {
    return {
      gpaMap,
      warnings: [`Failed to read file: ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  let rows: Record<string, string>[];
  try {
    rows = csvParse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    }) as Record<string, string>[];
  } catch (err) {
    return {
      gpaMap,
      warnings: [`Failed to parse CSV: ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  if (rows.length === 0) {
    return { gpaMap, warnings: ["File contains no data rows"] };
  }

  // Detect if this is a per-campus file
  const headers = Object.keys(rows[0]!);
  const hasCampusCol = headers.some((h) => h.toLowerCase() === "campus");

  let rowCount = 0;
  for (const row of rows) {
    const school = getField(row, "School", "school").trim();
    const campus = hasCampusCol
      ? getField(row, "campus", "Campus").trim()
      : "Systemwide";
    const yearStr = getField(row, "year", "Year").trim();
    const year = parseInt(yearStr, 10);

    if (!school || !year || isNaN(year)) continue;

    const key = recordKey(school, campus, year);
    gpaMap.set(key, {
      gpaApplicants: parseNumericValue(getField(row, "App GPA", "app gpa")),
      gpaAdmits: parseNumericValue(getField(row, "Adm GPA", "adm gpa")),
      gpaEnrollees: parseNumericValue(getField(row, "Enrl GPA", "enrl gpa")),
    });

    rowCount++;
  }

  console.log(`  Parsed ${rowCount} GPA rows`);
  return { gpaMap, warnings };
}

/**
 * Merge ethnicity records with GPA data into complete RawAdmissionRecords.
 */
function mergeEthAndGpa(
  ethRecords: Map<string, EthPartialRecord>,
  gpaMap: Map<string, GpaData>,
): RawAdmissionRecord[] {
  const merged: RawAdmissionRecord[] = [];

  for (const [key, eth] of ethRecords) {
    const gpa = gpaMap.get(key);
    merged.push({
      school: eth.school,
      campus: eth.campus,
      year: eth.year,
      applicants: eth.applicants,
      admits: eth.admits,
      enrollees: eth.enrollees,
      gpaApplicants: gpa?.gpaApplicants ?? null,
      gpaAdmits: gpa?.gpaAdmits ?? null,
      gpaEnrollees: gpa?.gpaEnrollees ?? null,
      schoolType: eth.schoolType,
      city: eth.city,
      county: eth.county,
    });
  }

  return merged;
}

/**
 * Parse actual Tableau format files (ethnicity + GPA CSVs).
 */
async function parseActualTableauFormat(
  inputDir: string,
  ethFiles: string[],
  gpaFiles: string[],
): Promise<{ records: RawAdmissionRecord[]; warnings: string[] }> {
  const allWarnings: string[] = [];
  const combinedEth = new Map<string, EthPartialRecord>();
  const combinedGpa = new Map<string, GpaData>();

  // Parse ethnicity files
  for (const file of ethFiles) {
    const filePath = path.join(inputDir, file);
    console.log(`Parsing ethnicity: ${file}...`);
    const { records, warnings } = parseEthnicityCsv(filePath);
    for (const [key, rec] of records) {
      combinedEth.set(key, rec);
    }
    allWarnings.push(...warnings.map((w) => `[${file}] ${w}`));
  }

  // Parse GPA files
  for (const file of gpaFiles) {
    const filePath = path.join(inputDir, file);
    console.log(`Parsing GPA: ${file}...`);
    const { gpaMap, warnings } = parseGpaCsv(filePath);
    for (const [key, gpa] of gpaMap) {
      combinedGpa.set(key, gpa);
    }
    allWarnings.push(...warnings.map((w) => `[${file}] ${w}`));
  }

  // Merge
  const records = mergeEthAndGpa(combinedEth, combinedGpa);
  console.log(`  Merged: ${records.length} records (${combinedGpa.size} with GPA data)`);

  return { records, warnings: allWarnings };
}

// ---------------------------------------------------------------------------
// Directory Parsing (main entry point)
// ---------------------------------------------------------------------------

/**
 * Parse all Tableau CSV and Excel exports from a directory.
 *
 * Auto-detects the format:
 * - If fr_eth_*.csv files are found, uses the actual Tableau format parser
 *   (ethnicity + GPA CSVs with pivoted rows)
 * - Otherwise, falls back to generic flat CSV/Excel parsing
 */
export async function parseTableauExports(
  inputDir: string,
): Promise<{ records: RawAdmissionRecord[]; warnings: string[] }> {
  if (!fs.existsSync(inputDir)) {
    throw new Error(`Input directory does not exist: ${inputDir}`);
  }

  const files = fs.readdirSync(inputDir);

  // Detect actual Tableau format by looking for specific merged files
  const ethFiles = files.filter((f) =>
    /^fr_eth_(by_campus|all)\.csv$/i.test(f),
  );
  const gpaFiles = files.filter((f) =>
    /^fr_gpa_(by_campus|all)\.csv$/i.test(f),
  );

  if (ethFiles.length > 0) {
    console.log(`Detected actual Tableau format: ${ethFiles.length} ethnicity files, ${gpaFiles.length} GPA files`);
    return parseActualTableauFormat(inputDir, ethFiles, gpaFiles);
  }

  // Fall back to generic parsing
  const dataFiles = files.filter((f) => {
    const ext = path.extname(f).toLowerCase();
    return ext === ".csv" || ext === ".xlsx" || ext === ".xls";
  });

  if (dataFiles.length === 0) {
    throw new Error(
      `No CSV or Excel files found in directory: ${inputDir}`,
    );
  }

  const allRecords: RawAdmissionRecord[] = [];
  const allWarnings: string[] = [];

  for (const file of dataFiles) {
    const filePath = path.join(inputDir, file);
    const ext = path.extname(file).toLowerCase();

    console.log(`Parsing ${file}...`);

    let result: ParseResult;
    if (ext === ".csv") {
      result = parseCsvFile(filePath);
    } else {
      result = parseExcelFile(filePath);
    }

    allRecords.push(...result.records);
    allWarnings.push(
      ...result.warnings.map((w) => `[${file}] ${w}`),
    );

    console.log(
      `  -> ${result.records.length} records, ${result.warnings.length} warnings`,
    );
  }

  return { records: allRecords, warnings: allWarnings };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const inputIdx = args.indexOf("--input");
  const inputDir = inputIdx >= 0 ? args[inputIdx + 1] : undefined;

  if (!inputDir) {
    console.error("Usage: tsx scripts/extract/parse-tableau-export.ts --input <directory>");
    process.exit(1);
  }

  try {
    const { records, warnings } = await parseTableauExports(inputDir);

    if (warnings.length > 0) {
      console.log("\nWarnings:");
      for (const w of warnings) {
        console.warn(`  ${w}`);
      }
    }

    console.log(`\nTotal: ${records.length} admission records parsed`);
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
  (process.argv[1].endsWith("parse-tableau-export.ts") ||
    process.argv[1].endsWith("parse-tableau-export.js"));
if (isMainModule) {
  main();
}
