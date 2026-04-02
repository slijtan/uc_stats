import { describe, it, expect } from "vitest";
import {
  computeCorrelation,
  computeQuartileStats,
  computeLinearRegression,
  computeEquityGap,
} from "../../src/services/statsService";

describe("statsService", () => {
  const perfectLine = [
    { x: 10, y: 5 },
    { x: 20, y: 10 },
    { x: 30, y: 15 },
    { x: 40, y: 20 },
    { x: 50, y: 25 },
    { x: 60, y: 30 },
    { x: 70, y: 35 },
    { x: 80, y: 40 },
  ];

  describe("computeCorrelation", () => {
    it("returns 1.0 for perfect positive correlation", () => {
      const { r, r2 } = computeCorrelation(perfectLine);
      expect(r).toBeCloseTo(1.0, 5);
      expect(r2).toBeCloseTo(1.0, 5);
    });
    it("returns 0 for empty input", () => {
      expect(computeCorrelation([]).r).toBe(0);
    });
    it("classifies strength correctly", () => {
      expect(computeCorrelation(perfectLine).label).toBe("Strong positive");
    });
    it("returns Insufficient data for <3 points", () => {
      expect(computeCorrelation([{ x: 1, y: 1 }]).label).toBe(
        "Insufficient data"
      );
    });
  });

  describe("computeQuartileStats", () => {
    it("computes average Y per quartile", () => {
      const q = computeQuartileStats(perfectLine);
      expect(q).toHaveLength(4);
      expect(q[0].avgY).toBeCloseTo(7.5, 1);
      expect(q[3].avgY).toBeCloseTo(37.5, 1);
    });
    it("returns empty for <4 points", () => {
      expect(computeQuartileStats([{ x: 1, y: 1 }])).toEqual([]);
    });
  });

  describe("computeLinearRegression", () => {
    it("returns correct slope and intercept", () => {
      const { slope, intercept } = computeLinearRegression(perfectLine);
      expect(slope).toBeCloseTo(0.5, 5);
      expect(intercept).toBeCloseTo(0, 5);
    });
  });

  describe("computeEquityGap", () => {
    it("computes gap ratio", () => {
      const { gap } = computeEquityGap(perfectLine);
      expect(gap).toBeCloseTo(5.0, 1);
    });
    it("labels superlinear for high gap", () => {
      const { label } = computeEquityGap(perfectLine);
      expect(label).toContain("superlinear");
    });
  });
});
