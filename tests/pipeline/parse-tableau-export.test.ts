import { describe, it, expect } from "vitest";
import * as path from "node:path";
import {
  parseCsvFile,
  parseNumericValue,
  mapColumns,
} from "../../scripts/extract/parse-tableau-export.ts";

const FIXTURES_DIR = path.resolve(__dirname, "../fixtures");

// ---------------------------------------------------------------------------
// parseNumericValue
// ---------------------------------------------------------------------------

describe("parseNumericValue", () => {
  it("parses integer strings", () => {
    expect(parseNumericValue("150")).toBe(150);
  });

  it("parses float strings", () => {
    expect(parseNumericValue("3.85")).toBeCloseTo(3.85);
  });

  it("parses numbers with commas", () => {
    expect(parseNumericValue("1,234")).toBe(1234);
  });

  it("returns null for suppressed data (*)", () => {
    expect(parseNumericValue("*")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseNumericValue("")).toBeNull();
  });

  it("returns null for dash", () => {
    expect(parseNumericValue("-")).toBeNull();
  });

  it("returns null for N/A", () => {
    expect(parseNumericValue("N/A")).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(parseNumericValue(undefined)).toBeNull();
  });

  it("returns null for null", () => {
    expect(parseNumericValue(null)).toBeNull();
  });

  it("handles numeric type input", () => {
    expect(parseNumericValue(42)).toBe(42);
  });

  it("returns null for NaN number input", () => {
    expect(parseNumericValue(NaN)).toBeNull();
  });

  it("parses zero correctly", () => {
    expect(parseNumericValue("0")).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// mapColumns
// ---------------------------------------------------------------------------

describe("mapColumns", () => {
  it("maps standard column names", () => {
    const headers = [
      "School",
      "Campus",
      "Year",
      "Applicants",
      "Admits",
      "Enrollees",
      "GPA Applicants",
      "GPA Admits",
      "GPA Enrollees",
    ];
    const mapping = mapColumns(headers);
    expect(mapping.get(0)).toBe("school");
    expect(mapping.get(1)).toBe("campus");
    expect(mapping.get(2)).toBe("year");
    expect(mapping.get(3)).toBe("applicants");
    expect(mapping.get(4)).toBe("admits");
    expect(mapping.get(5)).toBe("enrollees");
    expect(mapping.get(6)).toBe("gpaApplicants");
    expect(mapping.get(7)).toBe("gpaAdmits");
    expect(mapping.get(8)).toBe("gpaEnrollees");
  });

  it("maps alternate column names", () => {
    const headers = [
      "Source School",
      "UC Campus",
      "Admit Year",
      "# Applicants",
      "# Admitted",
      "# Enrolled",
      "Applicant GPA",
      "Admit GPA",
      "Enrollee GPA",
    ];
    const mapping = mapColumns(headers);
    expect(mapping.get(0)).toBe("school");
    expect(mapping.get(1)).toBe("campus");
    expect(mapping.get(2)).toBe("year");
    expect(mapping.get(3)).toBe("applicants");
    expect(mapping.get(4)).toBe("admits");
    expect(mapping.get(5)).toBe("enrollees");
    expect(mapping.get(6)).toBe("gpaApplicants");
    expect(mapping.get(7)).toBe("gpaAdmits");
    expect(mapping.get(8)).toBe("gpaEnrollees");
  });

  it("ignores unknown columns", () => {
    const headers = ["School", "Unknown Column", "Year"];
    const mapping = mapColumns(headers);
    expect(mapping.size).toBe(2);
    expect(mapping.has(1)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseCsvFile
// ---------------------------------------------------------------------------

describe("parseCsvFile", () => {
  it("parses the standard fixture CSV with correct record count", () => {
    const result = parseCsvFile(
      path.join(FIXTURES_DIR, "sample-tableau-export.csv"),
    );
    expect(result.records).toHaveLength(30);
    expect(result.warnings).toHaveLength(0);
  });

  it("parses school names correctly", () => {
    const result = parseCsvFile(
      path.join(FIXTURES_DIR, "sample-tableau-export.csv"),
    );
    const schools = [...new Set(result.records.map((r) => r.school))];
    expect(schools).toContain("Lincoln High School");
    expect(schools).toContain("Sacred Heart Prep");
    expect(schools).toContain("Washington High School");
    expect(schools).toContain("St. Mary's Academy");
    expect(schools).toContain("Lowell High School");
  });

  it("parses campus names correctly", () => {
    const result = parseCsvFile(
      path.join(FIXTURES_DIR, "sample-tableau-export.csv"),
    );
    const campuses = [...new Set(result.records.map((r) => r.campus))];
    expect(campuses).toContain("UC Berkeley");
    expect(campuses).toContain("UC Davis");
    expect(campuses).toContain("UC Irvine");
  });

  it("parses numeric fields correctly", () => {
    const result = parseCsvFile(
      path.join(FIXTURES_DIR, "sample-tableau-export.csv"),
    );
    // First record: Lincoln High School, UC Berkeley, 2022
    const firstRecord = result.records[0]!;
    expect(firstRecord.school).toBe("Lincoln High School");
    expect(firstRecord.campus).toBe("UC Berkeley");
    expect(firstRecord.year).toBe(2022);
    expect(firstRecord.applicants).toBe(150);
    expect(firstRecord.admits).toBe(45);
    expect(firstRecord.enrollees).toBe(18);
    expect(firstRecord.gpaApplicants).toBeCloseTo(3.85);
    expect(firstRecord.gpaAdmits).toBeCloseTo(4.1);
    expect(firstRecord.gpaEnrollees).toBeCloseTo(4.15);
  });

  it("parses alternate column naming conventions", () => {
    const result = parseCsvFile(
      path.join(FIXTURES_DIR, "sample-tableau-alt-columns.csv"),
    );
    expect(result.records).toHaveLength(2);
    expect(result.warnings).toHaveLength(0);
    expect(result.records[0]!.school).toBe("Lincoln High School");
    expect(result.records[0]!.applicants).toBe(155);
  });

  it("handles suppressed data (asterisks and empty values)", () => {
    const result = parseCsvFile(
      path.join(FIXTURES_DIR, "sample-tableau-suppressed.csv"),
    );
    // First record should be normal
    expect(result.records[0]!.applicants).toBe(155);

    // Second record: "Small School" has all * (suppressed)
    const suppressed = result.records.find(
      (r) => r.school === "Small School",
    );
    expect(suppressed).toBeDefined();
    expect(suppressed!.applicants).toBeNull();
    expect(suppressed!.admits).toBeNull();
    expect(suppressed!.enrollees).toBeNull();
    expect(suppressed!.gpaApplicants).toBeNull();

    // Third record: "Tiny Academy" has mixed data
    const mixed = result.records.find((r) => r.school === "Tiny Academy");
    expect(mixed).toBeDefined();
    expect(mixed!.applicants).toBe(5);
    expect(mixed!.admits).toBeNull(); // empty
    expect(mixed!.enrollees).toBe(2);
    expect(mixed!.gpaAdmits).toBeNull(); // empty
  });

  it("returns warnings for non-existent file", () => {
    const result = parseCsvFile(
      path.join(FIXTURES_DIR, "non-existent.csv"),
    );
    expect(result.records).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("Failed to read file");
  });

  it("extracts correct year values", () => {
    const result = parseCsvFile(
      path.join(FIXTURES_DIR, "sample-tableau-export.csv"),
    );
    const years = [...new Set(result.records.map((r) => r.year))];
    expect(years.sort()).toEqual([2022, 2023, 2024]);
  });

  it("all records conform to RawAdmissionRecord shape", () => {
    const result = parseCsvFile(
      path.join(FIXTURES_DIR, "sample-tableau-export.csv"),
    );
    for (const record of result.records) {
      expect(typeof record.school).toBe("string");
      expect(typeof record.campus).toBe("string");
      expect(typeof record.year).toBe("number");
      // Numeric fields should be number or null
      for (const field of [
        "applicants",
        "admits",
        "enrollees",
        "gpaApplicants",
        "gpaAdmits",
        "gpaEnrollees",
      ] as const) {
        const val = record[field];
        expect(val === null || typeof val === "number").toBe(true);
      }
    }
  });
});
