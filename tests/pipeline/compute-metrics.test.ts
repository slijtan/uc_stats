import { describe, it, expect } from "vitest";
import {
  calculateAcceptanceRate,
  addAcceptanceRates,
  computeGroupAggregate,
  computeCampusSummaries,
  computePipelineMetrics,
  median,
  type ComputedRecord,
} from "../../scripts/transform/compute-metrics.ts";
import type { EnrichedRecord } from "../../scripts/transform/normalize-schools.ts";

// ---------------------------------------------------------------------------
// Helper factories
// ---------------------------------------------------------------------------

function makeEnrichedRecord(
  overrides: Partial<EnrichedRecord> = {},
): EnrichedRecord {
  return {
    school: "Lincoln High School",
    ucName: "Lincoln High School",
    campus: "berkeley",
    year: 2024,
    applicants: 100,
    admits: 50,
    enrollees: 20,
    gpaApplicants: 3.85,
    gpaAdmits: 4.10,
    gpaEnrollees: 4.15,
    schoolId: "001",
    schoolType: "public",
    county: "San Francisco",
    city: "San Francisco",
    matched: true,
    matchMethod: "exact",
    ...overrides,
  };
}

function makeComputedRecord(
  overrides: Partial<ComputedRecord> = {},
): ComputedRecord {
  const base = makeEnrichedRecord(overrides);
  return {
    ...base,
    acceptanceRate: calculateAcceptanceRate(base.applicants, base.admits),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// calculateAcceptanceRate
// ---------------------------------------------------------------------------

describe("calculateAcceptanceRate", () => {
  it("returns correct rate for valid data", () => {
    expect(calculateAcceptanceRate(100, 50)).toBeCloseTo(0.5);
  });

  it("returns null when applicants is null", () => {
    expect(calculateAcceptanceRate(null, 50)).toBeNull();
  });

  it("returns null when admits is null", () => {
    expect(calculateAcceptanceRate(100, null)).toBeNull();
  });

  it("returns null when applicants is zero", () => {
    expect(calculateAcceptanceRate(0, 0)).toBeNull();
  });

  it("handles 100% acceptance rate", () => {
    expect(calculateAcceptanceRate(50, 50)).toBeCloseTo(1.0);
  });

  it("handles very small acceptance rates", () => {
    expect(calculateAcceptanceRate(1000, 1)).toBeCloseTo(0.001);
  });
});

// ---------------------------------------------------------------------------
// median
// ---------------------------------------------------------------------------

describe("median", () => {
  it("returns 0 for empty array", () => {
    expect(median([])).toBe(0);
  });

  it("returns the value for single-element array", () => {
    expect(median([0.5])).toBeCloseTo(0.5);
  });

  it("returns average of two middle values for even-length array", () => {
    expect(median([0.3, 0.7])).toBeCloseTo(0.5);
  });

  it("returns middle value for odd-length array", () => {
    expect(median([0.3, 0.5, 0.7])).toBeCloseTo(0.5);
  });

  it("handles unsorted input", () => {
    expect(median([0.7, 0.3, 0.5])).toBeCloseTo(0.5);
  });
});

// ---------------------------------------------------------------------------
// addAcceptanceRates
// ---------------------------------------------------------------------------

describe("addAcceptanceRates", () => {
  it("adds acceptance rate to each record", () => {
    const records = [
      makeEnrichedRecord({ applicants: 100, admits: 50 }),
      makeEnrichedRecord({ applicants: 200, admits: 80 }),
    ];
    const result = addAcceptanceRates(records);
    expect(result[0]!.acceptanceRate).toBeCloseTo(0.5);
    expect(result[1]!.acceptanceRate).toBeCloseTo(0.4);
  });

  it("sets acceptance rate to null for suppressed data", () => {
    const records = [
      makeEnrichedRecord({ applicants: null, admits: null }),
    ];
    const result = addAcceptanceRates(records);
    expect(result[0]!.acceptanceRate).toBeNull();
  });

  it("preserves all original fields", () => {
    const records = [makeEnrichedRecord()];
    const result = addAcceptanceRates(records);
    expect(result[0]!.school).toBe("Lincoln High School");
    expect(result[0]!.campus).toBe("berkeley");
    expect(result[0]!.schoolId).toBe("001");
  });
});

// ---------------------------------------------------------------------------
// computeGroupAggregate
// ---------------------------------------------------------------------------

describe("computeGroupAggregate", () => {
  it("aggregates public school statistics", () => {
    const records: ComputedRecord[] = [
      makeComputedRecord({
        schoolId: "pub1",
        schoolType: "public",
        applicants: 100,
        admits: 50,
        gpaApplicants: 3.5,
      }),
      makeComputedRecord({
        schoolId: "pub2",
        schoolType: "public",
        applicants: 200,
        admits: 80,
        gpaApplicants: 3.8,
      }),
    ];

    const result = computeGroupAggregate(records, "public");
    expect(result.schoolCount).toBe(2);
    expect(result.totalApplicants).toBe(300);
    expect(result.totalAdmits).toBe(130);
    expect(result.acceptanceRate).toBeCloseTo(130 / 300);
  });

  it("computes correct mean per-school acceptance rate", () => {
    const records: ComputedRecord[] = [
      makeComputedRecord({
        schoolId: "pub1",
        schoolType: "public",
        applicants: 100,
        admits: 50,
        acceptanceRate: 0.5,
      }),
      makeComputedRecord({
        schoolId: "pub2",
        schoolType: "public",
        applicants: 200,
        admits: 80,
        acceptanceRate: 0.4,
      }),
    ];

    const result = computeGroupAggregate(records, "public");
    expect(result.meanSchoolAcceptanceRate).toBeCloseTo(0.45);
  });

  it("computes correct median per-school acceptance rate", () => {
    const records: ComputedRecord[] = [
      makeComputedRecord({
        schoolId: "pub1",
        schoolType: "public",
        applicants: 100,
        admits: 30,
        acceptanceRate: 0.3,
      }),
      makeComputedRecord({
        schoolId: "pub2",
        schoolType: "public",
        applicants: 100,
        admits: 50,
        acceptanceRate: 0.5,
      }),
      makeComputedRecord({
        schoolId: "pub3",
        schoolType: "public",
        applicants: 100,
        admits: 70,
        acceptanceRate: 0.7,
      }),
    ];

    const result = computeGroupAggregate(records, "public");
    expect(result.medianSchoolAcceptanceRate).toBeCloseTo(0.5);
  });

  it("computes weighted mean GPA", () => {
    const records: ComputedRecord[] = [
      makeComputedRecord({
        schoolId: "pub1",
        schoolType: "public",
        applicants: 100,
        gpaApplicants: 3.5,
      }),
      makeComputedRecord({
        schoolId: "pub2",
        schoolType: "public",
        applicants: 200,
        gpaApplicants: 3.8,
      }),
    ];

    const result = computeGroupAggregate(records, "public");
    // (3.5*100 + 3.8*200) / 300 = 1110/300 = 3.7
    expect(result.meanGpa).toBeCloseTo(3.7);
  });

  it("excludes null records from aggregates", () => {
    const records: ComputedRecord[] = [
      makeComputedRecord({
        schoolId: "pub1",
        schoolType: "public",
        applicants: 100,
        admits: 50,
        gpaApplicants: 3.8,
        acceptanceRate: 0.5,
      }),
      makeComputedRecord({
        schoolId: "pub2",
        schoolType: "public",
        applicants: null,
        admits: null,
        gpaApplicants: null,
        acceptanceRate: null,
      }),
    ];

    const result = computeGroupAggregate(records, "public");
    expect(result.schoolCount).toBe(2);
    expect(result.totalApplicants).toBe(100); // null excluded
    expect(result.totalAdmits).toBe(50);
    expect(result.acceptanceRate).toBeCloseTo(0.5);
    expect(result.meanSchoolAcceptanceRate).toBeCloseTo(0.5); // only one valid rate
  });

  it("returns zeros for no matching records", () => {
    const records: ComputedRecord[] = [
      makeComputedRecord({ schoolType: "public" }),
    ];

    const result = computeGroupAggregate(records, "private");
    expect(result.schoolCount).toBe(0);
    expect(result.totalApplicants).toBe(0);
    expect(result.totalAdmits).toBe(0);
    expect(result.acceptanceRate).toBe(0);
    expect(result.meanGpa).toBe(0);
  });

  it("filters correctly by school type", () => {
    const records: ComputedRecord[] = [
      makeComputedRecord({
        schoolId: "pub1",
        schoolType: "public",
        applicants: 100,
        admits: 50,
      }),
      makeComputedRecord({
        schoolId: "priv1",
        schoolType: "private",
        applicants: 50,
        admits: 40,
      }),
    ];

    const publicResult = computeGroupAggregate(records, "public");
    expect(publicResult.totalApplicants).toBe(100);

    const privateResult = computeGroupAggregate(records, "private");
    expect(privateResult.totalApplicants).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// computeCampusSummaries
// ---------------------------------------------------------------------------

describe("computeCampusSummaries", () => {
  it("groups by campus and year", () => {
    const records: ComputedRecord[] = [
      makeComputedRecord({
        campus: "berkeley",
        year: 2023,
        schoolType: "public",
      }),
      makeComputedRecord({
        campus: "berkeley",
        year: 2024,
        schoolType: "public",
      }),
      makeComputedRecord({
        campus: "davis",
        year: 2024,
        schoolType: "public",
      }),
    ];

    const summaries = computeCampusSummaries(records);
    expect(summaries).toHaveLength(3);
  });

  it("includes correct campus display names", () => {
    const records: ComputedRecord[] = [
      makeComputedRecord({ campus: "berkeley", year: 2024 }),
    ];

    const summaries = computeCampusSummaries(records);
    expect(summaries[0]!.campusName).toBe("UC Berkeley");
  });

  it("computes public and private aggregates separately", () => {
    const records: ComputedRecord[] = [
      makeComputedRecord({
        schoolId: "pub1",
        campus: "berkeley",
        year: 2024,
        schoolType: "public",
        applicants: 100,
        admits: 50,
        acceptanceRate: 0.5,
      }),
      makeComputedRecord({
        schoolId: "priv1",
        campus: "berkeley",
        year: 2024,
        schoolType: "private",
        applicants: 50,
        admits: 40,
        acceptanceRate: 0.8,
      }),
    ];

    const summaries = computeCampusSummaries(records);
    expect(summaries).toHaveLength(1);
    expect(summaries[0]!.public.totalApplicants).toBe(100);
    expect(summaries[0]!.private.totalApplicants).toBe(50);
  });

  it("sorts by campus then year", () => {
    const records: ComputedRecord[] = [
      makeComputedRecord({ campus: "davis", year: 2024 }),
      makeComputedRecord({ campus: "berkeley", year: 2023 }),
      makeComputedRecord({ campus: "berkeley", year: 2024 }),
    ];

    const summaries = computeCampusSummaries(records);
    expect(summaries[0]!.campus).toBe("berkeley");
    expect(summaries[0]!.year).toBe(2023);
    expect(summaries[1]!.campus).toBe("berkeley");
    expect(summaries[1]!.year).toBe(2024);
    expect(summaries[2]!.campus).toBe("davis");
  });
});

// ---------------------------------------------------------------------------
// computePipelineMetrics (integration)
// ---------------------------------------------------------------------------

describe("computePipelineMetrics", () => {
  it("returns both records and summaries", () => {
    const enrichedRecords: EnrichedRecord[] = [
      makeEnrichedRecord({
        campus: "berkeley",
        year: 2024,
        schoolType: "public",
      }),
    ];

    const result = computePipelineMetrics(enrichedRecords);
    expect(result.records).toHaveLength(1);
    expect(result.summaries).toHaveLength(1);
  });

  it("computes acceptance rate on each record", () => {
    const enrichedRecords: EnrichedRecord[] = [
      makeEnrichedRecord({ applicants: 200, admits: 100 }),
    ];

    const result = computePipelineMetrics(enrichedRecords);
    expect(result.records[0]!.acceptanceRate).toBeCloseTo(0.5);
  });

  it("handles null data correctly (null in = null out)", () => {
    const enrichedRecords: EnrichedRecord[] = [
      makeEnrichedRecord({ applicants: null, admits: null }),
    ];

    const result = computePipelineMetrics(enrichedRecords);
    expect(result.records[0]!.acceptanceRate).toBeNull();
  });

  it("generates summaries for all campus/year combinations", () => {
    const enrichedRecords: EnrichedRecord[] = [
      makeEnrichedRecord({ campus: "berkeley", year: 2023 }),
      makeEnrichedRecord({ campus: "berkeley", year: 2024 }),
      makeEnrichedRecord({ campus: "davis", year: 2024 }),
    ];

    const result = computePipelineMetrics(enrichedRecords);
    expect(result.summaries).toHaveLength(3);
  });
});
