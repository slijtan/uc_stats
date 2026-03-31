interface YearFilterProps {
  value: number | null;
  onChange: (year: number | null) => void;
  /** Minimum year available in the data */
  minYear?: number;
  /** Maximum year available in the data */
  maxYear?: number;
}

export default function YearFilter({
  value,
  onChange,
  minYear = 2015,
  maxYear = 2025,
}: YearFilterProps) {
  const years: number[] = [];
  for (let y = maxYear; y >= minYear; y--) {
    years.push(y);
  }

  return (
    <div className="filter-field">
      <label className="filter-label" htmlFor="year-filter">
        Year
      </label>
      <select
        id="year-filter"
        className="filter-select"
        value={value ?? ""}
        onChange={(e) => {
          const val = e.target.value;
          onChange(val === "" ? null : Number(val));
        }}
      >
        <option value="">All Years</option>
        {years.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
    </div>
  );
}
