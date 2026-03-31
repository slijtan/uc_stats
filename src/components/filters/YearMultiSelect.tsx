import { useState, useRef, useEffect } from "react";

interface YearMultiSelectProps {
  /** Selected years */
  selected: number[];
  onChange: (years: number[]) => void;
  /** All available years (descending order recommended) */
  availableYears: number[];
}

export default function YearMultiSelect({
  selected,
  onChange,
  availableYears,
}: YearMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [open]);

  const allSelected = selected.length === availableYears.length;

  const toggleYear = (year: number) => {
    if (selected.includes(year)) {
      onChange(selected.filter((y) => y !== year));
    } else {
      onChange([...selected, year].sort((a, b) => b - a));
    }
  };

  let displayText: string;
  if (selected.length === 0) {
    displayText = "No Years";
  } else if (allSelected) {
    displayText = "All Years";
  } else if (selected.length === 1) {
    displayText = String(selected[0]);
  } else {
    displayText = `${selected.length} years`;
  }

  return (
    <div className="filter-field campus-multi-select" ref={containerRef}>
      <label className="filter-label">Year</label>
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
              onClick={() => onChange([...availableYears])}
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
          {availableYears.map((year) => (
            <label
              key={year}
              className={`campus-multi-select-option${selected.includes(year) ? " checked" : ""}`}
              role="option"
              aria-selected={selected.includes(year)}
            >
              <input
                type="checkbox"
                checked={selected.includes(year)}
                onChange={() => toggleYear(year)}
              />
              <span>{year}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
