import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { parseCrdcFile } from "../../scripts/extract/parse-crdc.ts";
import { buildNcesCrosswalk, type CdeSchoolRecord } from "../../scripts/transform/normalize-schools.ts";

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "crdc-test-"));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeTempCsv(name: string, content: string): string {
  const filePath = path.join(tmpDir, name);
  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}

// ---------------------------------------------------------------------------
// buildNcesCrosswalk tests
// ---------------------------------------------------------------------------

describe("buildNcesCrosswalk", () => {
  it("builds a map from 12-digit NCES IDs to 14-digit CDS codes", () => {
    const records: CdeSchoolRecord[] = [
      {
        cdsCode: "01100170112607",
        name: "Test School 1",
        city: "Oakland",
        county: "Alameda",
        schoolType: "public",
        ncesDist: "0600001",
        ncesSchool: "03278",
      },
      {
        cdsCode: "19647330119834",
        name: "Test School 2",
        city: "Los Angeles",
        county: "Los Angeles",
        schoolType: "public",
        ncesDist: "0623580",
        ncesSchool: "12345",
      },
    ];

    const crosswalk = buildNcesCrosswalk(records);
    expect(crosswalk.size).toBe(2);
    expect(crosswalk.get("060000103278")).toBe("01100170112607");
    expect(crosswalk.get("062358012345")).toBe("19647330119834");
  });

  it("skips records without NCES IDs", () => {
    const records: CdeSchoolRecord[] = [
      {
        cdsCode: "01100170112607",
        name: "Has NCES",
        city: "Oakland",
        county: "Alameda",
        schoolType: "public",
        ncesDist: "0600001",
        ncesSchool: "03278",
      },
      {
        cdsCode: "19647330119834",
        name: "No NCES",
        city: "Los Angeles",
        county: "Los Angeles",
        schoolType: "public",
        // No ncesDist/ncesSchool
      },
    ];

    const crosswalk = buildNcesCrosswalk(records);
    expect(crosswalk.size).toBe(1);
    expect(crosswalk.has("060000103278")).toBe(true);
  });

  it("returns empty map for empty input", () => {
    const crosswalk = buildNcesCrosswalk([]);
    expect(crosswalk.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// parseCrdcFile tests
// ---------------------------------------------------------------------------

describe("parseCrdcFile", () => {
  it("parses AP course data and maps via NCES crosswalk", () => {
    const csvContent = [
      "combokey,school_name,ap_indicator,ap_courses_offered",
      "060000103278,Test High,Yes,15",
      "062358012345,Another High,Yes,8",
      "099999999999,Unknown School,Yes,5",
    ].join("\n");
    const filePath = writeTempCsv("crdc_test.csv", csvContent);

    const crosswalk = new Map([
      ["060000103278", "01100170112607"],
      ["062358012345", "19647330119834"],
      // 099999999999 not in crosswalk
    ]);

    const result = parseCrdcFile(filePath, crosswalk);

    // Only 2 schools matched via crosswalk
    expect(result.size).toBe(2);

    const school1 = result.get("01100170112607")!;
    expect(school1.apCoursesOffered).toBe(15);

    const school2 = result.get("19647330119834")!;
    expect(school2.apCoursesOffered).toBe(8);
  });

  it("excludes schools without AP programs", () => {
    const csvContent = [
      "combokey,school_name,ap_indicator,ap_courses_offered",
      "060000103278,AP School,Yes,12",
      "060000107534,Elementary,No,",
      "060000109444,Alternative,-9,",
    ].join("\n");
    const filePath = writeTempCsv("crdc_no_ap.csv", csvContent);

    const crosswalk = new Map([
      ["060000103278", "01100170112607"],
      ["060000107534", "01100170112608"],
      ["060000109444", "01100170112609"],
    ]);

    const result = parseCrdcFile(filePath, crosswalk);
    expect(result.size).toBe(1);
    expect(result.has("01100170112607")).toBe(true);
  });

  it("handles missing AP course count for AP schools", () => {
    const csvContent = [
      "combokey,school_name,ap_indicator,ap_courses_offered",
      "060000103278,Has Count,Yes,10",
      "062358012345,No Count,Yes,",
    ].join("\n");
    const filePath = writeTempCsv("crdc_missing.csv", csvContent);

    const crosswalk = new Map([
      ["060000103278", "01100170112607"],
      ["062358012345", "19647330119834"],
    ]);

    const result = parseCrdcFile(filePath, crosswalk);

    // School with count is included
    expect(result.get("01100170112607")?.apCoursesOffered).toBe(10);
    // School without count has no quality data → not in map
    expect(result.has("19647330119834")).toBe(false);
  });

  it("returns empty map when crosswalk is empty", () => {
    const csvContent = [
      "combokey,school_name,ap_indicator,ap_courses_offered",
      "060000103278,Test High,Yes,15",
    ].join("\n");
    const filePath = writeTempCsv("crdc_empty_xwalk.csv", csvContent);

    const result = parseCrdcFile(filePath, new Map());
    expect(result.size).toBe(0);
  });
});
