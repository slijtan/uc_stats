/**
 * S05: School name normalization and UC-to-CDE matching
 *
 * Matches UC source school names to CDE (California Department of Education)
 * directory entries using a 4-stage matching pipeline:
 *   1. Exact name match
 *   2. Normalized match (lowercase, strip punctuation, standardize abbreviations)
 *   3. Jaro-Winkler similarity (>= 0.85 threshold)
 *   4. Manual override lookup
 *
 * Usage (CLI):
 *   tsx scripts/transform/normalize-schools.ts --input records.json --cde-dir ./cde-data
 *
 * Usage (module):
 *   import { normalizeSchools } from './normalize-schools.ts';
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as csvParse } from "csv-parse/sync";
// xlsx is lazily loaded to avoid module resolution conflicts
// when this file is imported alongside parse-tableau-export.ts
// (both import xlsx; ESM namespace resolution can cause issues)
// (type import removed — using `any` for dynamic xlsx import below)
// @ts-expect-error -- jaro-winkler has no type declarations
import jaroWinkler from "jaro-winkler";
import type { RawAdmissionRecord } from "../extract/parse-tableau-export.ts";
import type { CampusSlug } from "../../src/types/index.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A CDE school directory entry parsed from CDE CSV files */
export interface CdeSchoolRecord {
  cdsCode: string;
  name: string;
  city: string;
  county: string;
  schoolType: "public" | "private";
  /** 7-digit NCES district ID (from pubschls.txt) */
  ncesDist?: string;
  /** 5-digit NCES school ID (from pubschls.txt) */
  ncesSchool?: string;
}

/** An enriched admission record after matching to CDE data */
export interface EnrichedRecord {
  school: string;
  ucName: string;
  campus: CampusSlug;
  year: number;
  applicants: number | null;
  admits: number | null;
  enrollees: number | null;
  gpaApplicants: number | null;
  gpaAdmits: number | null;
  gpaEnrollees: number | null;
  /** CDE school ID (cdsCode), or generated ID for unmatched */
  schoolId: string;
  /** School type from CDE or default "public" for unmatched */
  schoolType: "public" | "private";
  /** County from CDE or empty string for unmatched */
  county: string;
  /** City from CDE or empty string for unmatched */
  city: string;
  /** Whether this school was matched to a CDE entry */
  matched: boolean;
  /** How the match was found */
  matchMethod: "exact" | "normalized" | "fuzzy" | "override" | "unmatched";
  /** Grade 12 enrollment from CDE Census Day data (null if unavailable) */
  grade12Enrollment: number | null;
}

/** Match statistics from the normalization process */
export interface MatchStats {
  totalUniqueSchools: number;
  exactMatches: number;
  normalizedMatches: number;
  fuzzyMatches: number;
  overrideMatches: number;
  unmatched: number;
  matchRate: number;
}

/** Result from the normalization process */
export interface NormalizationResult {
  records: EnrichedRecord[];
  stats: MatchStats;
  unmatchedSchools: string[];
}

// ---------------------------------------------------------------------------
// Campus slug resolution
// ---------------------------------------------------------------------------

/** Load campus aliases from campus-ids.json */
function loadCampusAliases(): Record<string, CampusSlug> {
  const filePath = path.resolve(
    __dirname,
    "../data/campus-ids.json",
  );
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8")) as {
    aliases: Record<string, string>;
  };
  return data.aliases as Record<string, CampusSlug>;
}

let campusAliasCache: Record<string, CampusSlug> | null = null;

/**
 * Resolve a campus name string to a CampusSlug.
 * Falls back to lowercased, hyphenated form if no alias found.
 */
export function resolveCampusSlug(campusName: string): CampusSlug {
  if (!campusAliasCache) {
    campusAliasCache = loadCampusAliases();
  }
  const normalized = campusName.toLowerCase().trim();
  return (
    campusAliasCache[normalized] ??
    (normalized.replace(/\s+/g, "-") as CampusSlug)
  );
}

/**
 * Resolve a campus slug to a display name.
 */
export function resolveCampusName(slug: CampusSlug): string {
  const filePath = path.resolve(
    __dirname,
    "../data/campus-ids.json",
  );
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8")) as {
    campuses: Array<{ slug: string; displayName: string }>;
  };
  const campus = data.campuses.find((c) => c.slug === slug);
  return campus?.displayName ?? slug;
}

// ---------------------------------------------------------------------------
// CDE CSV Parsing
// ---------------------------------------------------------------------------

/** Column aliases for CDE CSV files */
const CDE_COLUMN_ALIASES: Record<string, keyof CdeSchoolRecord> = {
  cdscode: "cdsCode",
  "cds code": "cdsCode",
  cds_code: "cdsCode",
  school: "name",
  "school name": "name",
  schoolname: "name",
  city: "city",
  county: "county",
  countyname: "county",
  "county name": "county",
  schooltype: "schoolType",
  "school type": "schoolType",
  type: "schoolType",
};

/**
 * Parse a CDE school directory CSV file.
 */
export function parseCdeFile(filePath: string): CdeSchoolRecord[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const rows = csvParse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  if (rows.length === 0) return [];

  const headers = Object.keys(rows[0]!);
  const columnMap = new Map<string, keyof CdeSchoolRecord>();
  for (const header of headers) {
    const normalized = header.toLowerCase().trim();
    const field = CDE_COLUMN_ALIASES[normalized];
    if (field) {
      columnMap.set(header, field);
    }
  }

  const records: CdeSchoolRecord[] = [];
  for (const row of rows) {
    const entry: Partial<CdeSchoolRecord> = {};
    for (const [header, field] of columnMap) {
      const val = row[header] ?? "";
      if (field === "schoolType") {
        entry.schoolType =
          val.toLowerCase().includes("private") ? "private" : "public";
      } else {
        (entry as Record<string, string>)[field] = val;
      }
    }

    if (entry.name) {
      records.push({
        cdsCode: entry.cdsCode ?? "",
        name: entry.name,
        city: entry.city ?? "",
        county: entry.county ?? "",
        schoolType: entry.schoolType ?? "public",
      });
    }
  }

  return records;
}

/**
 * Parse a CDE school directory tab-delimited .txt file (pubschls.txt / privschls.txt).
 *
 * These files have columns: CDSCode, NCESDist, NCESSchool, StatusType, County,
 * District, School, Street, StreetAbr, City, ... (tab-delimited)
 *
 * School type is determined from the filename:
 * - pubschls.txt → "public"
 * - privschls.txt → "private"
 */
export function parseCdeTxtFile(
  filePath: string,
  defaultSchoolType?: "public" | "private",
): CdeSchoolRecord[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const rows = csvParse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    delimiter: "\t",
    relax_column_count: true,
    relax_quotes: true,
  }) as Record<string, string>[];

  if (rows.length === 0) return [];

  // Determine school type from filename if not provided
  const fileName = path.basename(filePath).toLowerCase();
  let schoolType: "public" | "private" = defaultSchoolType ?? "public";
  if (fileName.includes("priv")) {
    schoolType = "private";
  } else if (fileName.includes("pub")) {
    schoolType = "public";
  }

  const records: CdeSchoolRecord[] = [];
  for (const row of rows) {
    // Filter for active schools only
    const status = (row["StatusType"] ?? row["statustype"] ?? "").trim();
    if (status && status.toLowerCase() !== "active") continue;

    const cdsCode = (row["CDSCode"] ?? row["cdsCode"] ?? row["cdscode"] ?? "").trim();
    const name = (row["School"] ?? row["school"] ?? "").trim();
    const city = (row["City"] ?? row["city"] ?? "").trim();
    const county = (row["County"] ?? row["county"] ?? row["CountyName"] ?? "").trim();

    if (!name || name === "No Data") continue;

    const ncesDist = (row["NCESDist"] ?? row["ncesdist"] ?? "").trim();
    const ncesSchool = (row["NCESSchool"] ?? row["ncesschool"] ?? "").trim();

    const record: CdeSchoolRecord = {
      cdsCode,
      name,
      city,
      county,
      schoolType,
    };
    if (ncesDist && ncesDist !== "No Data") record.ncesDist = ncesDist;
    if (ncesSchool && ncesSchool !== "No Data") record.ncesSchool = ncesSchool;

    records.push(record);
  }

  return records;
}

/**
 * Build an NCES-to-CDS crosswalk map from CDE school records.
 *
 * NCES IDs are formed by concatenating NCESDist (7 digits) + NCESSchool (5 digits)
 * into a 12-digit NCES ID. Returns a Map<ncesId, cdsCode>.
 */
export function buildNcesCrosswalk(cdeRecords: CdeSchoolRecord[]): Map<string, string> {
  const crosswalk = new Map<string, string>();
  for (const rec of cdeRecords) {
    if (!rec.ncesDist || !rec.ncesSchool) continue;
    const ncesId = rec.ncesDist + rec.ncesSchool;
    if (ncesId.length >= 10 && rec.cdsCode.length === 14) {
      crosswalk.set(ncesId, rec.cdsCode);
    }
  }
  return crosswalk;
}

/**
 * Parse all CDE school files from a directory.
 * Handles both CSV files and tab-delimited .txt files (pubschls.txt, privschls.txt).
 */
export function parseCdeDirectory(dirPath: string): CdeSchoolRecord[] {
  if (!fs.existsSync(dirPath)) {
    throw new Error(`CDE directory does not exist: ${dirPath}`);
  }

  const files = fs.readdirSync(dirPath);
  const allRecords: CdeSchoolRecord[] = [];

  // Parse CSV files
  const csvFiles = files.filter((f) => f.toLowerCase().endsWith(".csv"));
  for (const file of csvFiles) {
    const records = parseCdeFile(path.join(dirPath, file));
    allRecords.push(...records);
  }

  // Parse tab-delimited .txt files (pubschls.txt, privschls.txt)
  const txtFiles = files.filter((f) => {
    const lower = f.toLowerCase();
    return lower.endsWith(".txt") &&
      (lower.includes("pubschls") || lower.includes("privschls"));
  });
  for (const file of txtFiles) {
    const records = parseCdeTxtFile(path.join(dirPath, file));
    console.log(`  CDE ${file}: ${records.length} active schools`);
    allRecords.push(...records);
  }

  // Parse allschls.txt as fallback for any schools not already loaded
  // (covers private schools when privschls.txt is incomplete/corrupted)
  const allSchlsFile = files.find((f) => f.toLowerCase() === "allschls.txt");
  if (allSchlsFile) {
    const allSchlsPath = path.join(dirPath, allSchlsFile);
    const content = fs.readFileSync(allSchlsPath, "utf-8");
    const rows = csvParse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      delimiter: "\t",
      relax_column_count: true,
      quote: false,
    }) as Record<string, string>[];

    const existingCds = new Set(allRecords.map((r) => r.cdsCode));
    let added = 0;
    for (const row of rows) {
      const status = (row["StatusType"] ?? "").trim();
      if (status && status.toLowerCase() !== "active") continue;
      const cdsCode = (row["CDSCode"] ?? "").trim();
      const name = (row["School"] ?? "").trim();
      if (!name || name === "No Data" || existingCds.has(cdsCode)) continue;
      const city = (row["City"] ?? "").trim();
      const county = (row["County"] ?? "").trim();
      // Determine type: schools with even CDS district codes are often private
      const schoolType: "public" | "private" = "private";
      allRecords.push({ cdsCode, name, city, county, schoolType });
      existingCds.add(cdsCode);
      added++;
    }
    console.log(`  CDE ${allSchlsFile}: ${added} additional schools (deduped)`);
  }

  return allRecords;
}

// ---------------------------------------------------------------------------
// CDE Enrollment Data Parsing
// ---------------------------------------------------------------------------

/**
 * Year-aware enrollment map: CDS code → UC admissions year → grade 12 enrollment.
 *
 * UC admissions year Y corresponds to the school year (Y-1)–Y when students
 * are in grade 12. For example, UC 2025 → 2024-25 school year.
 */
export type EnrollmentMap = Map<string, Map<number, number>>;

/**
 * Convert a CDE academic year string (e.g., "2024-25") to the corresponding
 * UC admissions year (e.g., 2025). Students in grade 12 during 2024-25 apply
 * for Fall 2025 admission.
 */
function academicYearToUcYear(academicYear: string): number {
  // Format is "YYYY-YY", take the first year and add 1
  const startYear = parseInt(academicYear.substring(0, 4), 10);
  return startYear + 1;
}

/**
 * Parse a CDE Census Day enrollment file (cdenroll*.txt).
 * These files have school-level total rows identified by
 * AggregateLevel = "S" and ReportingCategory = "TA".
 */
export function parseCensusEnrollmentFile(filePath: string): EnrollmentMap {
  const content = fs.readFileSync(filePath, "utf-8");
  const rows = csvParse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    delimiter: "\t",
    relax_column_count: true,
    relax_quotes: true,
  }) as Record<string, string>[];

  const enrollmentMap: EnrollmentMap = new Map();

  for (const row of rows) {
    if (row["AggregateLevel"] !== "S") continue;
    if (row["ReportingCategory"] !== "TA") continue;

    const countyCode = (row["CountyCode"] ?? "").trim();
    const districtCode = (row["DistrictCode"] ?? "").trim();
    const schoolCode = (row["SchoolCode"] ?? "").trim();
    const cdsCode = `${countyCode}${districtCode}${schoolCode}`;
    const ucYear = academicYearToUcYear((row["AcademicYear"] ?? "").trim());

    const gr12 = parseInt(row["GR_12"] ?? "0", 10);
    if (!isNaN(gr12) && gr12 > 0) {
      if (!enrollmentMap.has(cdsCode)) enrollmentMap.set(cdsCode, new Map());
      enrollmentMap.get(cdsCode)!.set(ucYear, gr12);
    }
  }

  return enrollmentMap;
}

/**
 * Parse a CDE historical enrollment file (enr*.txt, 1981–2022 format).
 * These files have per-race/gender rows. We sum GR_12 across all rows
 * with ENR_TYPE = "C" (Combined) for each school/year.
 */
export function parseHistoricalEnrollmentFile(filePath: string): EnrollmentMap {
  const content = fs.readFileSync(filePath, "utf-8");
  const rows = csvParse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    delimiter: "\t",
    relax_column_count: true,
    relax_quotes: true,
  }) as Record<string, string>[];

  // Accumulate: CDS + ucYear → sum of GR_12
  const totals = new Map<string, number>();

  for (const row of rows) {
    // Use Combined enrollment (Primary + Short-term)
    if ((row["ENR_TYPE"] ?? "") !== "C") continue;

    const cdsCode = (row["CDS_CODE"] ?? "").trim();
    const academicYear = (row["ACADEMIC_YEAR"] ?? "").trim();
    if (!cdsCode || !academicYear) continue;

    const ucYear = academicYearToUcYear(academicYear);
    const gr12 = parseInt(row["GR_12"] ?? "0", 10);
    if (isNaN(gr12) || gr12 <= 0) continue;

    const key = `${cdsCode}|${ucYear}`;
    totals.set(key, (totals.get(key) ?? 0) + gr12);
  }

  const enrollmentMap: EnrollmentMap = new Map();
  for (const [key, total] of totals) {
    const [cdsCode, ucYearStr] = key.split("|") as [string, string];
    const ucYear = parseInt(ucYearStr, 10);
    if (!enrollmentMap.has(cdsCode)) enrollmentMap.set(cdsCode, new Map());
    enrollmentMap.get(cdsCode)!.set(ucYear, total);
  }

  return enrollmentMap;
}

/**
 * Parse a CDE Private School Affidavit .xlsx file (privateschooldata*.xlsx).
 *
 * These files have 5 title/summary rows, then a header row (row 6), with
 * data starting at row 7. Key columns (by header row 6):
 *   A: CDS Code (13-digit number, zero-padded to 14)
 *   Q: Grade 12 Enroll
 *
 * The UC admissions year is derived from the filename:
 *   privateschooldata2425.xlsx → school year 2024-25 → UC year 2025
 *   privateschooldata1920.xlsx → school year 2019-20 → UC year 2020
 */
export async function parsePrivateSchoolEnrollmentFile(filePath: string): Promise<EnrollmentMap> {
  const fileName = path.basename(filePath);

  // Extract the year suffix: e.g. "2425" from "privateschooldata2425.xlsx"
  const yearMatch = fileName.match(/privateschooldata(\d{4})\.xlsx/i);
  if (!yearMatch) {
    throw new Error(`Cannot parse year from private school filename: ${fileName}`);
  }
  const yearSuffix = yearMatch[1]!;
  // "2425" → second two digits = "25" → 2000 + 25 = 2025
  const secondYearPart = parseInt(yearSuffix.substring(2), 10);
  const ucYear = 2000 + secondYearPart;

  // Dynamic require to avoid ESM double-import issues with xlsx
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const XLSX = await import("xlsx") as any;
  const readFile = XLSX.readFile ?? XLSX.default?.readFile;
  const sheetToJson = XLSX.utils?.sheet_to_json ?? XLSX.default?.utils?.sheet_to_json;

  if (!readFile || !sheetToJson) {
    throw new Error("Failed to load xlsx library");
  }

  const workbook = readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error(`No sheets found in ${fileName}`);
  }

  const sheet = workbook.Sheets[sheetName]!;
  // Convert to JSON with header from row 6 (0-indexed: header row index 5)
  // range: 5 means start reading from row index 5 (row 6 in 1-based), which
  // becomes the header, and data starts from row index 6 (row 7 in 1-based).
  const rows = sheetToJson(sheet, {
    range: 5,
  });

  const enrollmentMap: EnrollmentMap = new Map();

  for (const row of rows) {
    const rawCds = row["CDS Code"];
    if (rawCds === undefined || rawCds === null) continue;

    // CDS codes are stored as numbers (13 digits); pad to 14 digits
    const cdsCode = String(rawCds).padStart(14, "0");

    const gr12Raw = row["Grade 12 Enroll"];
    const gr12 = typeof gr12Raw === "number" ? gr12Raw : parseInt(String(gr12Raw ?? "0"), 10);
    if (isNaN(gr12) || gr12 <= 0) continue;

    if (!enrollmentMap.has(cdsCode)) enrollmentMap.set(cdsCode, new Map());
    enrollmentMap.get(cdsCode)!.set(ucYear, gr12);
  }

  return enrollmentMap;
}

/**
 * Merge multiple enrollment maps into one. Later entries override earlier ones
 * for the same CDS/year combination.
 */
export function mergeEnrollmentMaps(...maps: EnrollmentMap[]): EnrollmentMap {
  const merged: EnrollmentMap = new Map();
  for (const map of maps) {
    for (const [cds, yearMap] of map) {
      if (!merged.has(cds)) merged.set(cds, new Map());
      const target = merged.get(cds)!;
      for (const [year, count] of yearMap) {
        target.set(year, count);
      }
    }
  }
  return merged;
}

/** Legacy wrapper: flatten year-aware map for a single year lookup */
export function parseEnrollmentFile(filePath: string): Map<string, number> {
  const yearAware = parseCensusEnrollmentFile(filePath);
  const flat = new Map<string, number>();
  for (const [cds, yearMap] of yearAware) {
    // Take the latest year's value
    let latest = 0;
    let latestVal = 0;
    for (const [yr, val] of yearMap) {
      if (yr > latest) { latest = yr; latestVal = val; }
    }
    if (latestVal > 0) flat.set(cds, latestVal);
  }
  return flat;
}

// ---------------------------------------------------------------------------
// Name normalization
// ---------------------------------------------------------------------------

/**
 * Abbreviation expansions for school name normalization.
 */
const ABBREVIATION_MAP: Record<string, string> = {
  hs: "high school",
  "h.s.": "high school",
  "h s": "high school",
  sr: "senior",
  "sr.": "senior",
  jt: "joint",
  "jt.": "joint",
  elem: "elementary",
  "elem.": "elementary",
  acad: "academy",
  "acad.": "academy",
  acdmy: "academy",
  prep: "preparatory",
  "prep.": "preparatory",
  cath: "cathedral",
  "cath.": "cathedral",
  st: "saint",
  "st.": "saint",
  "mt": "mount",
  "mt.": "mount",
  // Common UC-data abbreviations
  sch: "school",
  schl: "school",
  schoo: "school",
  intl: "international",
  intrl: "international",
  lrng: "learning",
  ldrshp: "leadership",
  cmty: "community",
  cmnty: "community",
  cmtys: "communities",
  chrstn: "christian",
  chrtr: "charter",
  colg: "college",
  ctr: "center",
  educ: "education",
  ofc: "office",
  sci: "science",
  occ: "occupational",
  indpndnt: "independent",
  indpndt: "independent",
  stdy: "study",
  stds: "studies",
  enrichd: "enriched",
  enrched: "enriched",
  enrchd: "enriched",
  advcte: "advocate",
  perform: "performing",
  vlly: "valley",
  sher: "sheriff",
  alt: "alternative",
  alterntvs: "alternatives",
  altrntvs: "alternatives",
  alternatve: "alternative",
  // Additional truncated forms found in UC data
  scho: "school",
  chtr: "charter",
  chrt: "charter",
  chartr: "charter",
  acade: "academy",
  acd: "academy",
  aca: "academy",
  cty: "county",
  perf: "performing",
  ind: "independent",
  lrn: "learning",
  coll: "college",
  svc: "service",
  tech: "technology",
  prfrming: "performing",
  explora: "exploration",
};

/**
 * Normalize a school name for matching purposes.
 * - Lowercase
 * - Remove punctuation (except apostrophes in names)
 * - Expand abbreviations
 * - Collapse whitespace
 */
export function normalizeName(name: string): string {
  let normalized = name.toLowerCase().trim();

  // Replace punctuation (keep apostrophes)
  normalized = normalized.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, " ");

  // Expand abbreviations (whole word matches)
  const words = normalized.split(/\s+/);
  const expanded = words.map((w) => ABBREVIATION_MAP[w] ?? w);
  normalized = expanded.join(" ");

  // Collapse whitespace
  normalized = normalized.replace(/\s+/g, " ").trim();

  return normalized;
}

// ---------------------------------------------------------------------------
// Matching engine
// ---------------------------------------------------------------------------

/** A pre-built index for fast school name lookups */
interface MatchIndex {
  /** Exact name to CDE record */
  exact: Map<string, CdeSchoolRecord>;
  /** Normalized name to CDE record */
  normalized: Map<string, CdeSchoolRecord>;
  /** All CDE records for fuzzy matching */
  all: CdeSchoolRecord[];
}

/**
 * Build a matching index from CDE school records.
 */
export function buildMatchIndex(cdeRecords: CdeSchoolRecord[]): MatchIndex {
  const exact = new Map<string, CdeSchoolRecord>();
  const normalized = new Map<string, CdeSchoolRecord>();

  for (const record of cdeRecords) {
    exact.set(record.name, record);
    normalized.set(normalizeName(record.name), record);
  }

  return { exact, normalized, all: cdeRecords };
}

/**
 * Attempt to match a UC school name to a CDE record.
 * Uses the 4-stage matching pipeline.
 */
export function matchSchool(
  ucName: string,
  index: MatchIndex,
  overrides: Record<string, string>,
): { cdeRecord: CdeSchoolRecord | null; method: EnrichedRecord["matchMethod"] } {
  // Stage 4 (checked first): Manual override
  const overrideTarget = overrides[ucName];
  if (overrideTarget) {
    const cdeRecord = index.exact.get(overrideTarget);
    if (cdeRecord) {
      return { cdeRecord, method: "override" };
    }
    // Try normalized match for override target
    const normalizedTarget = normalizeName(overrideTarget);
    const normalizedMatch = index.normalized.get(normalizedTarget);
    if (normalizedMatch) {
      return { cdeRecord: normalizedMatch, method: "override" };
    }
  }

  // Stage 1: Exact match
  const exactMatch = index.exact.get(ucName);
  if (exactMatch) {
    return { cdeRecord: exactMatch, method: "exact" };
  }

  // Stage 2: Normalized match
  const normalizedUcName = normalizeName(ucName);
  const normalizedMatch = index.normalized.get(normalizedUcName);
  if (normalizedMatch) {
    return { cdeRecord: normalizedMatch, method: "normalized" };
  }

  // Stage 3: Jaro-Winkler fuzzy match
  const THRESHOLD = 0.85;
  let bestScore = 0;
  let bestMatch: CdeSchoolRecord | null = null;

  for (const cdeRecord of index.all) {
    const score = jaroWinkler(normalizedUcName, normalizeName(cdeRecord.name)) as number;
    if (score >= THRESHOLD && score > bestScore) {
      bestScore = score;
      bestMatch = cdeRecord;
    }
  }

  if (bestMatch) {
    return { cdeRecord: bestMatch, method: "fuzzy" };
  }

  // No match found
  return { cdeRecord: null, method: "unmatched" };
}

// ---------------------------------------------------------------------------
// Main normalization function
// ---------------------------------------------------------------------------

/** Counter for generating IDs for unmatched schools */
let unmatchedCounter = 0;

/**
 * Generate a unique ID for an unmatched school.
 */
function generateUnmatchedId(schoolName: string): string {
  unmatchedCounter++;
  const slug = schoolName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `unmatched-${slug}-${unmatchedCounter}`;
}

/**
 * Normalize and match school records against the CDE directory.
 *
 * @param rawRecords - Raw admission records from the Tableau parser
 * @param cdeRecords - CDE school directory records
 * @param overrides - Manual name override mapping (UC name -> CDE name)
 * @returns Enriched records with CDE data and match statistics
 */
export function normalizeSchools(
  rawRecords: RawAdmissionRecord[],
  cdeRecords: CdeSchoolRecord[],
  overrides: Record<string, string> = {},
  enrollmentMap: Map<string, number> | EnrollmentMap = new Map(),
): NormalizationResult {
  unmatchedCounter = 0;

  const index = buildMatchIndex(cdeRecords);

  // Cache match results by UC school name + type (avoid duplicate lookups).
  // Including schoolType in the key prevents a private CDE match from being
  // reused for public UC records with the same name (which may be a different school).
  const matchCache = new Map<
    string,
    { cdeRecord: CdeSchoolRecord | null; method: EnrichedRecord["matchMethod"]; id: string }
  >();

  const stats: MatchStats = {
    totalUniqueSchools: 0,
    exactMatches: 0,
    normalizedMatches: 0,
    fuzzyMatches: 0,
    overrideMatches: 0,
    unmatched: 0,
    matchRate: 0,
  };

  const enrichedRecords: EnrichedRecord[] = [];
  const unmatchedSchools: string[] = [];
  // Track unique school names for stats (regardless of type)
  const seenSchoolNames = new Set<string>();

  for (const raw of rawRecords) {
    const cacheKey = `${raw.school}\t${raw.schoolType ?? ""}`;
    let cached = matchCache.get(cacheKey);
    if (!cached) {
      let result = matchSchool(raw.school, index, overrides);

      // If the match's school type conflicts with the UC record's type,
      // try to find a same-type CDE school instead. This prevents a large
      // public school from being assigned to a small private school's profile
      // (or vice versa) when they happen to share the same name.
      if (
        result.cdeRecord &&
        raw.schoolType &&
        result.cdeRecord.schoolType !== raw.schoolType &&
        result.method !== "override"
      ) {
        const normalizedUcName = normalizeName(raw.school);
        let sameTypeBestScore = 0;
        let sameTypeBest: CdeSchoolRecord | null = null;
        for (const cde of index.all) {
          if (cde.schoolType !== raw.schoolType) continue;
          const score = jaroWinkler(normalizedUcName, normalizeName(cde.name)) as number;
          if (score >= 0.85 && score > sameTypeBestScore) {
            sameTypeBestScore = score;
            sameTypeBest = cde;
          }
        }
        if (sameTypeBest) {
          result = { cdeRecord: sameTypeBest, method: "fuzzy" };
        } else {
          // No same-type match found. Leave unmatched rather than
          // associating a public school's data with a private school
          // (or vice versa), which causes wildly wrong application rates.
          result = { cdeRecord: null, method: "unmatched" };
        }
      }

      const id = result.cdeRecord
        ? result.cdeRecord.cdsCode
        : generateUnmatchedId(raw.school);
      cached = { ...result, id };
      matchCache.set(cacheKey, cached);

      // Update stats (count unique school names, not name+type pairs)
      if (!seenSchoolNames.has(raw.school)) {
        seenSchoolNames.add(raw.school);
        stats.totalUniqueSchools++;
        switch (result.method) {
          case "exact":
            stats.exactMatches++;
            break;
          case "normalized":
            stats.normalizedMatches++;
            break;
          case "fuzzy":
            stats.fuzzyMatches++;
            break;
          case "override":
            stats.overrideMatches++;
            break;
          case "unmatched":
            stats.unmatched++;
            unmatchedSchools.push(raw.school);
            break;
        }
      }
    }

    const campusSlug = resolveCampusSlug(raw.campus);

    // Look up enrollment: year-aware map (Map<string, Map<number, number>>) or flat (Map<string, number>)
    let enrollment: number | null = null;
    const enrEntry = enrollmentMap.get(cached.id);
    if (enrEntry instanceof Map) {
      enrollment = enrEntry.get(raw.year) ?? null;
    } else if (typeof enrEntry === "number") {
      enrollment = enrEntry;
    }

    enrichedRecords.push({
      school: cached.cdeRecord?.name ?? raw.school,
      ucName: raw.school,
      campus: campusSlug,
      year: raw.year,
      applicants: raw.applicants,
      admits: raw.admits,
      enrollees: raw.enrollees,
      gpaApplicants: raw.gpaApplicants,
      gpaAdmits: raw.gpaAdmits,
      gpaEnrollees: raw.gpaEnrollees,
      schoolId: cached.id,
      schoolType: raw.schoolType ?? cached.cdeRecord?.schoolType ?? "public",
      county: cached.cdeRecord?.county ?? raw.county ?? "",
      city: cached.cdeRecord?.city ?? raw.city ?? "",
      matched: cached.cdeRecord !== null,
      matchMethod: cached.method,
      grade12Enrollment: enrollment,
    });
  }

  stats.matchRate =
    stats.totalUniqueSchools > 0
      ? (stats.totalUniqueSchools - stats.unmatched) / stats.totalUniqueSchools
      : 0;

  return { records: enrichedRecords, stats, unmatchedSchools };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const inputIdx = args.indexOf("--input");
  const cdeIdx = args.indexOf("--cde-dir");

  const inputFile = inputIdx >= 0 ? args[inputIdx + 1] : undefined;
  const cdeDir = cdeIdx >= 0 ? args[cdeIdx + 1] : undefined;

  if (!inputFile || !cdeDir) {
    console.error(
      "Usage: tsx scripts/transform/normalize-schools.ts --input <records.json> --cde-dir <directory>",
    );
    process.exit(1);
  }

  try {
    // Load raw records
    const rawRecords: RawAdmissionRecord[] = JSON.parse(
      fs.readFileSync(inputFile, "utf-8"),
    );

    // Load CDE records
    const cdeRecords = parseCdeDirectory(cdeDir);

    // Load overrides
    const overridesPath = path.resolve(
      __dirname,
      "../data/school-name-overrides.json",
    );
    const overrides: Record<string, string> = fs.existsSync(overridesPath)
      ? JSON.parse(fs.readFileSync(overridesPath, "utf-8"))
      : {};

    console.log(
      `Loaded ${rawRecords.length} raw records, ${cdeRecords.length} CDE schools, ${Object.keys(overrides).length} overrides`,
    );

    const result = normalizeSchools(rawRecords, cdeRecords, overrides);

    console.log("\nMatch Statistics:");
    console.log(`  Total unique schools: ${result.stats.totalUniqueSchools}`);
    console.log(`  Exact matches:       ${result.stats.exactMatches}`);
    console.log(`  Normalized matches:  ${result.stats.normalizedMatches}`);
    console.log(`  Fuzzy matches:       ${result.stats.fuzzyMatches}`);
    console.log(`  Override matches:    ${result.stats.overrideMatches}`);
    console.log(`  Unmatched:           ${result.stats.unmatched}`);
    console.log(
      `  Match rate:          ${(result.stats.matchRate * 100).toFixed(1)}%`,
    );

    if (result.unmatchedSchools.length > 0) {
      console.log("\nUnmatched schools:");
      for (const name of result.unmatchedSchools) {
        console.log(`  - ${name}`);
      }
    }

    // Output JSON to stdout
    console.log(JSON.stringify(result.records, null, 2));
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
  (process.argv[1].endsWith("normalize-schools.ts") ||
    process.argv[1].endsWith("normalize-schools.js"));
if (isMainModule) {
  main();
}
