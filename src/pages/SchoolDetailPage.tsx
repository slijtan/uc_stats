import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import type {
  School,
  SchoolIndex,
  CampusData,
  CampusSlug,
  AdmissionRecord,
  SchoolAdmissionView,
} from "../types/index.ts";
import { getSchoolIndex, getCampusData } from "../services/dataService.ts";
import {
  computeAcceptanceRate,
  computeYield,
  computeMetrics,
  filterRecords,
} from "../services/computeService.ts";
import SchoolSearch from "../components/search/SchoolSearch.tsx";
import CampusMultiSelect, { ALL_CAMPUS_SLUGS } from "../components/filters/CampusMultiSelect.tsx";
import YearMultiSelect from "../components/filters/YearMultiSelect.tsx";
import AcceptanceRateBar from "../components/charts/AcceptanceRateBar.tsx";
import type { BarDataPoint } from "../components/charts/AcceptanceRateBar.tsx";
import TrendLine from "../components/charts/TrendLine.tsx";
import type {
  TrendDataPoint,
  TrendLineSeries,
} from "../components/charts/TrendLine.tsx";
import SchoolTable from "../components/tables/SchoolTable.tsx";
import MethodologyNote from "../components/common/MethodologyNote.tsx";

/** All campus slugs including systemwide */
const ALL_CAMPUSES: CampusSlug[] = [
  "systemwide",
  "berkeley",
  "davis",
  "irvine",
  "la",
  "merced",
  "riverside",
  "san-diego",
  "santa-barbara",
  "santa-cruz",
];

/** Distinct colors for multi-campus trend lines */
const CAMPUS_TREND_COLORS: Record<string, string> = {
  systemwide: "#6b7280",
  berkeley: "#2563eb",
  davis: "#059669",
  irvine: "#d97706",
  la: "#dc2626",
  merced: "#7c3aed",
  riverside: "#db2777",
  "san-diego": "#0891b2",
  "santa-barbara": "#ca8a04",
  "santa-cruz": "#ea580c",
};

/** Map campus slugs to display names */
const CAMPUS_NAMES: Record<CampusSlug, string> = {
  systemwide: "All Campuses (Systemwide)",
  berkeley: "UC Berkeley",
  davis: "UC Davis",
  irvine: "UC Irvine",
  la: "UCLA",
  merced: "UC Merced",
  riverside: "UC Riverside",
  "san-diego": "UC San Diego",
  "santa-barbara": "UC Santa Barbara",
  "santa-cruz": "UC Santa Cruz",
};

export default function SchoolDetailPage() {
  const { schoolId } = useParams<{ schoolId: string }>();

  const [schoolIndex, setSchoolIndex] = useState<SchoolIndex | null>(null);
  const [campusDataMap, setCampusDataMap] = useState<
    Map<CampusSlug, CampusData>
  >(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Multi-select campus state: explicit array of selected campuses
  const [selectedCampuses, setSelectedCampuses] = useState<CampusSlug[]>([...ALL_CAMPUS_SLUGS]);

  // Multi-select year state for the records table: defaults set after school loads
  const [selectedYears, setSelectedYears] = useState<number[]>([]);

  // Single year for the bar chart section (has its own selector)
  const [barChartYear, setBarChartYear] = useState<number | null>(null);

  // Metric selector for the bar chart
  type MetricType = "applicationRate" | "acceptanceRate" | "enrollmentRate";
  const [selectedMetric, setSelectedMetric] = useState<MetricType>("applicationRate");

  // Denominator mode: "conversion" = % of prior funnel step, "class" = % of senior class
  type DenominatorMode = "conversion" | "class";
  const [denominatorMode, setDenominatorMode] = useState<DenominatorMode>("conversion");

  // Find the school from the index
  const school = useMemo((): School | null => {
    if (!schoolIndex || !schoolId) return null;
    return schoolIndex.schools.find((s) => s.id === schoolId) ?? null;
  }, [schoolIndex, schoolId]);

  // Load school index on mount
  useEffect(() => {
    let cancelled = false;

    async function loadIndex() {
      try {
        const index = await getSchoolIndex();
        if (!cancelled) {
          setSchoolIndex(index);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load school index"
          );
          setLoading(false);
        }
      }
    }

    void loadIndex();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load all campus data once the school is found
  useEffect(() => {
    if (!school) {
      if (schoolIndex) {
        // School index loaded but school not found
        setLoading(false);
      }
      return;
    }

    let cancelled = false;

    async function loadCampusData() {
      try {
        const results = await Promise.all(
          ALL_CAMPUSES.map(async (slug) => {
            const data = await getCampusData(slug);
            return [slug, data] as [CampusSlug, CampusData];
          })
        );

        if (!cancelled) {
          const map = new Map<CampusSlug, CampusData>();
          for (const [slug, data] of results) {
            map.set(slug, data);
          }
          setCampusDataMap(map);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load campus data"
          );
          setLoading(false);
        }
      }
    }

    void loadCampusData();
    return () => {
      cancelled = true;
    };
  }, [school, schoolIndex]);

  // All available years for this school, descending
  const availableYearsList = useMemo(() => {
    if (!school) return [];
    return [...school.yearsAvailable].sort((a, b) => b - a);
  }, [school]);

  // Default selectedYears and barChartYear to the most recent year when school loads
  useEffect(() => {
    if (availableYearsList.length > 0) {
      const latest = availableYearsList[0]!;
      if (selectedYears.length === 0) {
        setSelectedYears([latest]);
      }
      if (barChartYear === null) {
        setBarChartYear(latest);
      }
    }
  }, [availableYearsList]); // eslint-disable-line react-hooks/exhaustive-deps

  // Get all records for this school across all campuses
  const allSchoolRecords = useMemo(() => {
    if (!schoolId) return [];
    const records: { campus: CampusSlug; campusName: string; record: AdmissionRecord }[] = [];

    for (const [slug, campusData] of campusDataMap) {
      const schoolRecords = filterRecords(campusData.records, {
        schoolIds: [schoolId],
      });
      for (const record of schoolRecords) {
        records.push({
          campus: slug,
          campusName: campusData.campusName,
          record,
        });
      }
    }
    return records;
  }, [schoolId, campusDataMap]);

  // Build a lookup from schoolId → year → grade12Enrollment for application rate computation
  const enrollmentLookup = useMemo(() => {
    if (!schoolIndex) return new Map<string, Record<string, number>>();
    const map = new Map<string, Record<string, number>>();
    for (const s of schoolIndex.schools) {
      if (s.grade12Enrollment && Object.keys(s.grade12Enrollment).length > 0) {
        map.set(s.id, s.grade12Enrollment);
      }
    }
    return map;
  }, [schoolIndex]);

  // Compute state averages and percentiles per campus for the selected year
  interface CampusStats {
    // Application rate: applicants / seniors (always "of class")
    avgApplicationRate: number;
    p75ApplicationRate: number;
    p90ApplicationRate: number;
    // Acceptance rate: admits / applicants (conversion)
    avgAcceptanceRate: number;
    p75AcceptanceRate: number;
    p90AcceptanceRate: number;
    // Enrollment rate: enrollees / admits (conversion)
    avgEnrollmentRate: number;
    p75EnrollmentRate: number;
    p90EnrollmentRate: number;
    // Acceptance rate: admits / seniors (of class)
    avgAcceptanceRateOfClass: number;
    p75AcceptanceRateOfClass: number;
    p90AcceptanceRateOfClass: number;
    // Enrollment rate: enrollees / seniors (of class)
    avgEnrollmentRateOfClass: number;
    p75EnrollmentRateOfClass: number;
    p90EnrollmentRateOfClass: number;
  }

  const stateAverages = useMemo(() => {
    if (barChartYear === null) return new Map<CampusSlug, CampusStats>();

    const avgs = new Map<CampusSlug, CampusStats>();

    /** Return the value at a given percentile (0-1) from a sorted array */
    function percentile(sorted: number[], p: number): number {
      if (sorted.length === 0) return 0;
      const idx = p * (sorted.length - 1);
      const lo = Math.floor(idx);
      const hi = Math.ceil(idx);
      if (lo === hi) return sorted[lo]!;
      return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo);
    }

    for (const slug of ALL_CAMPUSES) {
      if (slug === "systemwide") continue;
      const campusData = campusDataMap.get(slug);
      if (!campusData) continue;

      const yearRecords = filterRecords(campusData.records, { year: barChartYear });

      let totalApplicants = 0;
      let totalAdmits = 0;
      let totalEnrollees = 0;
      let totalEnrollment = 0;
      const applicationRates: number[] = [];
      const acceptanceRates: number[] = [];
      const enrollmentRates: number[] = [];
      const acceptanceRatesOfClass: number[] = [];
      const enrollmentRatesOfClass: number[] = [];

      for (const r of yearRecords) {
        const enrByYear = enrollmentLookup.get(r.schoolId);
        const enrollment = enrByYear?.[String(barChartYear)] ?? undefined;

        if (r.applicants !== null) {
          totalApplicants += r.applicants;
          if (enrollment != null && enrollment > 0) {
            applicationRates.push(r.applicants / enrollment);
          }
        }
        if (r.admits !== null) {
          totalAdmits += r.admits;
          if (enrollment != null && enrollment > 0) {
            acceptanceRatesOfClass.push(r.admits / enrollment);
          }
        }
        if (r.enrollees !== null) {
          totalEnrollees += r.enrollees;
          if (enrollment != null && enrollment > 0) {
            enrollmentRatesOfClass.push(r.enrollees / enrollment);
          }
        }
        if (enrollment != null) totalEnrollment += enrollment;

        const ar = computeAcceptanceRate(r);
        if (ar !== null) acceptanceRates.push(ar);

        if (r.enrollees !== null && r.admits !== null && r.admits > 0) {
          enrollmentRates.push(r.enrollees / r.admits);
        }
      }

      applicationRates.sort((a, b) => a - b);
      acceptanceRates.sort((a, b) => a - b);
      enrollmentRates.sort((a, b) => a - b);
      acceptanceRatesOfClass.sort((a, b) => a - b);
      enrollmentRatesOfClass.sort((a, b) => a - b);

      avgs.set(slug, {
        avgApplicationRate: totalEnrollment > 0 ? totalApplicants / totalEnrollment : 0,
        p75ApplicationRate: percentile(applicationRates, 0.75),
        p90ApplicationRate: percentile(applicationRates, 0.90),
        avgAcceptanceRate: totalApplicants > 0 ? totalAdmits / totalApplicants : 0,
        p75AcceptanceRate: percentile(acceptanceRates, 0.75),
        p90AcceptanceRate: percentile(acceptanceRates, 0.90),
        avgEnrollmentRate: totalAdmits > 0 ? totalEnrollees / totalAdmits : 0,
        p75EnrollmentRate: percentile(enrollmentRates, 0.75),
        p90EnrollmentRate: percentile(enrollmentRates, 0.90),
        avgAcceptanceRateOfClass: totalEnrollment > 0 ? totalAdmits / totalEnrollment : 0,
        p75AcceptanceRateOfClass: percentile(acceptanceRatesOfClass, 0.75),
        p90AcceptanceRateOfClass: percentile(acceptanceRatesOfClass, 0.90),
        avgEnrollmentRateOfClass: totalEnrollment > 0 ? totalEnrollees / totalEnrollment : 0,
        p75EnrollmentRateOfClass: percentile(enrollmentRatesOfClass, 0.75),
        p90EnrollmentRateOfClass: percentile(enrollmentRatesOfClass, 0.90),
      });
    }

    return avgs;
  }, [barChartYear, campusDataMap, enrollmentLookup]);

  // Current school's grade 12 enrollment for the selected year
  const currentEnrollment = useMemo(() => {
    if (!school || barChartYear === null) return undefined;
    return school.grade12Enrollment[String(barChartYear)];
  }, [school, barChartYear]);
  const hasEnrollment = currentEnrollment != null && currentEnrollment > 0;

  // Bar chart data for the selected metric + denominator mode, sorted lowest to highest
  const campusBarData = useMemo((): BarDataPoint[] => {
    if (!school || barChartYear === null) return [];

    const enrollment = currentEnrollment;
    const enrAvailable = enrollment != null && enrollment > 0;
    const data: BarDataPoint[] = [];

    for (const slug of ALL_CAMPUSES) {
      if (slug === "systemwide") continue;
      if (!selectedCampuses.includes(slug)) continue;

      const campusData = campusDataMap.get(slug);
      if (!campusData) continue;

      const records = filterRecords(campusData.records, {
        year: barChartYear,
        schoolIds: [school.id],
      });

      if (records.length === 0) continue;

      const record = records[0]!;
      const avg = stateAverages.get(slug);

      let value: number | null = null;
      let stateAvg: number | null = null;
      let p75: number | null = null;
      let p90: number | null = null;

      if (selectedMetric === "applicationRate") {
        // Application rate is always applicants / seniors (same for both modes)
        if (record.applicants !== null && enrAvailable) {
          value = record.applicants / enrollment!;
        }
        stateAvg = avg?.avgApplicationRate ?? null;
        p75 = avg?.p75ApplicationRate ?? null;
        p90 = avg?.p90ApplicationRate ?? null;
      } else if (selectedMetric === "acceptanceRate") {
        if (denominatorMode === "class") {
          // admits / seniors
          if (record.admits !== null && enrAvailable) {
            value = record.admits / enrollment!;
          }
          stateAvg = avg?.avgAcceptanceRateOfClass ?? null;
          p75 = avg?.p75AcceptanceRateOfClass ?? null;
          p90 = avg?.p90AcceptanceRateOfClass ?? null;
        } else {
          // admits / applicants (conversion)
          value = computeAcceptanceRate(record);
          stateAvg = avg?.avgAcceptanceRate ?? null;
          p75 = avg?.p75AcceptanceRate ?? null;
          p90 = avg?.p90AcceptanceRate ?? null;
        }
      } else if (selectedMetric === "enrollmentRate") {
        if (denominatorMode === "class") {
          // enrollees / seniors
          if (record.enrollees !== null && enrAvailable) {
            value = record.enrollees / enrollment!;
          }
          stateAvg = avg?.avgEnrollmentRateOfClass ?? null;
          p75 = avg?.p75EnrollmentRateOfClass ?? null;
          p90 = avg?.p90EnrollmentRateOfClass ?? null;
        } else {
          // enrollees / admits (conversion / yield)
          value = computeYield(record);
          stateAvg = avg?.avgEnrollmentRate ?? null;
          p75 = avg?.p75EnrollmentRate ?? null;
          p90 = avg?.p90EnrollmentRate ?? null;
        }
      }

      if (value === null) continue;

      data.push({
        name: CAMPUS_NAMES[slug] ?? slug,
        acceptanceRate: value,
        stateAverage: stateAvg,
        p75,
        p90,
        type: school.type,
        applicants: record.applicants,
        admits: record.admits,
        enrollees: record.enrollees,
      });
    }

    data.sort((a, b) => a.acceptanceRate - b.acceptanceRate);
    return data;
  }, [school, barChartYear, campusDataMap, selectedCampuses, selectedMetric, denominatorMode, stateAverages, currentEnrollment]);

  // Campuses for trend charts: always individual campuses (no systemwide aggregate)

  const acceptanceRateTrendCampuses = useMemo((): CampusSlug[] => {
    if (selectedCampuses.length === 0) return [];
    if (selectedCampuses.length === ALL_CAMPUS_SLUGS.length) return [...ALL_CAMPUS_SLUGS];
    return selectedCampuses;
  }, [selectedCampuses]);

  const trendData = useMemo((): TrendDataPoint[] => {
    if (!school) return [];

    const yearMap = new Map<number, TrendDataPoint>();

    for (const slug of acceptanceRateTrendCampuses) {
      const campusData = campusDataMap.get(slug);
      if (!campusData) continue;

      const records = filterRecords(campusData.records, {
        schoolIds: [school.id],
      });

      for (const record of records) {
        let point = yearMap.get(record.year);
        if (!point) {
          point = { year: record.year };
          yearMap.set(record.year, point);
        }
        point[slug] = computeAcceptanceRate(record);
      }
    }

    return Array.from(yearMap.values()).sort((a, b) => a.year - b.year);
  }, [school, acceptanceRateTrendCampuses, campusDataMap]);

  const trendSeries = useMemo((): TrendLineSeries[] => {
    return acceptanceRateTrendCampuses.map((slug) => ({
      dataKey: slug,
      label: CAMPUS_NAMES[slug] ?? slug,
      color: CAMPUS_TREND_COLORS[slug] ?? "#6b7280",
    }));
  }, [acceptanceRateTrendCampuses]);

  // Application rate trend: applicants / grade 12 enrollment, one line per campus
  const applicationRateTrendData = useMemo((): TrendDataPoint[] => {
    if (!school) return [];

    const yearMap = new Map<number, TrendDataPoint>();

    for (const slug of acceptanceRateTrendCampuses) {
      const campusData = campusDataMap.get(slug);
      if (!campusData) continue;

      const records = filterRecords(campusData.records, {
        schoolIds: [school.id],
      });

      for (const record of records) {
        const enrollment = school.grade12Enrollment[String(record.year)];
        if (!enrollment || enrollment <= 0 || record.applicants === null) continue;

        let point = yearMap.get(record.year);
        if (!point) {
          point = { year: record.year };
          yearMap.set(record.year, point);
        }
        point[slug] = record.applicants / enrollment;
      }
    }

    return Array.from(yearMap.values()).sort((a, b) => a.year - b.year);
  }, [school, acceptanceRateTrendCampuses, campusDataMap]);

  // Enrollment rate (yield) trend: enrollees / admits, one line per campus
  const enrollmentRateTrendData = useMemo((): TrendDataPoint[] => {
    if (!school) return [];

    const yearMap = new Map<number, TrendDataPoint>();

    for (const slug of acceptanceRateTrendCampuses) {
      const campusData = campusDataMap.get(slug);
      if (!campusData) continue;

      const records = filterRecords(campusData.records, {
        schoolIds: [school.id],
      });

      for (const record of records) {
        let point = yearMap.get(record.year);
        if (!point) {
          point = { year: record.year };
          yearMap.set(record.year, point);
        }
        point[slug] = computeYield(record);
      }
    }

    return Array.from(yearMap.values()).sort((a, b) => a.year - b.year);
  }, [school, acceptanceRateTrendCampuses, campusDataMap]);

  // GPA trends: separate data sets for applicant, admitted, and enrolled — always per-campus
  function buildGpaTrendData(
    field: "gpaApplicants" | "gpaAdmits" | "gpaEnrollees",
  ): TrendDataPoint[] {
    if (!school) return [];

    const yearMap = new Map<number, TrendDataPoint>();

    for (const slug of acceptanceRateTrendCampuses) {
      const campusData = campusDataMap.get(slug);
      if (!campusData) continue;

      const records = filterRecords(campusData.records, {
        schoolIds: [school.id],
      });

      for (const record of records) {
        let point = yearMap.get(record.year);
        if (!point) {
          point = { year: record.year };
          yearMap.set(record.year, point);
        }
        point[slug] = record[field];
      }
    }

    return Array.from(yearMap.values()).sort((a, b) => a.year - b.year);
  }

  const gpaApplicantsTrendData = useMemo(
    () => buildGpaTrendData("gpaApplicants"),
    [school, acceptanceRateTrendCampuses, campusDataMap], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const gpaAdmitsTrendData = useMemo(
    () => buildGpaTrendData("gpaAdmits"),
    [school, acceptanceRateTrendCampuses, campusDataMap], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const gpaEnrolleesTrendData = useMemo(
    () => buildGpaTrendData("gpaEnrollees"),
    [school, acceptanceRateTrendCampuses, campusDataMap], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Graduating class size trend data (from CDE grade 12 enrollment)
  const classSizeTrendData = useMemo((): TrendDataPoint[] => {
    if (!school) return [];
    const enrollment = school.grade12Enrollment;
    if (!enrollment || Object.keys(enrollment).length === 0) return [];

    return Object.entries(enrollment)
      .map(([yearStr, count]) => ({
        year: Number(yearStr),
        classSize: count,
      }))
      .sort((a, b) => a.year - b.year);
  }, [school]);

  const classSizeTrendSeries = useMemo((): TrendLineSeries[] => {
    return [{
      dataKey: "classSize",
      label: "Grade 12 Enrollment",
      color: "#8b5cf6",
    }];
  }, []);

  // Single-campus detail view: rates + GPA on one campus
  const [detailCampus, setDetailCampus] = useState<CampusSlug>("berkeley");

  // Conversion rates: acceptance = admits/applicants, yield = enrollees/admits
  const detailConversionTrendData = useMemo((): TrendDataPoint[] => {
    if (!school) return [];
    const campusData = campusDataMap.get(detailCampus);
    if (!campusData) return [];

    const records = filterRecords(campusData.records, { schoolIds: [school.id] });
    return records.map((record) => ({
      year: record.year,
      acceptanceRate: computeAcceptanceRate(record),
      enrollmentRate: computeYield(record),
    })).sort((a, b) => a.year - b.year);
  }, [school, detailCampus, campusDataMap]);

  const detailConversionSeries = useMemo((): TrendLineSeries[] => [
    { dataKey: "acceptanceRate", label: "Acceptance Rate (admits / applicants)", color: "#059669" },
    { dataKey: "enrollmentRate", label: "Enrollment Rate (enrollees / admits)", color: "#d97706" },
  ], []);

  // Of Senior Class rates: applicants/seniors, admits/seniors, enrollees/seniors
  const detailOfClassTrendData = useMemo((): TrendDataPoint[] => {
    if (!school) return [];
    const campusData = campusDataMap.get(detailCampus);
    if (!campusData) return [];

    const records = filterRecords(campusData.records, { schoolIds: [school.id] });
    return records.map((record) => {
      const enrollment = school.grade12Enrollment[String(record.year)];
      const hasEnr = enrollment != null && enrollment > 0;
      return {
        year: record.year,
        applicationRate: (record.applicants !== null && hasEnr) ? record.applicants / enrollment! : null,
        admittedOfClass: (record.admits !== null && hasEnr) ? record.admits / enrollment! : null,
        enrolledOfClass: (record.enrollees !== null && hasEnr) ? record.enrollees / enrollment! : null,
      };
    }).sort((a, b) => a.year - b.year);
  }, [school, detailCampus, campusDataMap]);

  const detailOfClassSeries = useMemo((): TrendLineSeries[] => [
    { dataKey: "applicationRate", label: "Applied (of class)", color: "#2563eb" },
    { dataKey: "admittedOfClass", label: "Admitted (of class)", color: "#059669" },
    { dataKey: "enrolledOfClass", label: "Enrolled (of class)", color: "#d97706" },
  ], []);

  const detailGpaTrendData = useMemo((): TrendDataPoint[] => {
    if (!school) return [];
    const campusData = campusDataMap.get(detailCampus);
    if (!campusData) return [];

    const records = filterRecords(campusData.records, { schoolIds: [school.id] });
    return records.map((record) => ({
      year: record.year,
      gpaApplicants: record.gpaApplicants,
      gpaAdmits: record.gpaAdmits,
      gpaEnrollees: record.gpaEnrollees,
    })).sort((a, b) => a.year - b.year);
  }, [school, detailCampus, campusDataMap]);

  const detailGpaSeries = useMemo((): TrendLineSeries[] => [
    { dataKey: "gpaApplicants", label: "Applicant GPA", color: "#6366f1" },
    { dataKey: "gpaAdmits", label: "Admitted GPA", color: "#10b981" },
    { dataKey: "gpaEnrollees", label: "Enrolled GPA", color: "#f59e0b" },
  ], []);

  // Data table: all records for this school (SchoolAdmissionView format)
  const tableData = useMemo((): SchoolAdmissionView[] => {
    if (!school) return [];

    return allSchoolRecords
      .filter((item) => {
        if (selectedYears.length > 0 && !selectedYears.includes(item.record.year)) return false;
        if (!selectedCampuses.includes(item.campus)) return false;
        // Skip systemwide in the detail table — individual campuses only
        if (item.campus === "systemwide") return false;
        return true;
      })
      .map((item) => ({
        school,
        record: item.record,
        computed: computeMetrics(item.record),
        campusName: item.campusName,
      }));
  }, [school, allSchoolRecords, selectedYears, selectedCampuses]);

  // No school selected — show search landing
  if (!schoolId) {
    return (
      <div className="school-search-landing" style={{ maxWidth: 540, margin: "4rem auto", textAlign: "center" }}>
        <h1 style={{ marginBottom: "0.5rem" }}>Find a High School</h1>
        <p style={{ color: "var(--color-text-secondary)", marginBottom: "2rem" }}>
          Search by school name, city, or county to view UC admissions data.
        </p>
        <SchoolSearch placeholder="Search for a high school..." autoFocus />
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="page-loading" role="status" aria-live="polite">
        <p>Loading...</p>
      </div>
    );
  }

  // School not found
  if (!school) {
    return (
      <div className="page-error">
        <h2>School Not Found</h2>
        <p>
          No school found with ID "{schoolId}". Try searching for a different
          school.
        </p>
        <div style={{ marginTop: "1.5rem", maxWidth: "480px" }}>
          <SchoolSearch placeholder="Search for a high school..." />
        </div>
        <Link to="/" className="back-link" style={{ marginTop: "1rem" }}>
          Back to Home
        </Link>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="page-error">
        <h2>Error Loading Data</h2>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="school-detail-page">
      {/* School Search */}
      <div style={{ marginBottom: "var(--space-4)" }}>
        <SchoolSearch placeholder="Jump to another high school..." />
      </div>

      {/* School Header */}
      <section className="school-header" aria-label="School information">
        <div className="school-header-top">
          <h1 className="school-name">{school.name}</h1>
          <span className={`badge badge-${school.type}`}>
            {school.type === "public" ? "Public" : "Private"}
          </span>
        </div>
        <p className="school-location">
          {school.city ? `${school.city}, ` : ""}
          {school.county} County
        </p>
        {school.yearsAvailable.length > 0 && (
          <p className="data-completeness-note">
            Data available for {school.yearsAvailable.length} year
            {school.yearsAvailable.length !== 1 ? "s" : ""} (
            {Math.min(...school.yearsAvailable)}&ndash;
            {Math.max(...school.yearsAvailable)})
          </p>
        )}
      </section>

      {/* Filters */}
      <section className="section" aria-label="Filters">
        <div className="filter-group" role="group" aria-label="Data filters">
          <CampusMultiSelect
            selected={selectedCampuses}
            onChange={setSelectedCampuses}
          />
        </div>
      </section>

      {/* Metrics by Campus */}
      <section className="section" aria-label="Metrics by campus">
        <div style={{ display: "flex", alignItems: "baseline", gap: "1rem", flexWrap: "wrap" }}>
          <h2 className="section-title" style={{ margin: 0 }}>
            {selectedMetric === "applicationRate" && "Application Rate"}
            {selectedMetric === "acceptanceRate" && "Acceptance Rate"}
            {selectedMetric === "enrollmentRate" && "Enrollment Rate"}
            {" by Campus"}
          </h2>
          <div className="filter-field" style={{ minWidth: "auto" }}>
            <select
              className="filter-select"
              value={barChartYear ?? ""}
              onChange={(e) => setBarChartYear(e.target.value ? Number(e.target.value) : null)}
              aria-label="Year for bar chart"
            >
              {availableYearsList.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="metric-pills" role="tablist" aria-label="Metric selector">
          {([
            { key: "applicationRate" as MetricType, label: "Application Rate" },
            { key: "acceptanceRate" as MetricType, label: "Acceptance Rate" },
            { key: "enrollmentRate" as MetricType, label: "Enrollment Rate" },
          ]).map((pill) => (
            <button
              key={pill.key}
              type="button"
              role="tab"
              aria-selected={selectedMetric === pill.key}
              className={`metric-pill${selectedMetric === pill.key ? " active" : ""}`}
              onClick={() => setSelectedMetric(pill.key)}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {selectedMetric !== "applicationRate" && (
          <div className="denominator-toggle" role="radiogroup" aria-label="Denominator mode">
            <button
              type="button"
              role="radio"
              aria-checked={denominatorMode === "conversion"}
              className={`denominator-option${denominatorMode === "conversion" ? " active" : ""}`}
              onClick={() => setDenominatorMode("conversion")}
            >
              Conversion
              <span className="denominator-hint">
                {selectedMetric === "acceptanceRate" ? "admits / applicants" : "enrollees / admits"}
              </span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={denominatorMode === "class"}
              className={`denominator-option${denominatorMode === "class" ? " active" : ""}`}
              onClick={() => setDenominatorMode("class")}
            >
              Of Senior Class
              <span className="denominator-hint">
                {selectedMetric === "acceptanceRate" ? "admits / seniors" : "enrollees / seniors"}
              </span>
            </button>
          </div>
        )}

        {campusBarData.length > 0 ? (
          <AcceptanceRateBar
            data={campusBarData}
            height={400}
            layout="vertical"
            valueFormat="percent"
            metricLabel={
              selectedMetric === "applicationRate" ? "Application Rate" :
              selectedMetric === "acceptanceRate"
                ? (denominatorMode === "class" ? "Admitted (of class)" : "Acceptance Rate")
                : (denominatorMode === "class" ? "Enrolled (of class)" : "Enrollment Rate")
            }
          />
        ) : (
          <p className="no-data-message">
            {(selectedMetric === "applicationRate" || denominatorMode === "class") && !hasEnrollment
              ? `Rate unavailable — no enrollment data for this school${barChartYear ? ` in ${barChartYear}` : ""}.`
              : `No data available for this school${barChartYear ? ` in ${barChartYear}` : ""}.`}
          </p>
        )}
        {(selectedMetric === "applicationRate" || denominatorMode === "class") && hasEnrollment && (
          <p className="methodology-note" style={{ marginTop: "0.5rem" }}>
            {selectedMetric === "applicationRate" && "Application Rate = applicants / seniors"}
            {selectedMetric === "acceptanceRate" && denominatorMode === "class" && "Admitted of Class = admits / seniors"}
            {selectedMetric === "enrollmentRate" && denominatorMode === "class" && "Enrolled of Class = enrollees / seniors"}
            {" "}({currentEnrollment!.toLocaleString()} seniors
            {barChartYear ? `, CDE ${barChartYear - 1}-${String(barChartYear).slice(-2)}` : ""}
            )
          </p>
        )}
      </section>

      {/* Year-over-Year Trends */}
      <section className="section" aria-label="Year-over-year trends">
        <h2 className="section-title">
          Year-over-Year Trends
          {acceptanceRateTrendCampuses.length === 1
            ? ` — ${CAMPUS_NAMES[acceptanceRateTrendCampuses[0]!] ?? acceptanceRateTrendCampuses[0]}`
            : ""}
        </h2>

        <div className="trend-charts-grid">
          <div className="trend-chart-card">
            <h3 className="subsection-title">Application Rate</h3>
            {applicationRateTrendData.length > 0 ? (
              <TrendLine
                data={applicationRateTrendData}
                series={trendSeries}
                yAxisFormat="percent"
                height={300}
              />
            ) : (
              <p className="no-data-message">
                No application rate trend data available (requires enrollment data).
              </p>
            )}
          </div>

          <div className="trend-chart-card">
            <h3 className="subsection-title">Acceptance Rate</h3>
            {trendData.length > 0 ? (
              <TrendLine
                data={trendData}
                series={trendSeries}
                yAxisFormat="percent"
                height={300}
              />
            ) : (
              <p className="no-data-message">
                No acceptance rate trend data available for the selected campus{acceptanceRateTrendCampuses.length !== 1 ? "es" : ""}.
              </p>
            )}
          </div>

          <div className="trend-chart-card">
            <h3 className="subsection-title">Enroll Rate</h3>
            {enrollmentRateTrendData.length > 0 ? (
              <TrendLine
                data={enrollmentRateTrendData}
                series={trendSeries}
                yAxisFormat="percent"
                height={300}
              />
            ) : (
              <p className="no-data-message">
                No enrollment rate trend data available for the selected campus{acceptanceRateTrendCampuses.length !== 1 ? "es" : ""}.
              </p>
            )}
          </div>

          <div className="trend-chart-card">
            <h3 className="subsection-title">Applicant GPA</h3>
            {gpaApplicantsTrendData.length > 0 ? (
              <TrendLine
                data={gpaApplicantsTrendData}
                series={trendSeries}
                yAxisFormat="number"
                yDomain={[2.0, 5.0]}
                height={300}
              />
            ) : (
              <p className="no-data-message">
                No applicant GPA trend data available.
              </p>
            )}
          </div>

          <div className="trend-chart-card">
            <h3 className="subsection-title">Admitted GPA</h3>
            {gpaAdmitsTrendData.length > 0 ? (
              <TrendLine
                data={gpaAdmitsTrendData}
                series={trendSeries}
                yAxisFormat="number"
                yDomain={[2.0, 5.0]}
                height={300}
              />
            ) : (
              <p className="no-data-message">
                No admitted GPA trend data available.
              </p>
            )}
          </div>

          <div className="trend-chart-card">
            <h3 className="subsection-title">Enrolled GPA</h3>
            {gpaEnrolleesTrendData.length > 0 ? (
              <TrendLine
                data={gpaEnrolleesTrendData}
                series={trendSeries}
                yAxisFormat="number"
                yDomain={[2.0, 5.0]}
                height={300}
              />
            ) : (
              <p className="no-data-message">
                No enrolled GPA trend data available.
              </p>
            )}
          </div>

          <div className="trend-chart-card">
            <h3 className="subsection-title">Graduating Class Size</h3>
            {classSizeTrendData.length > 0 ? (
              <TrendLine
                data={classSizeTrendData}
                series={classSizeTrendSeries}
                yAxisFormat="number"
                height={300}
              />
            ) : (
              <p className="no-data-message">
                No graduating class size data available for this school.
              </p>
            )}
          </div>
        </div>

        {/* Single-campus detail: rates + GPA side by side */}
        <div style={{ display: "flex", alignItems: "baseline", gap: "1rem", flexWrap: "wrap", marginTop: "2rem", marginBottom: "1rem" }}>
          <h3 className="subsection-title" style={{ margin: 0 }}>Single Campus Detail</h3>
          <div className="filter-field" style={{ minWidth: "auto" }}>
            <select
              className="filter-select"
              value={detailCampus}
              onChange={(e) => setDetailCampus(e.target.value as CampusSlug)}
              aria-label="Campus for detail charts"
            >
              {ALL_CAMPUS_SLUGS.map((slug) => (
                <option key={slug} value={slug}>{CAMPUS_NAMES[slug]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="trend-charts-grid">
          <div className="trend-chart-card">
            <h3 className="subsection-title">Conversion Rates — {CAMPUS_NAMES[detailCampus]}</h3>
            {detailConversionTrendData.length > 0 ? (
              <TrendLine
                data={detailConversionTrendData}
                series={detailConversionSeries}
                yAxisFormat="percent"
                height={300}
              />
            ) : (
              <p className="no-data-message">
                No conversion rate data available for {CAMPUS_NAMES[detailCampus]}.
              </p>
            )}
          </div>

          <div className="trend-chart-card">
            <h3 className="subsection-title">Of Senior Class — {CAMPUS_NAMES[detailCampus]}</h3>
            {detailOfClassTrendData.length > 0 ? (
              <TrendLine
                data={detailOfClassTrendData}
                series={detailOfClassSeries}
                yAxisFormat="percent"
                height={300}
              />
            ) : (
              <p className="no-data-message">
                No senior class rate data available for {CAMPUS_NAMES[detailCampus]}.
              </p>
            )}
          </div>

          <div className="trend-chart-card">
            <h3 className="subsection-title">GPA — {CAMPUS_NAMES[detailCampus]}</h3>
            {detailGpaTrendData.length > 0 ? (
              <TrendLine
                data={detailGpaTrendData}
                series={detailGpaSeries}
                yAxisFormat="number"
                yDomain={[2.0, 5.0]}
                height={300}
              />
            ) : (
              <p className="no-data-message">
                No GPA data available for {CAMPUS_NAMES[detailCampus]}.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Full Data Table */}
      <section className="section" aria-label="All records">
        <div style={{ display: "flex", alignItems: "baseline", gap: "1rem", flexWrap: "wrap", marginBottom: "1rem" }}>
          <h2 className="section-title" style={{ margin: 0 }}>All Records</h2>
          <YearMultiSelect
            selected={selectedYears}
            onChange={setSelectedYears}
            availableYears={availableYearsList}
          />
        </div>
        {tableData.length > 0 ? (
          <SchoolTable data={tableData} showYear showCampus showClassSize />
        ) : (
          <p className="no-data-message">
            No data available for the selected filters.
          </p>
        )}
        <MethodologyNote variant="brief" />
      </section>
    </div>
  );
}
