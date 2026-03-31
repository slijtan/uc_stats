interface CountyFilterProps {
  value: string | null;
  onChange: (county: string | null) => void;
  /** List of available counties (from school index data) */
  counties: string[];
}

export default function CountyFilter({
  value,
  onChange,
  counties,
}: CountyFilterProps) {
  // Sort counties alphabetically
  const sortedCounties = [...counties].sort((a, b) => a.localeCompare(b));

  return (
    <div className="filter-field">
      <label className="filter-label" htmlFor="county-filter">
        County
      </label>
      <select
        id="county-filter"
        className="filter-select"
        value={value ?? ""}
        onChange={(e) => {
          const val = e.target.value;
          onChange(val === "" ? null : val);
        }}
      >
        <option value="">All Counties</option>
        {sortedCounties.map((county) => (
          <option key={county} value={county}>
            {county}
          </option>
        ))}
      </select>
    </div>
  );
}
