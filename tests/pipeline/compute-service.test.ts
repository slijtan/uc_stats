import { describe, it, expect } from "vitest";
import {
  computeAcceptanceRate,
  computeYield,
  computeMetrics,
  filterRecords,
  computeGroupAggregate,
} from "../../src/services/computeService";
import type { AdmissionRecord, School } from "../../src/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRecord(overrides: Partial<AdmissionRecord> = {}): AdmissionRecord {
  return {
    schoolId: "school-1",
    year: 2024,
    schoolType: "public",
    applicants: 100,
    admits: 50,
    enrollees: 20,
    gpaApplicants: 3.8,
    gpaAdmits: 4.0,
    gpaEnrollees: 4.1,
    ...overrides,
  };
}

function makeSchool(overrides: Partial<School> = {}): School {
  return {
    id: "school-1",
    name: "Test High School",
    type: "public",
    county: "Los Angeles",
    city: "Los Angeles",
    ucName: "TEST HIGH SCHOOL",
    matched: true,
    matchMethod: "exact",
    yearsAvailable: [2023, 2024],
    grade12Enrollment: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// computeAcceptanceRate
// ---------------------------------------------------------------------------

describe("computeAcceptanceRate", () => {
  it("returns admits / applicants for valid data", () => {
    const record = makeRecord({ applicants: 200, admits: 100 });
    expect(computeAcceptanceRate(record)).toBeCloseTo(0.5);
  });

  it("returns null when admits is null", () => {
    const record = makeRecord({ admits: null });
    expect(computeAcceptanceRate(record)).toBeNull();
  });

  it("returns null when applicants is null", () => {
    const record = makeRecord({ applicants: null });
    expect(computeAcceptanceRate(record)).toBeNull();
  });

  it("returns null when applicants is zero", () => {
    const record = makeRecord({ applicants: 0 });
    expect(computeAcceptanceRate(record)).toBeNull();
  });

  it("handles small numbers correctly", () => {
    const record = makeRecord({ applicants: 3, admits: 1 });
    expect(computeAcceptanceRate(record)).toBeCloseTo(1 / 3);
  });

  it("handles 100% acceptance rate", () => {
    const record = makeRecord({ applicants: 50, admits: 50 });
    expect(computeAcceptanceRate(record)).toBeCloseTo(1.0);
  });
});

// ---------------------------------------------------------------------------
// computeYield
// ---------------------------------------------------------------------------

describe("computeYield", () => {
  it("returns enrollees / admits for valid data", () => {
    const record = makeRecord({ admits: 100, enrollees: 40 });
    expect(computeYield(record)).toBeCloseTo(0.4);
  });

  it("returns null when enrollees is null", () => {
    const record = makeRecord({ enrollees: null });
    expect(computeYield(record)).toBeNull();
  });

  it("returns null when admits is null", () => {
    const record = makeRecord({ admits: null });
    expect(computeYield(record)).toBeNull();
  });

  it("returns null when admits is zero", () => {
    const record = makeRecord({ admits: 0 });
    expect(computeYield(record)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// computeMetrics
// ---------------------------------------------------------------------------

describe("computeMetrics", () => {
  it("returns both acceptance rate and yield", () => {
    const record = makeRecord({ applicants: 200, admits: 100, enrollees: 40 });
    const metrics = computeMetrics(record);
    expect(metrics.acceptanceRate).toBeCloseTo(0.5);
    expect(metrics.yield).toBeCloseTo(0.4);
  });

  it("returns null for both when admits is null", () => {
    const record = makeRecord({ admits: null });
    const metrics = computeMetrics(record);
    expect(metrics.acceptanceRate).toBeNull();
    expect(metrics.yield).toBeNull();
  });

  it("handles mixed null values", () => {
    const record = makeRecord({ applicants: null, admits: 50, enrollees: 20 });
    const metrics = computeMetrics(record);
    expect(metrics.acceptanceRate).toBeNull();
    expect(metrics.yield).toBeCloseTo(0.4);
  });
});

// ---------------------------------------------------------------------------
// filterRecords
// ---------------------------------------------------------------------------

describe("filterRecords", () => {
  const records: AdmissionRecord[] = [
    makeRecord({ schoolId: "s1", year: 2023 }),
    makeRecord({ schoolId: "s1", year: 2024 }),
    makeRecord({ schoolId: "s2", year: 2023 }),
    makeRecord({ schoolId: "s2", year: 2024 }),
    makeRecord({ schoolId: "s3", year: 2024 }),
  ];

  it("returns all records when no filters are specified", () => {
    expect(filterRecords(records, {})).toHaveLength(5);
  });

  it("filters by year", () => {
    const result = filterRecords(records, { year: 2024 });
    expect(result).toHaveLength(3);
    expect(result.every((r) => r.year === 2024)).toBe(true);
  });

  it("filters by school IDs", () => {
    const result = filterRecords(records, { schoolIds: ["s1", "s3"] });
    expect(result).toHaveLength(3);
    expect(
      result.every((r) => r.schoolId === "s1" || r.schoolId === "s3"),
    ).toBe(true);
  });

  it("filters by both year and school IDs", () => {
    const result = filterRecords(records, { year: 2024, schoolIds: ["s2"] });
    expect(result).toHaveLength(1);
    expect(result[0]!.schoolId).toBe("s2");
    expect(result[0]!.year).toBe(2024);
  });

  it("returns empty array when no records match", () => {
    const result = filterRecords(records, { year: 2020 });
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// computeGroupAggregate
// ---------------------------------------------------------------------------

describe("computeGroupAggregate", () => {
  const schools: School[] = [
    makeSchool({ id: "pub-1", type: "public" }),
    makeSchool({ id: "pub-2", type: "public" }),
    makeSchool({ id: "priv-1", type: "private" }),
  ];

  const records: AdmissionRecord[] = [
    makeRecord({
      schoolId: "pub-1",
      applicants: 100,
      admits: 50,
      enrollees: 20,
      gpaApplicants: 3.5,
    }),
    makeRecord({
      schoolId: "pub-2",
      applicants: 200,
      admits: 80,
      enrollees: 30,
      gpaApplicants: 3.8,
    }),
    makeRecord({
      schoolId: "priv-1",
      applicants: 50,
      admits: 40,
      enrollees: 15,
      gpaApplicants: 4.0,
    }),
  ];

  it("aggregates public school statistics correctly", () => {
    const result = computeGroupAggregate(records, schools, "public");

    expect(result.schoolCount).toBe(2);
    expect(result.totalApplicants).toBe(300); // 100 + 200
    expect(result.totalAdmits).toBe(130); // 50 + 80
    expect(result.acceptanceRate).toBeCloseTo(130 / 300);
  });

  it("aggregates private school statistics correctly", () => {
    const result = computeGroupAggregate(records, schools, "private");

    expect(result.schoolCount).toBe(1);
    expect(result.totalApplicants).toBe(50);
    expect(result.totalAdmits).toBe(40);
    expect(result.acceptanceRate).toBeCloseTo(40 / 50);
  });

  it("computes mean per-school acceptance rate (unweighted)", () => {
    const result = computeGroupAggregate(records, schools, "public");
    // pub-1: 50/100 = 0.5, pub-2: 80/200 = 0.4
    // mean: (0.5 + 0.4) / 2 = 0.45
    expect(result.meanSchoolAcceptanceRate).toBeCloseTo(0.45);
  });

  it("computes median per-school acceptance rate", () => {
    const result = computeGroupAggregate(records, schools, "public");
    // Two values: 0.4 and 0.5 => median = (0.4 + 0.5) / 2 = 0.45
    expect(result.medianSchoolAcceptanceRate).toBeCloseTo(0.45);
  });

  it("computes median correctly for odd number of schools", () => {
    const moreSchools: School[] = [
      makeSchool({ id: "pub-1", type: "public" }),
      makeSchool({ id: "pub-2", type: "public" }),
      makeSchool({ id: "pub-3", type: "public" }),
    ];
    const moreRecords: AdmissionRecord[] = [
      makeRecord({ schoolId: "pub-1", applicants: 100, admits: 30 }), // 0.3
      makeRecord({ schoolId: "pub-2", applicants: 100, admits: 50 }), // 0.5
      makeRecord({ schoolId: "pub-3", applicants: 100, admits: 70 }), // 0.7
    ];
    const result = computeGroupAggregate(moreRecords, moreSchools, "public");
    expect(result.medianSchoolAcceptanceRate).toBeCloseTo(0.5);
  });

  it("computes weighted mean GPA", () => {
    const result = computeGroupAggregate(records, schools, "public");
    // pub-1: gpa=3.5, applicants=100; pub-2: gpa=3.8, applicants=200
    // weighted: (3.5*100 + 3.8*200) / (100+200) = (350+760)/300 = 1110/300 = 3.7
    expect(result.meanGpa).toBeCloseTo(3.7);
  });

  it("handles records with null applicants and admits", () => {
    const nullRecords: AdmissionRecord[] = [
      makeRecord({
        schoolId: "pub-1",
        applicants: null,
        admits: null,
        gpaApplicants: null,
      }),
    ];
    const result = computeGroupAggregate(nullRecords, schools, "public");

    expect(result.schoolCount).toBe(1);
    expect(result.totalApplicants).toBe(0);
    expect(result.totalAdmits).toBe(0);
    expect(result.acceptanceRate).toBe(0);
    expect(result.meanSchoolAcceptanceRate).toBe(0);
    expect(result.medianSchoolAcceptanceRate).toBe(0);
    expect(result.meanGpa).toBe(0);
  });

  it("returns zeros when no records match the school type", () => {
    // Filter out private records so no records match private school type
    const publicOnly = records.filter((r) => r.schoolId !== "priv-1");
    const result = computeGroupAggregate(publicOnly, schools, "private");

    expect(result.schoolCount).toBe(0);
    expect(result.totalApplicants).toBe(0);
    expect(result.totalAdmits).toBe(0);
    expect(result.acceptanceRate).toBe(0);
    expect(result.meanGpa).toBe(0);
  });
});
