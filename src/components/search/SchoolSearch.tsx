import { useState, useRef, useEffect, useCallback, useId } from "react";
import { useNavigate } from "react-router-dom";
import type { School } from "../../types/index.ts";
import { useSchoolSearch } from "../../hooks/useSchoolSearch.ts";

interface SchoolSearchProps {
  /** Placeholder text for the search input */
  placeholder?: string;
  /** Optional callback when a school is selected (in addition to navigation) */
  onSelect?: (school: School) => void;
  /** If true, skip navigation on select (useful when embedded in pages that handle selection) */
  navigateOnSelect?: boolean;
  /** Auto-focus the input on mount */
  autoFocus?: boolean;
}

export default function SchoolSearch({
  placeholder = "Search for a high school...",
  onSelect,
  navigateOnSelect = true,
  autoFocus = false,
}: SchoolSearchProps) {
  const { search, loading } = useSchoolSearch();
  const navigate = useNavigate();
  const comboboxId = useId();
  const listboxId = `${comboboxId}-listbox`;

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<School[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search
  const performSearch = useCallback(
    (value: string) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        if (value.trim().length < 2) {
          setResults([]);
          setIsOpen(false);
          return;
        }

        const searchResults = search(value);
        setResults(searchResults);
        setIsOpen(searchResults.length > 0);
        setHighlightedIndex(-1);
      }, 200);
    },
    [search],
  );

  // Clean up debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    performSearch(value);
  };

  const selectSchool = useCallback(
    (school: School) => {
      setQuery(navigateOnSelect ? school.name : "");
      setIsOpen(false);
      setResults([]);
      setHighlightedIndex(-1);

      if (onSelect) {
        onSelect(school);
      }

      if (navigateOnSelect) {
        navigate(`/school/${school.id}`);
      }
    },
    [navigate, onSelect, navigateOnSelect],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < results.length - 1 ? prev + 1 : 0,
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : results.length - 1,
        );
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < results.length) {
          const selected = results[highlightedIndex];
          if (selected) {
            selectSchool(selected);
          }
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  // Close dropdown on outside click
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="school-search" ref={containerRef}>
      <input
        ref={inputRef}
        type="text"
        className="school-search-input"
        placeholder={loading ? "Loading schools..." : placeholder}
        disabled={loading}
        autoFocus={autoFocus}
        value={query}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (results.length > 0) setIsOpen(true);
        }}
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-activedescendant={
          highlightedIndex >= 0
            ? `${comboboxId}-option-${highlightedIndex}`
            : undefined
        }
        aria-autocomplete="list"
        aria-haspopup="listbox"
      />

      {isOpen && results.length > 0 && (
        <ul
          id={listboxId}
          className="school-search-dropdown"
          role="listbox"
          aria-label="Search results"
        >
          {results.map((school, index) => (
            <li
              key={school.id}
              id={`${comboboxId}-option-${index}`}
              className={`school-search-result${index === highlightedIndex ? " highlighted" : ""}`}
              role="option"
              aria-selected={index === highlightedIndex}
              onMouseEnter={() => setHighlightedIndex(index)}
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent input blur
                selectSchool(school);
              }}
            >
              <div>
                <div className="school-search-result-name">{school.name}</div>
                <div className="school-search-result-meta">
                  <span
                    className={`badge badge-${school.type}`}
                  >
                    {school.type === "public" ? "Public" : "Private"}
                  </span>{" "}
                  {school.county} County
                  {school.city ? `, ${school.city}` : ""}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
