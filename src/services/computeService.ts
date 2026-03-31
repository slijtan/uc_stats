import type {
  AdmissionRecord,
  ComputedMetrics,
  GroupAggregate,
  School,
  SchoolId,
  SchoolType,
} from "../types";

/**
 * Compute the acceptance rate for an admission record.
 *
 * @returns admits / applicants, or null if either value is null
 */
export function computeAcceptanceRate(record: AdmissionRecord): number | null {
  if (record.admits === null || record.applicants === null || record.applicants === 0) {
    return null;
  }
  return record.admits / record.applicants;
}

/**
 * Compute the yield rate for an admission record.
 *
 * @returns enrollees / admits, or null if either value is null
 */
export function computeYield(record: AdmissionRecord): number | null {
  if (record.enrollees === null || record.admits === null || record.admits === 0) {
    return null;
  }
  return record.enrollees / record.admits;
}

/**
 * Compute all derived metrics for an admission record.
 */
export function computeMetrics(record: AdmissionRecord): ComputedMetrics {
  return {
    acceptanceRate: computeAcceptanceRate(record),
    yield: computeYield(record),
  };
}

/**
 * Filter admission records by year and/or school IDs.
 *
 * @param records - Array of admission records to filter
 * @param filters - Optional year and schoolIds to filter by
 * @returns Filtered array of records matching all specified criteria
 */
export function filterRecords(
  records: AdmissionRecord[],
  filters: { year?: number; schoolIds?: SchoolId[] },
): AdmissionRecord[] {
  let result = records;

  if (filters.year !== undefined) {
    result = result.filter((r) => r.year === filters.year);
  }

  if (filters.schoolIds !== undefined) {
    const idSet = new Set(filters.schoolIds);
    result = result.filter((r) => idSet.has(r.schoolId));
  }

  return result;
}

/**
 * Compute aggregate statistics for a group of schools of a given type.
 *
 * Calculates total applicants/admits, aggregate acceptance rate,
 * mean and median per-school acceptance rates, and weighted mean GPA.
 *
 * @param records - Admission records (typically pre-filtered to a single year)
 * @param schools - All school metadata (used to look up school type)
 * @param schoolType - The school type to aggregate ("public" or "private")
 * @returns Aggregate statistics for the specified school type
 */
export function computeGroupAggregate(
  records: AdmissionRecord[],
  schools: School[],
  schoolType: SchoolType,
): GroupAggregate {
  // Build a lookup of school type by ID
  const schoolTypeMap = new Map<SchoolId, SchoolType>();
  for (const school of schools) {
    schoolTypeMap.set(school.id, school.type);
  }

  // Filter records to only the requested school type
  const filteredRecords = records.filter(
    (r) => schoolTypeMap.get(r.schoolId) === schoolType,
  );

  // Track unique schools and per-school acceptance rates
  const schoolIds = new Set<SchoolId>();
  let totalApplicants = 0;
  let totalAdmits = 0;
  const perSchoolRates: number[] = [];

  // Track GPA weighting
  let gpaWeightedSum = 0;
  let gpaWeightTotal = 0;

  for (const record of filteredRecords) {
    schoolIds.add(record.schoolId);

    if (record.applicants !== null) {
      totalApplicants += record.applicants;

      // Weighted GPA: weight by number of applicants
      if (record.gpaApplicants !== null) {
        gpaWeightedSum += record.gpaApplicants * record.applicants;
        gpaWeightTotal += record.applicants;
      }
    }

    if (record.admits !== null) {
      totalAdmits += record.admits;
    }

    const rate = computeAcceptanceRate(record);
    if (rate !== null) {
      perSchoolRates.push(rate);
    }
  }

  // Calculate aggregate acceptance rate
  const acceptanceRate =
    totalApplicants > 0 ? totalAdmits / totalApplicants : 0;

  // Calculate mean per-school acceptance rate
  const meanSchoolAcceptanceRate =
    perSchoolRates.length > 0
      ? perSchoolRates.reduce((sum, r) => sum + r, 0) / perSchoolRates.length
      : 0;

  // Calculate median per-school acceptance rate
  const sorted = [...perSchoolRates].sort((a, b) => a - b);
  let medianSchoolAcceptanceRate = 0;
  if (sorted.length > 0) {
    const mid = Math.floor(sorted.length / 2);
    medianSchoolAcceptanceRate =
      sorted.length % 2 === 0
        ? (sorted[mid - 1]! + sorted[mid]!) / 2
        : sorted[mid]!;
  }

  // Calculate weighted mean GPA
  const meanGpa = gpaWeightTotal > 0 ? gpaWeightedSum / gpaWeightTotal : 0;

  return {
    schoolCount: schoolIds.size,
    totalApplicants,
    totalAdmits,
    acceptanceRate,
    meanSchoolAcceptanceRate,
    medianSchoolAcceptanceRate,
    meanGpa,
  };
}
