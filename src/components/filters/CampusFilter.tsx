import type { CampusSlug } from "../../types/index.ts";

const CAMPUS_OPTIONS: { value: CampusSlug; label: string }[] = [
  { value: "systemwide", label: "All Campuses (Systemwide)" },
  { value: "berkeley", label: "UC Berkeley" },
  { value: "davis", label: "UC Davis" },
  { value: "irvine", label: "UC Irvine" },
  { value: "la", label: "UCLA" },
  { value: "merced", label: "UC Merced" },
  { value: "riverside", label: "UC Riverside" },
  { value: "san-diego", label: "UC San Diego" },
  { value: "santa-barbara", label: "UC Santa Barbara" },
  { value: "santa-cruz", label: "UC Santa Cruz" },
];

interface CampusFilterProps {
  value: CampusSlug;
  onChange: (campus: CampusSlug) => void;
}

export default function CampusFilter({ value, onChange }: CampusFilterProps) {
  return (
    <div className="filter-field">
      <label className="filter-label" htmlFor="campus-filter">
        Campus
      </label>
      <select
        id="campus-filter"
        className="filter-select"
        value={value}
        onChange={(e) => onChange(e.target.value as CampusSlug)}
      >
        {CAMPUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
