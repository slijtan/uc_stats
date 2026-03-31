interface MissingDataIndicatorProps {
  /** The type of missing data */
  type: "suppressed" | "no-record";
}

/**
 * Displays an appropriate indicator for missing data values.
 *
 * - "suppressed": Data exists but was withheld (null in the dataset).
 *   Shown as an em dash with a tooltip explaining suppression.
 * - "no-record": No record exists at all for this combination.
 *   Shown as "No data" with explanatory text.
 */
export default function MissingDataIndicator({
  type,
}: MissingDataIndicatorProps) {
  if (type === "suppressed") {
    return (
      <span
        className="missing-data-indicator"
        title="Data suppressed — fewer than a minimum number of applicants, withheld for privacy"
        aria-label="Data suppressed"
      >
        &mdash;
      </span>
    );
  }

  return (
    <span className="missing-data-no-record" title="No record available for this school, campus, and year combination">
      No data
    </span>
  );
}
