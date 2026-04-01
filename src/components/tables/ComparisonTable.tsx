import type { GroupAggregate } from "../../types/index.ts";

interface ComparisonTableProps {
  publicData: GroupAggregate;
  privateData: GroupAggregate;
}

interface ComparisonRow {
  label: string;
  publicValue: string;
  privateValue: string;
  publicRaw: number;
  privateRaw: number;
  /** Whether higher is "better" (true) or lower is "better" (false) for highlighting */
  higherIsBetter: boolean;
}

function formatNumber(value: number): string {
  return value.toLocaleString();
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatGpa(value: number): string {
  return value.toFixed(2);
}

export default function ComparisonTable({
  publicData,
  privateData,
}: ComparisonTableProps) {
  const rows: ComparisonRow[] = [
    {
      label: "Number of Schools",
      publicValue: formatNumber(publicData.schoolCount),
      privateValue: formatNumber(privateData.schoolCount),
      publicRaw: publicData.schoolCount,
      privateRaw: privateData.schoolCount,
      higherIsBetter: true,
    },
    {
      label: "Total Applicants",
      publicValue: formatNumber(publicData.totalApplicants),
      privateValue: formatNumber(privateData.totalApplicants),
      publicRaw: publicData.totalApplicants,
      privateRaw: privateData.totalApplicants,
      higherIsBetter: true,
    },
    {
      label: "Total Admits",
      publicValue: formatNumber(publicData.totalAdmits),
      privateValue: formatNumber(privateData.totalAdmits),
      publicRaw: publicData.totalAdmits,
      privateRaw: privateData.totalAdmits,
      higherIsBetter: true,
    },
    ...(publicData.totalEnrollees !== undefined
      ? [
          {
            label: "Total Enrollees",
            publicValue: formatNumber(publicData.totalEnrollees!),
            privateValue: formatNumber(privateData.totalEnrollees ?? 0),
            publicRaw: publicData.totalEnrollees!,
            privateRaw: privateData.totalEnrollees ?? 0,
            higherIsBetter: true,
          },
        ]
      : []),
    {
      label: "Acceptance Rate",
      publicValue: formatPercent(publicData.acceptanceRate),
      privateValue: formatPercent(privateData.acceptanceRate),
      publicRaw: publicData.acceptanceRate,
      privateRaw: privateData.acceptanceRate,
      higherIsBetter: true,
    },
    {
      label: "Mean School Accept. Rate",
      publicValue: formatPercent(publicData.meanSchoolAcceptanceRate),
      privateValue: formatPercent(privateData.meanSchoolAcceptanceRate),
      publicRaw: publicData.meanSchoolAcceptanceRate,
      privateRaw: privateData.meanSchoolAcceptanceRate,
      higherIsBetter: true,
    },
    {
      label: "Median School Accept. Rate",
      publicValue: formatPercent(publicData.medianSchoolAcceptanceRate),
      privateValue: formatPercent(privateData.medianSchoolAcceptanceRate),
      publicRaw: publicData.medianSchoolAcceptanceRate,
      privateRaw: privateData.medianSchoolAcceptanceRate,
      higherIsBetter: true,
    },
    ...(publicData.yieldRate !== undefined
      ? [
          {
            label: "Yield Rate",
            publicValue: formatPercent(publicData.yieldRate!),
            privateValue: formatPercent(privateData.yieldRate ?? 0),
            publicRaw: publicData.yieldRate!,
            privateRaw: privateData.yieldRate ?? 0,
            higherIsBetter: true,
          },
        ]
      : []),
    ...(publicData.meanApplicationRateOfClass !== undefined
      ? [
          {
            label: "Mean App Rate of Class",
            publicValue: formatPercent(publicData.meanApplicationRateOfClass!),
            privateValue: formatPercent(privateData.meanApplicationRateOfClass ?? 0),
            publicRaw: publicData.meanApplicationRateOfClass!,
            privateRaw: privateData.meanApplicationRateOfClass ?? 0,
            higherIsBetter: true,
          },
          {
            label: "Mean Accept Rate of Class",
            publicValue: formatPercent(publicData.meanAcceptanceRateOfClass ?? 0),
            privateValue: formatPercent(privateData.meanAcceptanceRateOfClass ?? 0),
            publicRaw: publicData.meanAcceptanceRateOfClass ?? 0,
            privateRaw: privateData.meanAcceptanceRateOfClass ?? 0,
            higherIsBetter: true,
          },
          {
            label: "Mean Enroll Rate of Class",
            publicValue: formatPercent(publicData.meanEnrollmentRateOfClass ?? 0),
            privateValue: formatPercent(privateData.meanEnrollmentRateOfClass ?? 0),
            publicRaw: publicData.meanEnrollmentRateOfClass ?? 0,
            privateRaw: privateData.meanEnrollmentRateOfClass ?? 0,
            higherIsBetter: true,
          },
        ]
      : []),
    {
      label: "Mean GPA",
      publicValue: formatGpa(publicData.meanGpa),
      privateValue: formatGpa(privateData.meanGpa),
      publicRaw: publicData.meanGpa,
      privateRaw: privateData.meanGpa,
      higherIsBetter: true,
    },
  ];

  function highlightClass(
    row: ComparisonRow,
    side: "public" | "private",
  ): string {
    const isPublicHigher = row.publicRaw > row.privateRaw;
    const isTied = row.publicRaw === row.privateRaw;

    if (isTied) return "";

    if (side === "public") {
      return isPublicHigher === row.higherIsBetter
        ? "highlight-higher"
        : "highlight-lower";
    }

    return isPublicHigher === row.higherIsBetter
      ? "highlight-lower"
      : "highlight-higher";
  }

  return (
    <div className="data-table-wrapper">
      <table className="comparison-table">
        <caption className="sr-only">
          Comparison of public and private school statistics
        </caption>
        <thead>
          <tr>
            <th>Metric</th>
            <th className="col-public">Public Schools</th>
            <th className="col-private">Private Schools</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td className="label">{row.label}</td>
              <td className={highlightClass(row, "public")}>
                {row.publicValue}
              </td>
              <td className={highlightClass(row, "private")}>
                {row.privateValue}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
