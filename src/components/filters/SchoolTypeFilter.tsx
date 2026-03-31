import type { SchoolType } from "../../types/index.ts";

interface SchoolTypeFilterProps {
  value: SchoolType | null;
  onChange: (type: SchoolType | null) => void;
}

const OPTIONS: { value: SchoolType | null; label: string }[] = [
  { value: null, label: "All" },
  { value: "public", label: "Public" },
  { value: "private", label: "Private" },
];

export default function SchoolTypeFilter({
  value,
  onChange,
}: SchoolTypeFilterProps) {
  return (
    <div className="filter-field">
      <span className="filter-label" id="school-type-label">
        School Type
      </span>
      <div
        className="filter-toggle-group"
        role="radiogroup"
        aria-labelledby="school-type-label"
      >
        {OPTIONS.map((option) => (
          <button
            key={option.label}
            type="button"
            className={`filter-toggle-btn${value === option.value ? " active" : ""}`}
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
