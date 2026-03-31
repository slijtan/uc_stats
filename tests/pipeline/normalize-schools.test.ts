import { describe, it, expect } from "vitest";
import * as path from "node:path";
import {
  normalizeName,
  matchSchool,
  buildMatchIndex,
  parseCdeFile,
  normalizeSchools,
  resolveCampusSlug,
  type CdeSchoolRecord,
} from "../../scripts/transform/normalize-schools.ts";
import type { RawAdmissionRecord } from "../../scripts/extract/parse-tableau-export.ts";

const FIXTURES_DIR = path.resolve(__dirname, "../fixtures");

// ---------------------------------------------------------------------------
// Helper factories
// ---------------------------------------------------------------------------

function makeCdeRecord(overrides: Partial<CdeSchoolRecord> = {}): CdeSchoolRecord {
  return {
    cdsCode: "01234567890123",
    name: "Lincoln High School",
    city: "San Francisco",
    county: "San Francisco",
    schoolType: "public",
    ...overrides,
  };
}

function makeRawRecord(overrides: Partial<RawAdmissionRecord> = {}): RawAdmissionRecord {
  return {
    school: "Lincoln High School",
    campus: "UC Berkeley",
    year: 2024,
    applicants: 100,
    admits: 50,
    enrollees: 20,
    gpaApplicants: 3.85,
    gpaAdmits: 4.10,
    gpaEnrollees: 4.15,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// normalizeName
// ---------------------------------------------------------------------------

describe("normalizeName", () => {
  it("lowercases the name", () => {
    expect(normalizeName("LINCOLN HIGH SCHOOL")).toBe("lincoln high school");
  });

  it("removes punctuation", () => {
    expect(normalizeName("St. Mary's")).toBe("saint mary's");
  });

  it("expands abbreviations", () => {
    expect(normalizeName("Lincoln HS")).toBe("lincoln high school");
  });

  it("expands St. to Saint", () => {
    expect(normalizeName("St. Patrick")).toBe("saint patrick");
  });

  it("collapses multiple spaces", () => {
    expect(normalizeName("Lincoln   High   School")).toBe("lincoln high school");
  });

  it("trims whitespace", () => {
    expect(normalizeName("  Lincoln High School  ")).toBe("lincoln high school");
  });

  it("handles empty string", () => {
    expect(normalizeName("")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// resolveCampusSlug
// ---------------------------------------------------------------------------

describe("resolveCampusSlug", () => {
  it("resolves standard campus names", () => {
    expect(resolveCampusSlug("UC Berkeley")).toBe("berkeley");
    expect(resolveCampusSlug("UC Davis")).toBe("davis");
    expect(resolveCampusSlug("UC Irvine")).toBe("irvine");
  });

  it("resolves aliases", () => {
    expect(resolveCampusSlug("UCLA")).toBe("la");
    expect(resolveCampusSlug("UCSD")).toBe("san-diego");
    expect(resolveCampusSlug("Cal")).toBe("berkeley");
  });

  it("is case-insensitive", () => {
    expect(resolveCampusSlug("uc berkeley")).toBe("berkeley");
    expect(resolveCampusSlug("UC DAVIS")).toBe("davis");
  });
});

// ---------------------------------------------------------------------------
// matchSchool
// ---------------------------------------------------------------------------

describe("matchSchool", () => {
  const cdeRecords: CdeSchoolRecord[] = [
    makeCdeRecord({ cdsCode: "001", name: "Lincoln High School" }),
    makeCdeRecord({
      cdsCode: "002",
      name: "Sacred Heart Cathedral Preparatory",
      schoolType: "private",
    }),
    makeCdeRecord({ cdsCode: "003", name: "Washington High School" }),
    makeCdeRecord({
      cdsCode: "004",
      name: "Saint Mary's Academy",
      schoolType: "private",
    }),
  ];
  const index = buildMatchIndex(cdeRecords);

  it("finds exact matches", () => {
    const result = matchSchool("Lincoln High School", index, {});
    expect(result.method).toBe("exact");
    expect(result.cdeRecord?.cdsCode).toBe("001");
  });

  it("finds normalized matches (abbreviation expansion)", () => {
    const result = matchSchool("Lincoln HS", index, {});
    expect(result.method).toBe("normalized");
    expect(result.cdeRecord?.cdsCode).toBe("001");
  });

  it("finds fuzzy matches via Jaro-Winkler", () => {
    // "Sacred Heart Prep" is close to "Sacred Heart Cathedral Preparatory"
    const result = matchSchool("Sacred Heart Preparatory", index, {});
    // This should fuzzy match because normalized form differs but Jaro-Winkler is high
    expect(result.cdeRecord).not.toBeNull();
    expect(result.cdeRecord?.cdsCode).toBe("002");
  });

  it("uses manual overrides", () => {
    const overrides = {
      "St. Marys Academy": "Saint Mary's Academy",
    };
    const result = matchSchool("St. Marys Academy", index, overrides);
    expect(result.method).toBe("override");
    expect(result.cdeRecord?.cdsCode).toBe("004");
  });

  it("returns unmatched for unknown schools", () => {
    const result = matchSchool("Completely Unknown School", index, {});
    expect(result.method).toBe("unmatched");
    expect(result.cdeRecord).toBeNull();
  });

  it("overrides take precedence over other methods", () => {
    // Even though "Lincoln High School" would exact match,
    // if there's an override, it should be used
    const overrides = {
      "Lincoln High School": "Washington High School",
    };
    const result = matchSchool("Lincoln High School", index, overrides);
    expect(result.method).toBe("override");
    expect(result.cdeRecord?.cdsCode).toBe("003");
  });
});

// ---------------------------------------------------------------------------
// parseCdeFile
// ---------------------------------------------------------------------------

describe("parseCdeFile", () => {
  it("parses the sample CDE fixture file", () => {
    const records = parseCdeFile(
      path.join(FIXTURES_DIR, "sample-cde-schools.csv"),
    );
    expect(records.length).toBeGreaterThan(0);
  });

  it("correctly identifies school types", () => {
    const records = parseCdeFile(
      path.join(FIXTURES_DIR, "sample-cde-schools.csv"),
    );
    const publicSchools = records.filter((r) => r.schoolType === "public");
    const privateSchools = records.filter((r) => r.schoolType === "private");
    expect(publicSchools.length).toBeGreaterThan(0);
    expect(privateSchools.length).toBeGreaterThan(0);
  });

  it("extracts CDS codes", () => {
    const records = parseCdeFile(
      path.join(FIXTURES_DIR, "sample-cde-schools.csv"),
    );
    expect(records[0]!.cdsCode).toBe("01234567890123");
  });

  it("extracts city and county", () => {
    const records = parseCdeFile(
      path.join(FIXTURES_DIR, "sample-cde-schools.csv"),
    );
    const lincoln = records.find((r) => r.name === "Lincoln High School");
    expect(lincoln).toBeDefined();
    expect(lincoln!.city).toBe("San Francisco");
    expect(lincoln!.county).toBe("San Francisco");
  });
});

// ---------------------------------------------------------------------------
// normalizeSchools (integration)
// ---------------------------------------------------------------------------

describe("normalizeSchools", () => {
  const cdeRecords: CdeSchoolRecord[] = [
    makeCdeRecord({
      cdsCode: "001",
      name: "Lincoln High School",
      city: "San Francisco",
      county: "San Francisco",
      schoolType: "public",
    }),
    makeCdeRecord({
      cdsCode: "002",
      name: "Sacred Heart Cathedral Preparatory",
      city: "San Francisco",
      county: "San Francisco",
      schoolType: "private",
    }),
    makeCdeRecord({
      cdsCode: "003",
      name: "Washington High School",
      city: "San Francisco",
      county: "San Francisco",
      schoolType: "public",
    }),
  ];

  it("enriches records with CDE data", () => {
    const rawRecords = [
      makeRawRecord({ school: "Lincoln High School", campus: "UC Berkeley" }),
    ];
    const result = normalizeSchools(rawRecords, cdeRecords);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]!.schoolId).toBe("001");
    expect(result.records[0]!.county).toBe("San Francisco");
    expect(result.records[0]!.city).toBe("San Francisco");
    expect(result.records[0]!.schoolType).toBe("public");
    expect(result.records[0]!.matched).toBe(true);
  });

  it("resolves campus names to slugs", () => {
    const rawRecords = [
      makeRawRecord({ campus: "UC Berkeley" }),
      makeRawRecord({ campus: "UC Davis" }),
    ];
    const result = normalizeSchools(rawRecords, cdeRecords);
    expect(result.records[0]!.campus).toBe("berkeley");
    expect(result.records[1]!.campus).toBe("davis");
  });

  it("handles unmatched schools", () => {
    const rawRecords = [
      makeRawRecord({ school: "Completely Unknown School" }),
    ];
    const result = normalizeSchools(rawRecords, cdeRecords);
    expect(result.records[0]!.matched).toBe(false);
    expect(result.records[0]!.matchMethod).toBe("unmatched");
    expect(result.records[0]!.schoolId).toContain("unmatched-");
    expect(result.unmatchedSchools).toContain("Completely Unknown School");
  });

  it("preserves the original UC name", () => {
    const rawRecords = [
      makeRawRecord({ school: "Lincoln HS" }),
    ];
    const result = normalizeSchools(rawRecords, cdeRecords);
    // School name should be updated to CDE name
    expect(result.records[0]!.school).toBe("Lincoln High School");
    // UC name preserved
    expect(result.records[0]!.ucName).toBe("Lincoln HS");
  });

  it("computes match statistics correctly", () => {
    const rawRecords = [
      makeRawRecord({ school: "Lincoln High School" }), // exact
      makeRawRecord({ school: "Lincoln High School", year: 2023 }), // same school, cached
      makeRawRecord({ school: "Washington HS" }), // normalized
      makeRawRecord({ school: "Unknown School" }), // unmatched
    ];
    const result = normalizeSchools(rawRecords, cdeRecords);

    expect(result.stats.totalUniqueSchools).toBe(3);
    expect(result.stats.exactMatches).toBe(1);
    expect(result.stats.normalizedMatches).toBe(1);
    expect(result.stats.unmatched).toBe(1);
    expect(result.stats.matchRate).toBeCloseTo(2 / 3);
  });

  it("caches match results for same school across records", () => {
    const rawRecords = [
      makeRawRecord({ school: "Lincoln High School", year: 2022 }),
      makeRawRecord({ school: "Lincoln High School", year: 2023 }),
      makeRawRecord({ school: "Lincoln High School", year: 2024 }),
    ];
    const result = normalizeSchools(rawRecords, cdeRecords);

    // All 3 records should have the same school ID
    expect(result.records[0]!.schoolId).toBe("001");
    expect(result.records[1]!.schoolId).toBe("001");
    expect(result.records[2]!.schoolId).toBe("001");

    // But only one unique school counted in stats
    expect(result.stats.totalUniqueSchools).toBe(1);
  });

  it("preserves admission data through normalization", () => {
    const rawRecords = [
      makeRawRecord({
        school: "Lincoln High School",
        applicants: 150,
        admits: 45,
        enrollees: null,
        gpaApplicants: 3.85,
      }),
    ];
    const result = normalizeSchools(rawRecords, cdeRecords);
    expect(result.records[0]!.applicants).toBe(150);
    expect(result.records[0]!.admits).toBe(45);
    expect(result.records[0]!.enrollees).toBeNull();
    expect(result.records[0]!.gpaApplicants).toBeCloseTo(3.85);
  });

  it("uses manual overrides when provided", () => {
    const rawRecords = [
      makeRawRecord({ school: "Sacred Heart Prep" }),
    ];
    const overrides = {
      "Sacred Heart Prep": "Sacred Heart Cathedral Preparatory",
    };
    const result = normalizeSchools(rawRecords, cdeRecords, overrides);
    expect(result.records[0]!.matched).toBe(true);
    expect(result.records[0]!.matchMethod).toBe("override");
    expect(result.records[0]!.schoolId).toBe("002");
    expect(result.records[0]!.schoolType).toBe("private");
  });
});
