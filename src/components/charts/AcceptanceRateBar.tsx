import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { SchoolType } from "../../types/index.ts";

export interface BarDataPoint {
  name: string;
  acceptanceRate: number;
  type: SchoolType;
  applicants?: number | null;
  admits?: number | null;
  enrollees?: number | null;
  /** State average for comparison (same units as acceptanceRate) */
  stateAverage?: number | null;
  /** 75th percentile across all schools */
  p75?: number | null;
  /** 90th percentile across all schools */
  p90?: number | null;
}

interface AcceptanceRateBarProps {
  data: BarDataPoint[];
  /** Chart height in pixels */
  height?: number;
  /** Layout direction */
  layout?: "horizontal" | "vertical";
  /** Value format: "percent" for 0-1 ratios, "count" for raw numbers */
  valueFormat?: "percent" | "count";
  /** Label for the primary metric (used in tooltip and legend) */
  metricLabel?: string;
}

const COLORS: Record<SchoolType, string> = {
  public: "var(--color-public, #2563eb)",
  private: "var(--color-private, #ea580c)",
};

const MARKER_COLOR = "#374151";

interface TooltipPayloadEntry {
  payload: BarDataPoint;
  dataKey: string;
  name: string;
  value: number;
  color: string;
}

function CustomTooltip({
  active,
  payload,
  valueFormat,
  metricLabel,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  valueFormat: "percent" | "count";
  metricLabel: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const entry = payload[0];
  if (!entry) return null;

  const data = entry.payload;
  const formatVal = (v: number) =>
    valueFormat === "percent"
      ? `${(v * 100).toFixed(1)}%`
      : v.toLocaleString();

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
      <p style={{ fontWeight: 600, marginBottom: "4px" }}>{data.name}</p>
      <p>
        {metricLabel}: <strong>{formatVal(data.acceptanceRate)}</strong>
      </p>
      {data.stateAverage != null && (
        <p style={{ color: "#6b7280" }}>
          State Avg: {formatVal(data.stateAverage)}
        </p>
      )}
      {data.p75 != null && (
        <p style={{ color: "#6b7280" }}>
          75th Pctl: {formatVal(data.p75)}
        </p>
      )}
      {data.p90 != null && (
        <p style={{ color: "#6b7280" }}>
          90th Pctl: {formatVal(data.p90)}
        </p>
      )}
      {data.applicants != null && (
        <p>Applicants: {data.applicants.toLocaleString()}</p>
      )}
      {data.admits != null && (
        <p>Admits: {data.admits.toLocaleString()}</p>
      )}
      {data.enrollees != null && (
        <p>Enrollees: {data.enrollees.toLocaleString()}</p>
      )}
      <p style={{ textTransform: "capitalize", color: "#6b7280" }}>
        {data.type}
      </p>
    </div>
  );
}

/** Marker definitions: label, data key, color, shape */
const MARKERS: { key: keyof BarDataPoint; color: string; shape: "circle" | "diamond" | "triangle" }[] = [
  { key: "stateAverage", color: MARKER_COLOR, shape: "circle" },
  { key: "p75", color: "#7c3aed", shape: "diamond" },
  { key: "p90", color: "#059669", shape: "triangle" },
];

/** Render a small marker shape at (cx, cy) */
function MarkerShape({ cx, cy, color, shape }: { cx: number; cy: number; color: string; shape: string }) {
  if (shape === "diamond") {
    return (
      <polygon
        points={`${cx},${cy - 4.5} ${cx + 4},${cy} ${cx},${cy + 4.5} ${cx - 4},${cy}`}
        fill={color} stroke="#fff" strokeWidth={1.2}
      />
    );
  }
  if (shape === "triangle") {
    return (
      <polygon
        points={`${cx},${cy - 4.5} ${cx + 4},${cy + 3} ${cx - 4},${cy + 3}`}
        fill={color} stroke="#fff" strokeWidth={1.2}
      />
    );
  }
  // Default: circle
  return <circle cx={cx} cy={cy} r={3.5} fill={color} stroke="#fff" strokeWidth={1.5} />;
}

/**
 * Custom bar shape for vertical layout (horizontal bars) with
 * annotation markers (state avg, p75, p90) overlaid.
 */
function HorizontalBarWithMarker(props: {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  payload: BarDataPoint;
}) {
  const { x, y, width, height, fill, payload } = props;
  const value = payload?.acceptanceRate;
  const barWidth = Math.max(0, width);

  return (
    <g>
      <rect x={x} y={y} width={barWidth} height={height} fill={fill} rx={4} ry={4} />
      {value != null && value > 0 && barWidth > 0 && MARKERS.map(({ key, color, shape }) => {
        const v = payload?.[key];
        if (v == null || typeof v !== "number") return null;
        const markerX = x + (v / value) * barWidth;
        const midY = y + height / 2;
        return (
          <g key={key}>
            <line x1={markerX} y1={y - 1} x2={markerX} y2={y + height + 1} stroke={color} strokeWidth={2} />
            <MarkerShape cx={markerX} cy={midY} color={color} shape={shape} />
          </g>
        );
      })}
    </g>
  );
}

/**
 * Custom bar shape for horizontal layout (vertical bars) with
 * annotation markers.
 */
function VerticalBarWithMarker(props: {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  payload: BarDataPoint;
}) {
  const { x, y, width, height, fill, payload } = props;
  const value = payload?.acceptanceRate;
  const barHeight = Math.max(0, height);

  return (
    <g>
      <rect x={x} y={y} width={width} height={barHeight} fill={fill} rx={4} ry={4} />
      {value != null && value > 0 && barHeight > 0 && MARKERS.map(({ key, color, shape }) => {
        const v = payload?.[key];
        if (v == null || typeof v !== "number") return null;
        const markerY = y + height - (v / value) * height;
        const midX = x + width / 2;
        return (
          <g key={key}>
            <line x1={x - 1} y1={markerY} x2={x + width + 1} y2={markerY} stroke={color} strokeWidth={2} />
            <MarkerShape cx={midX} cy={markerY} color={color} shape={shape} />
          </g>
        );
      })}
    </g>
  );
}

export default function AcceptanceRateBar({
  data,
  height = 400,
  layout = "vertical",
  valueFormat = "percent",
  metricLabel = "Acceptance Rate",
}: AcceptanceRateBarProps) {
  if (data.length === 0) {
    return (
      <div
        className="chart-container"
        style={{ textAlign: "center", color: "var(--color-text-muted)" }}
      >
        No data available.
      </div>
    );
  }

  const hasAnnotations = data.some((d) => d.stateAverage != null || d.p75 != null || d.p90 != null);

  const formatTick =
    valueFormat === "percent"
      ? (value: number) => `${(value * 100).toFixed(0)}%`
      : (value: number) => value.toLocaleString();

  const formatDescription = (v: number) =>
    valueFormat === "percent" ? `${(v * 100).toFixed(1)}%` : v.toLocaleString();

  const chartDescription = data
    .map((d) => `${d.name}: ${formatDescription(d.acceptanceRate)}`)
    .join(", ");

  const xDomain: [number | string, number | string] =
    valueFormat === "percent" ? [0, 1] : [0, "auto"];

  if (layout === "vertical") {
    return (
      <div
        className="chart-container"
        role="img"
        aria-label={`${metricLabel} bar chart. ${chartDescription}`}
      >
        <ResponsiveContainer
          width="100%"
          height={Math.max(height, data.length * 36)}
        >
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 100, bottom: hasAnnotations ? 28 : 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" domain={xDomain} tickFormatter={formatTick} />
            <YAxis
              type="category"
              dataKey="name"
              width={90}
              tick={{ fontSize: 12 }}
            />
            <Tooltip
              content={
                <CustomTooltip
                  valueFormat={valueFormat}
                  metricLabel={metricLabel}
                />
              }
            />
            <Bar
              dataKey="acceptanceRate"
              shape={HorizontalBarWithMarker as unknown as undefined}
              radius={[0, 4, 4, 0]}
            >
              {data.map((entry, index) => (
                <Cell key={index} fill={COLORS[entry.type]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {hasAnnotations && (
          <div className="chart-legend-markers">
            {data.some((d) => d.stateAverage != null) && (
              <span className="chart-legend-note">
                <svg width="14" height="12" style={{ verticalAlign: "middle" }}>
                  <line x1="7" y1="0" x2="7" y2="12" stroke={MARKER_COLOR} strokeWidth={2} />
                  <circle cx="7" cy="6" r="3" fill={MARKER_COLOR} stroke="#fff" strokeWidth={1} />
                </svg>
                {" "}Avg
              </span>
            )}
            {data.some((d) => d.p75 != null) && (
              <span className="chart-legend-note">
                <svg width="14" height="12" style={{ verticalAlign: "middle" }}>
                  <line x1="7" y1="0" x2="7" y2="12" stroke="#7c3aed" strokeWidth={2} />
                  <polygon points="7,1.5 11,6 7,10.5 3,6" fill="#7c3aed" stroke="#fff" strokeWidth={0.8} />
                </svg>
                {" "}75th
              </span>
            )}
            {data.some((d) => d.p90 != null) && (
              <span className="chart-legend-note">
                <svg width="14" height="12" style={{ verticalAlign: "middle" }}>
                  <line x1="7" y1="0" x2="7" y2="12" stroke="#059669" strokeWidth={2} />
                  <polygon points="7,1.5 11,9 3,9" fill="#059669" stroke="#fff" strokeWidth={0.8} />
                </svg>
                {" "}90th
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="chart-container"
      role="img"
      aria-label={`${metricLabel} bar chart. ${chartDescription}`}
    >
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          margin={{ top: 5, right: 30, left: 20, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11 }}
            angle={-45}
            textAnchor="end"
            interval={0}
          />
          <YAxis domain={xDomain} tickFormatter={formatTick} />
          <Tooltip
            content={
              <CustomTooltip
                valueFormat={valueFormat}
                metricLabel={metricLabel}
              />
            }
          />
          <Bar
            dataKey="acceptanceRate"
            shape={VerticalBarWithMarker as unknown as undefined}
            radius={[4, 4, 0, 0]}
          >
            {data.map((entry, index) => (
              <Cell key={index} fill={COLORS[entry.type]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {hasAnnotations && (
        <div className="chart-legend-note">
          <svg width="16" height="12" style={{ verticalAlign: "middle", marginRight: 4 }}>
            <line x1="0" y1="6" x2="16" y2="6" stroke={MARKER_COLOR} strokeWidth={2} />
            <circle cx="8" cy="6" r="3" fill={MARKER_COLOR} stroke="#fff" strokeWidth={1} />
          </svg>
          <span>State Average</span>
        </div>
      )}
    </div>
  );
}
