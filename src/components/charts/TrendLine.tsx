import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export interface TrendDataPoint {
  year: number;
  [key: string]: number | null | undefined;
}

export interface TrendLineSeries {
  /** Data key (must match a key in TrendDataPoint) */
  dataKey: string;
  /** Display label for the legend */
  label: string;
  /** Line color */
  color: string;
}

interface TrendLineProps {
  data: TrendDataPoint[];
  series: TrendLineSeries[];
  /** Chart height in pixels */
  height?: number;
  /** Y-axis format: "percent" formats 0-1 as 0%-100%, "number" shows raw values */
  yAxisFormat?: "percent" | "number";
  /** Y-axis domain */
  yDomain?: [number, number];
}

interface TooltipPayloadEntry {
  name: string;
  value: number | null;
  color: string;
  dataKey: string;
}

function CustomTooltip({
  active,
  payload,
  label,
  yAxisFormat,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: number;
  yAxisFormat: "percent" | "number";
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div
      style={{
        backgroundColor: "#fff",
        border: "1px solid var(--color-border, #e5e7eb)",
        borderRadius: "6px",
        padding: "8px 12px",
        fontSize: "0.875rem",
        boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
      }}
    >
      <p style={{ fontWeight: 600, marginBottom: "4px" }}>{label}</p>
      {payload.map((entry) => {
        if (entry.value == null) return null;
        const formatted =
          yAxisFormat === "percent"
            ? `${(entry.value * 100).toFixed(1)}%`
            : entry.value.toLocaleString();
        return (
          <p key={entry.dataKey} style={{ color: entry.color }}>
            {entry.name}: <strong>{formatted}</strong>
          </p>
        );
      })}
    </div>
  );
}

export default function TrendLine({
  data,
  series,
  height = 350,
  yAxisFormat = "percent",
  yDomain,
}: TrendLineProps) {
  if (data.length === 0) {
    return (
      <div className="chart-container" style={{ textAlign: "center", color: "var(--color-text-muted)" }}>
        No data available.
      </div>
    );
  }

  const formatY = (value: number) => {
    if (yAxisFormat === "percent") {
      return `${(value * 100).toFixed(0)}%`;
    }
    return value.toLocaleString();
  };

  const seriesDescription = series
    .map((s) => s.label)
    .join(" and ");
  const yearRange = data.length > 0
    ? `${data[0]!.year} to ${data[data.length - 1]!.year}`
    : "";

  // Check if there are any null/missing data points
  const hasGaps = data.some((point) =>
    series.some((s) => point[s.dataKey] === null || point[s.dataKey] === undefined)
  );

  return (
    <div>
      <div className="chart-container" role="img" aria-label={`Trend line chart showing ${seriesDescription} from ${yearRange}`}>
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="year" />
          <YAxis
            tickFormatter={formatY}
            domain={yDomain ?? (yAxisFormat === "percent" ? [0, 1] : ["auto", "auto"])}
          />
          <Tooltip
            content={
              <CustomTooltip yAxisFormat={yAxisFormat} />
            }
          />
          {series.length > 1 && <Legend />}
          {series.map((s) => (
            <Line
              key={s.dataKey}
              type="monotone"
              dataKey={s.dataKey}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      </div>
      {hasGaps && (
        <p className="data-table-footer-note">
          Gaps in the trend line indicate years where data was suppressed or unavailable.
        </p>
      )}
    </div>
  );
}
