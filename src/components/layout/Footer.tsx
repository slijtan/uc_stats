import DataVintageNotice from "./DataVintageNotice.tsx";
import MethodologyNote from "../common/MethodologyNote.tsx";

export default function Footer() {
  return (
    <footer className="footer" aria-label="Site footer">
      <div className="footer-inner">
        <p className="footer-attribution">
          Data source:{" "}
          <a
            href="https://www.universityofcalifornia.edu/about-us/information-center"
            target="_blank"
            rel="noopener noreferrer"
          >
            UC Information Center
          </a>
        </p>
        <p className="footer-disclaimer">
          This tool is not endorsed by the University of California. Data is
          provided for informational purposes only.
        </p>
        <DataVintageNotice />
        <MethodologyNote />
      </div>
    </footer>
  );
}
