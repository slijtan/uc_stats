interface DataVintageNoticeProps {
  /** The most recent year of available data */
  year?: number;
  /** The earliest year of available data */
  minYear?: number;
}

export default function DataVintageNotice({
  year = 2024,
  minYear = 2015,
}: DataVintageNoticeProps) {
  return (
    <span className="data-vintage-notice" role="status">
      Data covers {minYear}&ndash;{year}. Most recent data: {year}. UC data is
      typically published with a 1&ndash;2 year lag.
    </span>
  );
}
