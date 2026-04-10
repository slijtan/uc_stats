/**
 * CRDC (Civil Rights Data Collection) Parser
 *
 * Parses the preprocessed CRDC AP course data CSV and maps NCES IDs
 * to CDS codes via a crosswalk built from CDE pubschls.txt.
 *
 * Data source: CRDC 2020-21 California state file
 *   - Preprocessed by scripts/preprocess-crdc.py into crdc_ap_courses.csv
 *   - Contains COMBOKEY (12-digit NCES ID), AP indicator, AP courses count
 *
 * The NCES-to-CDS crosswalk is built from CDE school records which contain
 * NCESDist (7-digit) and NCESSchool (5-digit) fields.
 */

import * as fs from "node:fs";
import { parse } from "csv-parse/sync";
import type { SchoolQuality } from "../../src/types/index.ts";

/**
 * Parse a preprocessed CRDC AP courses CSV file and map to CDS codes.
 *
 * @param filePath - Path to the preprocessed CSV (crdc_ap_courses.csv)
 * @param ncesCrosswalk - Map<ncesId, cdsCode> from buildNcesCrosswalk()
 * @returns Map<cds, Partial<SchoolQuality>> with apCoursesOffered
 */
export function parseCrdcFile(
  filePath: string,
  ncesCrosswalk: Map<string, string>,
): Map<string, Partial<SchoolQuality>> {
  const result = new Map<string, Partial<SchoolQuality>>();

  const content = fs.readFileSync(filePath, "utf-8");
  const rows = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  let matched = 0;
  let unmatched = 0;

  for (const row of rows) {
    const combokey = (row["combokey"] ?? "").trim();
    const apIndicator = (row["ap_indicator"] ?? "").trim();
    const apCoursesRaw = (row["ap_courses_offered"] ?? "").trim();

    if (!combokey) continue;

    // Only include schools with AP programs
    if (apIndicator !== "Yes") continue;

    // Map NCES COMBOKEY to CDS code
    const cds = ncesCrosswalk.get(combokey);
    if (!cds) {
      unmatched++;
      continue;
    }
    matched++;

    const quality: Partial<SchoolQuality> = {};

    if (apCoursesRaw !== "") {
      const apCourses = parseInt(apCoursesRaw, 10);
      if (Number.isFinite(apCourses) && apCourses >= 0) {
        quality.apCoursesOffered = apCourses;
      }
    }

    // Only set if we have data
    if (Object.keys(quality).length > 0) {
      result.set(cds, quality);
    }
  }

  console.log(`  CRDC: ${matched} schools matched via NCES crosswalk, ${unmatched} unmatched`);

  return result;
}

/**
 * Find the most recent CRDC preprocessed CSV in a directory.
 */
export function findCrdcFile(dir: string): string | undefined {
  if (!fs.existsSync(dir)) return undefined;

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".csv") && f.includes("crdc"))
    .sort();

  return files.length > 0
    ? `${dir}/${files[files.length - 1]}`
    : undefined;
}
