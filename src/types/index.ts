// ============================================================
// School Index (school-index.json)
// ============================================================

/**
 * Unique identifier for a school, derived from CDE CDS code
 * or a generated ID for unmatched schools.
 */
export type SchoolId = string;

/** School type as classified by the UC Information Center */
export type SchoolType = "public" | "private";

/** UC campus slug used as file identifier and filter value */
export type CampusSlug =
  | "systemwide"
  | "berkeley"
  | "davis"
  | "irvine"
  | "la"
  | "merced"
  | "riverside"
  | "san-diego"
  | "santa-barbara"
  | "santa-cruz";

/**
 * Metadata for a single high school.
 * Loaded at startup for search and filtering.
 */
export interface School {
  /** Unique school identifier */
  id: SchoolId;
  /** Display name (from CDE directory, or UC name if unmatched) */
  name: string;
  /** Public or private */
  type: SchoolType;
  /** California county */
  county: string;
  /** City */
  city: string;
  /** Original name as it appears in UC data (for debugging/matching) */
  ucName: string;
  /** Whether this school was matched to a CDE directory entry */
  matched: boolean;
  /** How this school was matched to a CDE directory entry */
  matchMethod: "exact" | "normalized" | "fuzzy" | "override" | "unmatched";
  /** Years for which any data exists (for quick filtering) */
  yearsAvailable: number[];
  /** Grade 12 enrollment by year from CDE data. Key is UC admissions year (string). */
  grade12Enrollment: Record<string, number>;
  /** School quality metrics from CDE/external data sources */
  quality?: SchoolQuality;
}

/** School quality and accountability metrics from CDE and external data sources */
export interface SchoolQuality {
  /** College/Career Indicator (CCI) percentage prepared */
  cci?: number;
  /** CCI percentage approaching prepared */
  cciApproaching?: number;
  /** CCI percentage not prepared */
  cciNotPrepared?: number;
  /** CAASPP ELA average scale score */
  caasppEla?: number;
  /** CAASPP Math average scale score */
  caasppMath?: number;
  /** CAASPP ELA percent meeting or exceeding standard */
  caasppElaPctMet?: number;
  /** CAASPP Math percent meeting or exceeding standard */
  caasppMathPctMet?: number;
  /** Graduation rate (percentage) */
  gradRate?: number;
  /** A-G completion rate (percentage) */
  agRate?: number;
  /** Dropout rate (percentage) */
  dropoutRate?: number;
  /** College-going rate (percentage) */
  collegeGoingRate?: number;
  /** College-going rate to UC (percentage) */
  collegeGoingUC?: number;
  /** College-going rate to CSU (percentage) */
  collegeGoingCSU?: number;
  /** Chronic absenteeism rate (percentage) */
  chronicAbsentRate?: number;
  /** Suspension rate (percentage) */
  suspensionRate?: number;
  /** SchoolDigger rank (state-level) */
  schoolDiggerRank?: number;
  /** SchoolDigger star rating (1–5) */
  schoolDiggerStars?: number;
  /** Year the quality data corresponds to */
  dataYear?: number;
}

/** The school index file structure */
export interface SchoolIndex {
  /** Last updated timestamp (ISO 8601) */
  generatedAt: string;
  /** Total number of schools */
  totalSchools: number;
  /** Array of all schools */
  schools: School[];
}

// ============================================================
// Campus Data (campus-{slug}.json)
// ============================================================

/** A single admissions record for one school, one campus, one year */
export interface AdmissionRecord {
  /** References School.id in the school index */
  schoolId: SchoolId;
  /** Academic year (e.g., 2024 represents Fall 2024 admissions cycle) */
  year: number;
  /** School type as classified in UC data (public or private) */
  schoolType: SchoolType;
  /** Number of applicants (null if suppressed) */
  applicants: number | null;
  /** Number of admits (null if suppressed) */
  admits: number | null;
  /** Number of enrollees (null if suppressed) */
  enrollees: number | null;
  /** Mean high school GPA of applicants (null if suppressed) */
  gpaApplicants: number | null;
  /** Mean high school GPA of admits (null if suppressed) */
  gpaAdmits: number | null;
  /** Mean high school GPA of enrollees (null if suppressed) */
  gpaEnrollees: number | null;
}

/** Structure of each campus data file */
export interface CampusData {
  /** Campus slug */
  campus: CampusSlug;
  /** Campus display name (e.g., "UC Berkeley") */
  campusName: string;
  /** Year range covered */
  yearRange: { min: number; max: number };
  /** Total number of records in this file */
  totalRecords: number;
  /** All admission records for this campus */
  records: AdmissionRecord[];
}

// ============================================================
// Summary Data (summary.json)
// ============================================================

/** Pre-computed aggregate statistics for one group (public or private) */
export interface GroupAggregate {
  /** Number of schools in this group */
  schoolCount: number;
  /** Total applicants across all schools */
  totalApplicants: number;
  /** Total admits across all schools */
  totalAdmits: number;
  /** Aggregate acceptance rate (totalAdmits / totalApplicants) */
  acceptanceRate: number;
  /** Mean acceptance rate across individual schools (unweighted) */
  meanSchoolAcceptanceRate: number;
  /** Median acceptance rate across individual schools */
  medianSchoolAcceptanceRate: number;
  /** Mean GPA of applicants (weighted by applicant count) */
  meanGpa: number;
  /** Total enrollees across all schools (computed client-side) */
  totalEnrollees?: number;
  /** Yield rate: totalEnrollees / totalAdmits (computed client-side) */
  yieldRate?: number;
  /** Mean per-school application rate of class: applicants / seniors (computed client-side) */
  meanApplicationRateOfClass?: number;
  /** Mean per-school acceptance rate of class: admits / seniors (computed client-side) */
  meanAcceptanceRateOfClass?: number;
  /** Mean per-school enrollment rate of class: enrollees / seniors (computed client-side) */
  meanEnrollmentRateOfClass?: number;
  /** Number of schools that had grade 12 enrollment data for the year */
  schoolsWithEnrollmentData?: number;
}

/** Summary for a single campus and year */
export interface CampusSummary {
  /** Campus slug */
  campus: CampusSlug;
  /** Campus display name */
  campusName: string;
  /** Academic year */
  year: number;
  /** Aggregate statistics for public schools */
  public: GroupAggregate;
  /** Aggregate statistics for private schools */
  private: GroupAggregate;
}

/** The summary file structure */
export interface SummaryData {
  /** Last updated timestamp (ISO 8601) */
  generatedAt: string;
  /** Summary for the most recent year, all campuses */
  latestYear: number;
  /** Summaries organized by campus, then by year */
  summaries: CampusSummary[];
}

// ============================================================
// Derived/Computed Types (client-side only, not in JSON)
// ============================================================

/** Acceptance rate and related metrics computed on the client */
export interface ComputedMetrics {
  /** admits / applicants (null if either is null) */
  acceptanceRate: number | null;
  /** enrollees / admits (null if either is null) */
  yield: number | null;
}

/** A fully resolved school record for display, combining index + admission data */
export interface SchoolAdmissionView {
  /** School metadata */
  school: School;
  /** Raw admissions record */
  record: AdmissionRecord;
  /** Computed derived metrics */
  computed: ComputedMetrics;
  /** Campus display name (e.g., "UC Berkeley") — included when records span multiple campuses */
  campusName?: string;
}
