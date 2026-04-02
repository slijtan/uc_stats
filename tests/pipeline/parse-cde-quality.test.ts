import { describe, it, expect } from "vitest";
import type { SchoolQuality } from "../../src/types/index.ts";
import { mergeCdeQuality } from "../../scripts/extract/parse-cde-quality.ts";

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
