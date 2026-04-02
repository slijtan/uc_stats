// ============================================================
// Statistics Service
// Correlation, quartile, regression, and equity gap utilities
// ============================================================

/** A point in 2D space used for statistical computations */
export interface Point {
  x: number;
  y: number;
}

/** Result of a Pearson correlation computation */
export interface CorrelationResult {
  /** Pearson correlation coefficient (-1 to 1) */
  r: number;
  /** Coefficient of determination (0 to 1) */
  r2: number;
  /** Human-readable strength label */
  label: string;
}

/** Result of quartile-based statistics */
export interface QuartileResult {
  /** Quartile label (e.g., "Bottom 25%") */
  label: string;
  /** Average Y value within this quartile */
  avgY: number;
  /** Number of points in this quartile */
  count: number;
  /** Minimum X value in this quartile */
  minX: number;
  /** Maximum X value in this quartile */
  maxX: number;
}

/** Result of ordinary least-squares linear regression */
export interface RegressionResult {
  /** Slope of the regression line */
  slope: number;
  /** Y-intercept of the regression line */
  intercept: number;
}

// ============================================================
// Correlation
// ============================================================

/**
 * Compute Pearson correlation coefficient, R², and a human-readable label.
 * Returns {r:0, r2:0, label:"Insufficient data"} if fewer than 3 points.
 */
export function computeCorrelation(points: Point[]): CorrelationResult {
  if (points.length < 3) {
    return { r: 0, r2: 0, label: "Insufficient data" };
  }

  const n = points.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumX2 += p.x * p.x;
    sumY2 += p.y * p.y;
  }

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt(
    (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
  );

  if (denominator === 0) {
    return { r: 0, r2: 0, label: "No correlation" };
  }

  const r = numerator / denominator;
  const r2 = r * r;

  return { r, r2, label: classifyCorrelation(r) };
}

function classifyCorrelation(r: number): string {
  const abs = Math.abs(r);
  const direction = r >= 0 ? "positive" : "negative";

  if (abs > 0.7) return `Strong ${direction}`;
  if (abs > 0.4) return `Moderate ${direction}`;
  if (abs > 0.2) return `Weak ${direction}`;
  return "No correlation";
}

// ============================================================
// Quartile Statistics
// ============================================================

const QUARTILE_LABELS = ["Bottom 25%", "25th–50th", "50th–75th", "Top 25%"];

/**
 * Sort points by X, split into 4 equal groups, and compute average Y per group.
 * Returns [] if fewer than 4 points.
 */
export function computeQuartileStats(points: Point[]): QuartileResult[] {
  if (points.length < 4) {
    return [];
  }

  const sorted = [...points].sort((a, b) => a.x - b.x);
  const n = sorted.length;
  const quartileSize = Math.floor(n / 4);
  const remainder = n % 4;

  const results: QuartileResult[] = [];
  let offset = 0;

  for (let q = 0; q < 4; q++) {
    // Distribute remainder points across the first `remainder` quartiles
    const size = quartileSize + (q < remainder ? 1 : 0);
    const slice = sorted.slice(offset, offset + size);
    offset += size;

    const sumY = slice.reduce((acc, p) => acc + p.y, 0);

    results.push({
      label: QUARTILE_LABELS[q],
      avgY: sumY / slice.length,
      count: slice.length,
      minX: slice[0].x,
      maxX: slice[slice.length - 1].x,
    });
  }

  return results;
}

// ============================================================
// Linear Regression (OLS)
// ============================================================

/**
 * Compute ordinary least-squares linear regression.
 * Returns {slope:0, intercept:0} if fewer than 2 points.
 */
export function computeLinearRegression(points: Point[]): RegressionResult {
  if (points.length < 2) {
    return { slope: 0, intercept: 0 };
  }

  const n = points.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumX2 += p.x * p.x;
  }

  const denominator = n * sumX2 - sumX * sumX;

  if (denominator === 0) {
    return { slope: 0, intercept: sumY / n };
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
}

// ============================================================
// Equity Gap
// ============================================================

/**
 * Compute equity gap using quartile statistics.
 * Gap = Q4 avgY / Q1 avgY. Returns {gap:0, label:""} if quartiles can't be computed.
 */
export function computeEquityGap(
  points: Point[]
): { gap: number; label: string } {
  const quartiles = computeQuartileStats(points);

  if (quartiles.length < 4) {
    return { gap: 0, label: "" };
  }

  const q1Avg = quartiles[0].avgY;
  const q4Avg = quartiles[3].avgY;

  if (q1Avg === 0) {
    return { gap: Infinity, label: "superlinear — advantage compounds significantly" };
  }

  const gap = q4Avg / q1Avg;

  return { gap, label: classifyEquityGap(gap) };
}

function classifyEquityGap(gap: number): string {
  if (gap > 2.0) {
    return "superlinear — advantage compounds significantly";
  }
  if (gap > 1.3) {
    return "moderately superlinear — higher-quality schools have a disproportionate edge";
  }
  if (gap > 0.8) {
    return "roughly proportional — school quality tracks linearly with admissions";
  }
  return "sublinear — lower-ranked schools may receive an equity boost";
}
