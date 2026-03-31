import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export interface DistributionDataPoint {
  range: string;
  publicCount: number;
  privateCount: number;
}

interface DistributionPlotProps {
  data: DistributionDataPoint[];
  /** Chart height in pixels */
  height?: number;
}

interface TooltipPayloadEntry {
  name: string;
  value: number;
  color: string;
  dataKey: string;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
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
      {payload.map((entry) => (
        <p key={entry.dataKey} style={{ color: entry.color }}>
          {entry.name}: <strong>{entry.value}</strong> school
          {entry.value !== 1 ? "s" : ""}
        </p>
      ))}
    </div>
  );
}

export default function DistributionPlot({
  data,
  height = 350,
}: DistributionPlotProps) {
  if (data.length === 0) {
    return (
      <div className="chart-container" style={{ textAlign: "center", color: "var(--color-text-muted)" }}>
        No data available.
      </div>
    );
  }

  const totalPublic = data.reduce((sum, d) => sum + d.publicCount, 0);
  const totalPrivate = data.reduce((sum, d) => sum + d.privateCount, 0);

  return (
    <div className="chart-container" role="img" aria-label={`Distribution chart showing acceptance rates for ${totalPublic} public and ${totalPrivate} private schools across rate ranges`}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="range" tick={{ fontSize: 12 }} />
          <YAxis
            label={{
              value: "Number of Schools",
              angle: -90,
              position: "insideLeft",
              offset: -5,
              style: { fontSize: 12, fill: "#6b7280" },
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Bar
            dataKey="publicCount"
            name="Public"
            fill="var(--color-public, #2563eb)"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="privateCount"
            name="Private"
            fill="var(--color-private, #ea580c)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
