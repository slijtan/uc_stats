import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type { SchoolQuality } from "../../src/types/index.ts";
import {
  mergeCdeQuality,
  parseCciFile,
  parseCgrFile,
} from "../../scripts/extract/parse-cde-quality.ts";

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cde-quality-test-"));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeTempFile(name: string, content: string): string {
  const filePath = path.join(tmpDir, name);
  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}

// ---------------------------------------------------------------------------
// parseCciFile tests
// ---------------------------------------------------------------------------

describe("parseCciFile", () => {
  it("extracts CCI base metrics and pathway breakdowns", () => {
    const data = [
      "cds\trtype\tstudentgroup\tcurrstatus\tcurr_aprep_pct\tcurr_nprep_pct\tcurr_prep_ap_pct\tcurr_prep_ibexam_pct\tcurr_prep_collegecredit_pct\tcurr_prep_agplus_pct\tcurr_prep_cteplus_pct\tcurr_prep_ssb_pct\tcurr_prep_milsci_pct",
      "01100170112607\tS\tALL\t78.0\t6.0\t16.0\t25.0\t0.0\t10.5\t45.0\t15.0\t3.0\t1.5",
    ].join("\n");
    const filePath = writeTempFile("cci-test.txt", data);
    const result = parseCciFile(filePath);

    expect(result.size).toBe(1);
    const school = result.get("01100170112607")!;
    expect(school.cci).toBe(78.0);
    expect(school.cciApproaching).toBe(6.0);
    expect(school.cciNotPrepared).toBe(16.0);
    expect(school.cciPathwayAp).toBe(25.0);
    expect(school.cciPathwayIb).toBe(0.0);
    expect(school.cciPathwayCollegeCredit).toBe(10.5);
    expect(school.cciPathwayAg).toBe(45.0);
    expect(school.cciPathwayCte).toBe(15.0);
    expect(school.cciPathwayBiliteracy).toBe(3.0);
    expect(school.cciPathwayMilitary).toBe(1.5);
  });

  it("handles suppressed pathway values", () => {
    const data = [
      "cds\trtype\tstudentgroup\tcurrstatus\tcurr_aprep_pct\tcurr_nprep_pct\tcurr_prep_ap_pct\tcurr_prep_ibexam_pct\tcurr_prep_collegecredit_pct\tcurr_prep_agplus_pct\tcurr_prep_cteplus_pct\tcurr_prep_ssb_pct\tcurr_prep_milsci_pct",
      "01611190106401\tS\tALL\t95.0\t3.0\t2.0\t*\t--\t\t50.0\t*\t*\t*",
    ].join("\n");
    const filePath = writeTempFile("cci-suppressed.txt", data);
    const result = parseCciFile(filePath);

    expect(result.size).toBe(1);
    const school = result.get("01611190106401")!;
    expect(school.cci).toBe(95.0);
    expect(school.cciPathwayAp).toBeUndefined();
    expect(school.cciPathwayIb).toBeUndefined();
    expect(school.cciPathwayCollegeCredit).toBeUndefined();
    expect(school.cciPathwayAg).toBe(50.0);
    expect(school.cciPathwayCte).toBeUndefined();
    expect(school.cciPathwayBiliteracy).toBeUndefined();
    expect(school.cciPathwayMilitary).toBeUndefined();
  });

  it("filters non-school records and non-ALL student groups", () => {
    const data = [
      "cds\trtype\tstudentgroup\tcurrstatus\tcurr_aprep_pct\tcurr_nprep_pct\tcurr_prep_ap_pct\tcurr_prep_ibexam_pct\tcurr_prep_collegecredit_pct\tcurr_prep_agplus_pct\tcurr_prep_cteplus_pct\tcurr_prep_ssb_pct\tcurr_prep_milsci_pct",
      "01100170000000\tD\tALL\t50.0\t10.0\t40.0\t5.0\t0.0\t0.0\t20.0\t10.0\t0.0\t0.0",
      "01100170112607\tS\tHI\t60.0\t15.0\t25.0\t8.0\t0.0\t0.0\t30.0\t5.0\t0.0\t0.0",
      "01100170112607\tS\tALL\t78.0\t6.0\t16.0\t25.0\t0.0\t10.5\t45.0\t15.0\t3.0\t1.5",
    ].join("\n");
    const filePath = writeTempFile("cci-filter.txt", data);
    const result = parseCciFile(filePath);

    expect(result.size).toBe(1);
    expect(result.has("01100170112607")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// parseCgrFile tests
// ---------------------------------------------------------------------------

describe("parseCgrFile", () => {
  it("extracts college-going rates and institution breakdowns", () => {
    const data = [
      "AcademicYear\tAggregateLevel\tCountyCode\tDistrictCode\tSchoolCode\tCountyName\tDistrictName\tSchoolName\tCharterSchool\tAlternativeSchoolAccountabilityStatus\tReportingCategory\tCompleterType\tHigh School Completers\tEnrolled In College - Total (12 Months)\tCollege Going Rate - Total (12 Months)\tEnrolled In-State (12 Months)\tEnrolled Out-of-State (12 Months)\tNot Enrolled In College (12 Months)\tEnrolled UC (12 Months)\tEnrolled CSU (12 Months)\tEnrolled CCC (12 Months)\tEnrolled In-State Private (2 and 4 Year) (12 Months)\tEnrolled Out-of-State 4-Year College (Public/Private) (12 Months)\tEnrolled Out-of-State 2-Year College (Public/Private) (12 Months)",
      "2022-23\tS\t01\t10017\t0112607\tAlameda\tTest District\tTest School\tNo\tNo\tTA\tTA\t200\t160\t80.0\t150\t10\t40\t30\t50\t60\t10\t8\t2",
    ].join("\n");
    const filePath = writeTempFile("cgr-test.txt", data);
    const result = parseCgrFile(filePath);

    expect(result.size).toBe(1);
    const school = result.get("01100170112607")!;
    expect(school.collegeGoingRate).toBe(80.0);
    expect(school.collegeGoingUC).toBe(30);
    expect(school.collegeGoingCSU).toBe(50);
    // CCC: 60/200 * 100 = 30.0
    expect(school.collegeGoingCCC).toBe(30.0);
    // In-State Private: 10/200 * 100 = 5.0
    expect(school.collegeGoingInStatePrivate).toBe(5.0);
    // Out-of-State: 10/200 * 100 = 5.0
    expect(school.collegeGoingOutOfState).toBe(5.0);
  });

  it("computes rates correctly with rounding", () => {
    const data = [
      "AcademicYear\tAggregateLevel\tCountyCode\tDistrictCode\tSchoolCode\tCountyName\tDistrictName\tSchoolName\tCharterSchool\tAlternativeSchoolAccountabilityStatus\tReportingCategory\tCompleterType\tHigh School Completers\tEnrolled In College - Total (12 Months)\tCollege Going Rate - Total (12 Months)\tEnrolled In-State (12 Months)\tEnrolled Out-of-State (12 Months)\tNot Enrolled In College (12 Months)\tEnrolled UC (12 Months)\tEnrolled CSU (12 Months)\tEnrolled CCC (12 Months)\tEnrolled In-State Private (2 and 4 Year) (12 Months)\tEnrolled Out-of-State 4-Year College (Public/Private) (12 Months)\tEnrolled Out-of-State 2-Year College (Public/Private) (12 Months)",
      "2022-23\tS\t19\t64733\t0000001\tLos Angeles\tTest\tTest HS\tNo\tNo\tTA\tTA\t300\t240\t80.0\t220\t20\t60\t45\t75\t90\t10\t15\t5",
    ].join("\n");
    const filePath = writeTempFile("cgr-rates.txt", data);
    const result = parseCgrFile(filePath);

    const school = result.get("19647330000001")!;
    // CCC: 90/300 * 100 = 30.0
    expect(school.collegeGoingCCC).toBe(30.0);
    // In-State Private: 10/300 * 100 = 3.3333... → rounds to 3.3
    expect(school.collegeGoingInStatePrivate).toBe(3.3);
    // Out-of-State: 20/300 * 100 = 6.6666... → rounds to 6.7
    expect(school.collegeGoingOutOfState).toBe(6.7);
  });

  it("skips institution breakdowns when completers is zero or missing", () => {
    const data = [
      "AcademicYear\tAggregateLevel\tCountyCode\tDistrictCode\tSchoolCode\tCountyName\tDistrictName\tSchoolName\tCharterSchool\tAlternativeSchoolAccountabilityStatus\tReportingCategory\tCompleterType\tHigh School Completers\tEnrolled In College - Total (12 Months)\tCollege Going Rate - Total (12 Months)\tEnrolled In-State (12 Months)\tEnrolled Out-of-State (12 Months)\tNot Enrolled In College (12 Months)\tEnrolled UC (12 Months)\tEnrolled CSU (12 Months)\tEnrolled CCC (12 Months)\tEnrolled In-State Private (2 and 4 Year) (12 Months)\tEnrolled Out-of-State 4-Year College (Public/Private) (12 Months)\tEnrolled Out-of-State 2-Year College (Public/Private) (12 Months)",
      "2022-23\tS\t19\t64733\t0000002\tLos Angeles\tTest\tTest HS\tNo\tNo\tTA\tTA\t*\t*\t*\t*\t*\t*\t*\t*\t*\t*\t*\t*",
    ].join("\n");
    const filePath = writeTempFile("cgr-suppressed.txt", data);
    const result = parseCgrFile(filePath);

    // All values suppressed → nothing stored
    expect(result.size).toBe(0);
  });

  it("filters non-school and non-TA records", () => {
    const data = [
      "AcademicYear\tAggregateLevel\tCountyCode\tDistrictCode\tSchoolCode\tCountyName\tDistrictName\tSchoolName\tCharterSchool\tAlternativeSchoolAccountabilityStatus\tReportingCategory\tCompleterType\tHigh School Completers\tEnrolled In College - Total (12 Months)\tCollege Going Rate - Total (12 Months)\tEnrolled In-State (12 Months)\tEnrolled Out-of-State (12 Months)\tNot Enrolled In College (12 Months)\tEnrolled UC (12 Months)\tEnrolled CSU (12 Months)\tEnrolled CCC (12 Months)\tEnrolled In-State Private (2 and 4 Year) (12 Months)\tEnrolled Out-of-State 4-Year College (Public/Private) (12 Months)\tEnrolled Out-of-State 2-Year College (Public/Private) (12 Months)",
      "2022-23\tD\t01\t10017\t0000000\tAlameda\tTest\tDistrict\tNo\tNo\tTA\tTA\t500\t400\t80.0\t380\t20\t100\t80\t120\t140\t40\t15\t5",
      "2022-23\tS\t01\t10017\t0112607\tAlameda\tTest\tTest HS\tNo\tNo\tHI\tTA\t100\t80\t80.0\t70\t10\t20\t15\t25\t20\t10\t8\t2",
      "2022-23\tS\t01\t10017\t0112607\tAlameda\tTest\tTest HS\tNo\tNo\tTA\tAGY\t100\t80\t80.0\t70\t10\t20\t15\t25\t20\t10\t8\t2",
      "2022-23\tS\t01\t10017\t0112607\tAlameda\tTest\tTest HS\tNo\tNo\tTA\tTA\t100\t80\t80.0\t70\t10\t20\t15\t25\t20\t10\t8\t2",
    ].join("\n");
    const filePath = writeTempFile("cgr-filter.txt", data);
    const result = parseCgrFile(filePath);

    // Only the last row passes filters
    expect(result.size).toBe(1);
    expect(result.has("01100170112607")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// mergeCdeQuality tests
// ---------------------------------------------------------------------------

describe("mergeCdeQuality", () => {
  it("merges data from multiple sources by CDS code", () => {
    const cciMap = new Map<string, Partial<SchoolQuality>>([
      ["01100170112607", { cci: 78.0, cciApproaching: 6.0, cciNotPrepared: 16.0 }],
      ["01611190106401", { cci: 95.0 }],
    ]);

    const acgrMap = new Map<string, Partial<SchoolQuality>>([
      ["01100170112607", { gradRate: 86.0, agRate: 95.3 }],
      ["01611190106401", { gradRate: 98.0, agRate: 99.0 }],
    ]);

    const caasppMap = new Map<string, Partial<SchoolQuality>>([
      ["01100170112607", { caasppEla: 2500.5, caasppMath: 2450.2, caasppElaPctMet: 55.0, caasppMathPctMet: 40.0 }],
    ]);

    const result = mergeCdeQuality(cciMap, acgrMap, caasppMap);

    expect(result.size).toBe(2);

    const school1 = result.get("01100170112607");
    expect(school1).toBeDefined();
    expect(school1!.cci).toBe(78.0);
    expect(school1!.cciApproaching).toBe(6.0);
    expect(school1!.cciNotPrepared).toBe(16.0);
    expect(school1!.gradRate).toBe(86.0);
    expect(school1!.agRate).toBe(95.3);
    expect(school1!.caasppEla).toBe(2500.5);
    expect(school1!.caasppMath).toBe(2450.2);
    expect(school1!.caasppElaPctMet).toBe(55.0);
    expect(school1!.caasppMathPctMet).toBe(40.0);

    const school2 = result.get("01611190106401");
    expect(school2).toBeDefined();
    expect(school2!.cci).toBe(95.0);
    expect(school2!.gradRate).toBe(98.0);
    expect(school2!.agRate).toBe(99.0);
    // school2 has no CAASPP data
    expect(school2!.caasppEla).toBeUndefined();
  });

  it("merges new field types (pathways, FRPM, CRDC)", () => {
    const cciMap = new Map<string, Partial<SchoolQuality>>([
      ["01100170112607", { cci: 78.0, cciPathwayAp: 25.0, cciPathwayAg: 45.0 }],
    ]);

    const frpmMap = new Map<string, Partial<SchoolQuality>>([
      ["01100170112607", { freeReducedMealPct: 55.3 }],
    ]);

    const crdcMap = new Map<string, Partial<SchoolQuality>>([
      ["01100170112607", { apCoursesOffered: 15 }],
    ]);

    const result = mergeCdeQuality(cciMap, frpmMap, crdcMap);
    const school = result.get("01100170112607")!;
    expect(school.cci).toBe(78.0);
    expect(school.cciPathwayAp).toBe(25.0);
    expect(school.cciPathwayAg).toBe(45.0);
    expect(school.freeReducedMealPct).toBe(55.3);
    expect(school.apCoursesOffered).toBe(15);
  });

  it("handles schools with partial data (only in some sources)", () => {
    const cciMap = new Map<string, Partial<SchoolQuality>>([
      ["19647330000001", { cci: 45.0 }],
    ]);

    const chronicMap = new Map<string, Partial<SchoolQuality>>([
      ["19647330000002", { chronicAbsentRate: 22.5 }],
    ]);

    const suspMap = new Map<string, Partial<SchoolQuality>>([
      ["19647330000001", { suspensionRate: 3.2 }],
      ["19647330000003", { suspensionRate: 1.1 }],
    ]);

    const result = mergeCdeQuality(cciMap, chronicMap, suspMap);

    // 3 unique CDS codes across maps
    expect(result.size).toBe(3);

    // School 1: has CCI + suspension, no chronic
    const s1 = result.get("19647330000001");
    expect(s1).toBeDefined();
    expect(s1!.cci).toBe(45.0);
    expect(s1!.suspensionRate).toBe(3.2);
    expect(s1!.chronicAbsentRate).toBeUndefined();

    // School 2: only chronic
    const s2 = result.get("19647330000002");
    expect(s2).toBeDefined();
    expect(s2!.chronicAbsentRate).toBe(22.5);
    expect(s2!.cci).toBeUndefined();
    expect(s2!.suspensionRate).toBeUndefined();

    // School 3: only suspension
    const s3 = result.get("19647330000003");
    expect(s3).toBeDefined();
    expect(s3!.suspensionRate).toBe(1.1);
    expect(s3!.cci).toBeUndefined();
  });

  it("returns empty map for empty inputs", () => {
    const result = mergeCdeQuality();
    expect(result.size).toBe(0);
  });

  it("returns empty map when all input maps are empty", () => {
    const empty1 = new Map<string, Partial<SchoolQuality>>();
    const empty2 = new Map<string, Partial<SchoolQuality>>();
    const result = mergeCdeQuality(empty1, empty2);
    expect(result.size).toBe(0);
  });

  it("later maps override earlier maps for the same field", () => {
    const map1 = new Map<string, Partial<SchoolQuality>>([
      ["01100170112607", { gradRate: 80.0 }],
    ]);
    const map2 = new Map<string, Partial<SchoolQuality>>([
      ["01100170112607", { gradRate: 85.0, agRate: 70.0 }],
    ]);

    const result = mergeCdeQuality(map1, map2);
    const school = result.get("01100170112607");
    expect(school).toBeDefined();
    // map2 value should win
    expect(school!.gradRate).toBe(85.0);
    expect(school!.agRate).toBe(70.0);
  });
});
