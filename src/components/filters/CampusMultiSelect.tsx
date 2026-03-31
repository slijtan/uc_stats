import { useState, useRef, useEffect } from "react";
import type { CampusSlug } from "../../types/index.ts";

const CAMPUS_OPTIONS: { value: CampusSlug; label: string }[] = [
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

const ALL_CAMPUS_SLUGS: CampusSlug[] = CAMPUS_OPTIONS.map((o) => o.value);

interface CampusMultiSelectProps {
  /** Selected campuses. Full array = all, empty = none. */
  selected: CampusSlug[];
  onChange: (campuses: CampusSlug[]) => void;
}

export { ALL_CAMPUS_SLUGS };

export default function CampusMultiSelect({
  selected,
  onChange,
}: CampusMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [open]);

  const allSelected = selected.length === ALL_CAMPUS_SLUGS.length;

  const toggleCampus = (slug: CampusSlug) => {
    if (selected.includes(slug)) {
      onChange(selected.filter((s) => s !== slug));
    } else {
      onChange([...selected, slug]);
    }
  };

  let displayText: string;
  if (selected.length === 0) {
    displayText = "No Campuses";
  } else if (allSelected) {
    displayText = "All Campuses";
  } else if (selected.length === 1) {
    displayText =
      CAMPUS_OPTIONS.find((o) => o.value === selected[0])?.label ??
      selected[0]!;
  } else {
    displayText = `${selected.length} campuses`;
  }

  return (
    <div className="filter-field campus-multi-select" ref={containerRef}>
      <label className="filter-label">Campus</label>
      <button
        type="button"
        className="filter-select campus-multi-select-trigger"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="campus-multi-select-text">{displayText}</span>
        <span className="campus-multi-select-arrow" aria-hidden="true">
          {open ? "\u25B4" : "\u25BE"}
        </span>
      </button>
      {open && (
        <div
          className="campus-multi-select-dropdown"
          role="listbox"
          aria-multiselectable="true"
        >
          <div className="campus-multi-select-actions">
            <button
              type="button"
              onClick={() => onChange([...ALL_CAMPUS_SLUGS])}
              className="campus-multi-select-action-btn"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={() => onChange([])}
              className="campus-multi-select-action-btn"
            >
              Unselect All
            </button>
          </div>
          {CAMPUS_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`campus-multi-select-option${selected.includes(option.value) ? " checked" : ""}`}
              role="option"
              aria-selected={selected.includes(option.value)}
            >
              <input
                type="checkbox"
                checked={selected.includes(option.value)}
                onChange={() => toggleCampus(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
