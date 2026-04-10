import { useState, useRef, useEffect } from "react";

/** Metric key used across quality cards and equity axes */
export type MetricKey =
  | "cci"
  | "caasppEla"
  | "caasppMath"
  | "caasppElaPctMet"
  | "caasppMathPctMet"
  | "gradRate"
  | "agRate"
  | "dropoutRate"
  | "collegeGoingRate"
  | "chronicAbsentRate"
  | "suspensionRate"
  | "freeReducedMealPct"
  | "apCoursesOffered"
  | "collegeGoingCCC"
  | "collegeGoingInStatePrivate"
  | "collegeGoingOutOfState";

interface MetricInfo {
  label: string;
  description: string;
  interpretation: string;
}

export const METRIC_INFO: Record<MetricKey, MetricInfo> = {
  cci: {
    label: "CCI % Prepared",
    description:
      "College/Career Indicator — the percentage of graduates the state considers \"prepared\" for college or career based on a composite of A-G completion, CTE pathway, AP exams, and other measures.",
    interpretation:
      "Higher is better. Top schools score 70%+; the state median is around 45%.",
  },
  caasppEla: {
    label: "CAASPP ELA",
    description:
      "Average CAASPP English Language Arts scale score for Grade 11 students. CAASPP (Smarter Balanced) is the state standardized test.",
    interpretation:
      "Scores above 2583 indicate students met the standard. Higher is better.",
  },
  caasppMath: {
    label: "CAASPP Math",
    description:
      "Average CAASPP Math scale score for Grade 11 students.",
    interpretation:
      "Scores above 2628 indicate students met the standard. Higher is better.",
  },
  caasppElaPctMet: {
    label: "CAASPP ELA % Met",
    description:
      "Percentage of Grade 11 students meeting or exceeding the ELA standard on the CAASPP (Smarter Balanced) assessment.",
    interpretation:
      "Higher is better. The statewide average is roughly 50–55%.",
  },
  caasppMathPctMet: {
    label: "CAASPP Math % Met",
    description:
      "Percentage of Grade 11 students meeting or exceeding the Math standard on the CAASPP (Smarter Balanced) assessment.",
    interpretation:
      "Higher is better. The statewide average is roughly 30–35%.",
  },
  gradRate: {
    label: "Graduation Rate",
    description:
      "Four-year adjusted cohort graduation rate — the percentage of students who receive a regular high school diploma within four years of entering 9th grade.",
    interpretation:
      "Higher is better. Most California schools are above 85%; top schools exceed 95%.",
  },
  agRate: {
    label: "A-G Completion",
    description:
      "Percentage of graduates who completed the A-G course requirements needed for UC/CSU eligibility. These are 15 specific courses across seven subject areas.",
    interpretation:
      "Higher is better. This is the strongest predictor of UC application rates. Top schools exceed 80%.",
  },
  dropoutRate: {
    label: "Dropout Rate",
    description:
      "Percentage of students who dropped out of high school during the reporting year.",
    interpretation:
      "Lower is better. Most schools are under 5%; struggling schools may exceed 10%.",
  },
  collegeGoingRate: {
    label: "College-Going Rate",
    description:
      "Percentage of high school completers who enrolled in any postsecondary institution (college or university) within 16 months of graduation.",
    interpretation:
      "Higher is better. The state average is approximately 62%. Top feeder schools exceed 85%.",
  },
  chronicAbsentRate: {
    label: "Chronic Absenteeism",
    description:
      "Percentage of students absent 10% or more of school days. This is a CA Dashboard indicator reflecting school climate and student engagement.",
    interpretation:
      "Lower is better. Rates above 20% indicate significant engagement issues. Post-pandemic averages are higher than historical norms.",
  },
  suspensionRate: {
    label: "Suspension Rate",
    description:
      "Percentage of students suspended at least once during the academic year. A CA Dashboard school climate indicator.",
    interpretation:
      "Lower is better. The statewide average is around 4%. High rates may indicate discipline issues or over-policing.",
  },
  freeReducedMealPct: {
    label: "Free/Reduced-Price Meals",
    description:
      "Percentage of K-12 students eligible for free or reduced-price meals under the National School Lunch Program. A widely used proxy for school-level poverty.",
    interpretation:
      "Context metric — not better or worse. High-poverty schools (>75%) face more challenges; low-poverty (<25%) have more resources. Statewide average is around 60%.",
  },
  apCoursesOffered: {
    label: "AP Courses Offered",
    description:
      "Number of distinct Advanced Placement courses offered at the school, from CRDC 2020-21 data. Measures curricular access, not participation.",
    interpretation:
      "More AP courses indicate broader college-prep access. Top schools offer 20+; many schools offer fewer than 10. Zero means the school has no AP program.",
  },
  collegeGoingCCC: {
    label: "Enrolled in CCC",
    description:
      "Percentage of high school completers who enrolled in a California Community College within 12 months of graduation.",
    interpretation:
      "Context metric. A higher rate may indicate fewer students go directly to 4-year universities.",
  },
  collegeGoingInStatePrivate: {
    label: "In-State Private",
    description:
      "Percentage of high school completers who enrolled in an in-state private 2- or 4-year institution within 12 months.",
    interpretation:
      "Higher rates may indicate access to selective private colleges (Stanford, USC, etc.).",
  },
  collegeGoingOutOfState: {
    label: "Out-of-State",
    description:
      "Percentage of high school completers who enrolled in an out-of-state institution within 12 months.",
    interpretation:
      "Higher rates may indicate students pursuing selective colleges nationally.",
  },
};

/**
 * Hoverable info icon that shows a tooltip with the metric description.
 * On touch devices, tapping toggles the tooltip.
 */
export default function MetricTooltip({ metricKey }: { metricKey: MetricKey }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const info = METRIC_INFO[metricKey];

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <span
      ref={ref}
      className="metric-tooltip-wrapper"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={(e) => {
        e.stopPropagation();
        setOpen((prev) => !prev);
      }}
    >
      <span className="metric-tooltip-icon" aria-label={`Info about ${info.label}`} role="button" tabIndex={0}>
        ?
      </span>
      {open && (
        <span className="metric-tooltip-popup" role="tooltip">
          <span className="metric-tooltip-title">{info.label}</span>
          <span className="metric-tooltip-desc">{info.description}</span>
          <span className="metric-tooltip-interp">{info.interpretation}</span>
        </span>
      )}
    </span>
  );
}
