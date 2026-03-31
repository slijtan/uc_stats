import { useState } from "react";

type ViewMode = "chart" | "table";

interface ChartTableToggleProps {
  /** Content to render when in chart mode */
  chartContent: React.ReactNode;
  /** Content to render when in table mode */
  tableContent: React.ReactNode;
  /** Initial view mode */
  defaultMode?: ViewMode;
  /** Optional callback when mode changes */
  onModeChange?: (mode: ViewMode) => void;
}

export default function ChartTableToggle({
  chartContent,
  tableContent,
  defaultMode = "chart",
  onModeChange,
}: ChartTableToggleProps) {
  const [mode, setMode] = useState<ViewMode>(defaultMode);

  const handleModeChange = (newMode: ViewMode) => {
    setMode(newMode);
    if (onModeChange) {
      onModeChange(newMode);
    }
  };

  return (
    <div>
      <div className="chart-table-toggle" role="tablist" aria-label="View mode">
        <button
          type="button"
          className={`chart-table-toggle-btn${mode === "chart" ? " active" : ""}`}
          role="tab"
          aria-selected={mode === "chart"}
          onClick={() => handleModeChange("chart")}
        >
          Chart
        </button>
        <button
          type="button"
          className={`chart-table-toggle-btn${mode === "table" ? " active" : ""}`}
          role="tab"
          aria-selected={mode === "table"}
          onClick={() => handleModeChange("table")}
        >
          Table
        </button>
      </div>

      <div role="tabpanel">
        {mode === "chart" ? chartContent : tableContent}
      </div>
    </div>
  );
}
