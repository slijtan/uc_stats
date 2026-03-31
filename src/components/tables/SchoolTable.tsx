import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { SchoolAdmissionView } from "../../types/index.ts";
import MissingDataIndicator from "../common/MissingDataIndicator.tsx";

type SortKey =
  | "name"
  | "type"
  | "county"
  | "year"
  | "campus"
  | "classSize"
  | "applicants"
  | "admits"
  | "acceptanceRate"
  | "gpa";

type SortDirection = "asc" | "desc";

interface SchoolTableProps {
  data: SchoolAdmissionView[];
  /** Show a Year column (from record.year) */
  showYear?: boolean;
  /** Show a Campus column (from campusName) */
  showCampus?: boolean;
  /** Show a Graduating Class Size column (from school.grade12Enrollment) */
  showClassSize?: boolean;
}

function formatPercent(value: number | null): string {
  if (value === null) return "";
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value: number | null): string {
  if (value === null) return "";
  return value.toLocaleString();
}

function formatGpa(value: number | null): string {
  if (value === null) return "";
  return value.toFixed(2);
}

function renderValue(formatted: string, isNull: boolean): React.ReactNode {
  if (isNull) return <MissingDataIndicator type="suppressed" />;
  return formatted;
}

/**
 * Get a sortable numeric value, treating null as -Infinity for ascending
 * (null values sort last in ascending, first in descending).
 */
function nullSafeNumber(value: number | null, direction: SortDirection): number {
  if (value === null) {
    return direction === "asc" ? Infinity : -Infinity;
  }
  return value;
}

function getClassSize(row: SchoolAdmissionView): number | null {
  const enrollment = row.school.grade12Enrollment;
  if (!enrollment) return null;
  const val = enrollment[String(row.record.year)];
  return val ?? null;
}

export default function SchoolTable({ data, showYear = false, showCampus = false, showClassSize = false }: SchoolTableProps) {
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDirection("asc");
      }
    },
    [sortKey],
  );

  const sortedData = useMemo(() => {
    const sorted = [...data];
    const dir = sortDirection === "asc" ? 1 : -1;

    sorted.sort((a, b) => {
      switch (sortKey) {
        case "name":
          return dir * a.school.name.localeCompare(b.school.name);
        case "type":
          return dir * a.record.schoolType.localeCompare(b.record.schoolType);
        case "county":
          return dir * a.school.county.localeCompare(b.school.county);
        case "year":
          return dir * (a.record.year - b.record.year);
        case "campus":
          return dir * (a.campusName ?? "").localeCompare(b.campusName ?? "");
        case "classSize":
          return (
            dir *
            (nullSafeNumber(getClassSize(a), sortDirection) -
              nullSafeNumber(getClassSize(b), sortDirection))
          );
        case "applicants":
          return (
            dir *
            (nullSafeNumber(a.record.applicants, sortDirection) -
              nullSafeNumber(b.record.applicants, sortDirection))
          );
        case "admits":
          return (
            dir *
            (nullSafeNumber(a.record.admits, sortDirection) -
              nullSafeNumber(b.record.admits, sortDirection))
          );
        case "acceptanceRate":
          return (
            dir *
            (nullSafeNumber(a.computed.acceptanceRate, sortDirection) -
              nullSafeNumber(b.computed.acceptanceRate, sortDirection))
          );
        case "gpa":
          return (
            dir *
            (nullSafeNumber(a.record.gpaApplicants, sortDirection) -
              nullSafeNumber(b.record.gpaApplicants, sortDirection))
          );
        default:
          return 0;
      }
    });

    return sorted;
  }, [data, sortKey, sortDirection]);

  const renderSortHeader = (key: SortKey, label: string) => {
    const isSorted = sortKey === key;
    const arrow = isSorted
      ? sortDirection === "asc"
        ? "\u25B2"
        : "\u25BC"
      : "\u25B4";

    return (
      <th
        className={isSorted ? "sorted" : ""}
        onClick={() => handleSort(key)}
        aria-sort={
          isSorted
            ? sortDirection === "asc"
              ? "ascending"
              : "descending"
            : "none"
        }
      >
        {label}
        <span className="sort-indicator" aria-hidden="true">
          {arrow}
        </span>
      </th>
    );
  };

  if (data.length === 0) {
    return (
      <div style={{ textAlign: "center", color: "var(--color-text-muted)", padding: "2rem" }}>
        No data available.
      </div>
    );
  }

  return (
    <div className="data-table-wrapper">
      <table className="data-table" role="grid">
        <caption className="sr-only">
          School admissions data showing name, type, county,
          {showYear ? " year," : ""}{showCampus ? " campus," : ""}{showClassSize ? " class size," : ""} applicants, admits, acceptance rate, and mean GPA
        </caption>
        <thead>
          <tr>
            {renderSortHeader("name", "School Name")}
            {renderSortHeader("type", "Type")}
            {renderSortHeader("county", "County")}
            {showYear && renderSortHeader("year", "Year")}
            {showCampus && renderSortHeader("campus", "Campus")}
            {showClassSize && renderSortHeader("classSize", "Seniors")}
            {renderSortHeader("applicants", "Applicants")}
            {renderSortHeader("admits", "Admits")}
            {renderSortHeader("acceptanceRate", "Accept. Rate")}
            {renderSortHeader("gpa", "Mean GPA")}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row) => (
            <tr
              key={`${row.school.id}-${row.record.year}-${row.record.schoolType}-${row.campusName ?? "default"}`}
              className="clickable"
              onClick={() => navigate(`/school/${row.school.id}`)}
              role="row"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate(`/school/${row.school.id}`);
                }
              }}
            >
              <td>{row.school.name}</td>
              <td>
                <span className={`badge badge-${row.record.schoolType}`}>
                  {row.record.schoolType === "public" ? "Public" : "Private"}
                </span>
              </td>
              <td>{row.school.county}</td>
              {showYear && <td>{row.record.year}</td>}
              {showCampus && <td>{row.campusName ?? ""}</td>}
              {showClassSize && (
                <td className={`numeric${getClassSize(row) === null ? " null-value" : ""}`}>
                  {getClassSize(row) !== null ? getClassSize(row)!.toLocaleString() : <MissingDataIndicator type="suppressed" />}
                </td>
              )}
              <td
                className={`numeric${row.record.applicants === null ? " null-value" : ""}`}
              >
                {renderValue(formatNumber(row.record.applicants), row.record.applicants === null)}
              </td>
              <td
                className={`numeric${row.record.admits === null ? " null-value" : ""}`}
              >
                {renderValue(formatNumber(row.record.admits), row.record.admits === null)}
              </td>
              <td
                className={`numeric${row.computed.acceptanceRate === null ? " null-value" : ""}`}
              >
                {renderValue(formatPercent(row.computed.acceptanceRate), row.computed.acceptanceRate === null)}
              </td>
              <td
                className={`numeric${row.record.gpaApplicants === null ? " null-value" : ""}`}
              >
                {renderValue(formatGpa(row.record.gpaApplicants), row.record.gpaApplicants === null)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="data-table-footer-note">
        &mdash; indicates suppressed data. Schools with very few applicants may have data withheld for privacy.
      </p>
    </div>
  );
}
