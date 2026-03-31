interface MethodologyNoteProps {
  /** Whether to show the full expanded methodology or a brief version */
  variant?: "full" | "brief";
}

export default function MethodologyNote({
  variant = "full",
}: MethodologyNoteProps) {
  if (variant === "brief") {
    return (
      <div className="methodology-note methodology-note-brief">
        <p className="methodology-note-text">
          Acceptance rate = admits / applicants. Data from the{" "}
          <a
            href="https://www.universityofcalifornia.edu/about-us/information-center"
            target="_blank"
            rel="noopener noreferrer"
          >
            UC Information Center
          </a>
          . Charter schools are classified as public per UC convention.
        </p>
      </div>
    );
  }

  return (
    <details className="methodology-note">
      <summary className="methodology-note-summary">
        Methodology &amp; Data Notes
      </summary>
      <div className="methodology-note-content">
        <h4 className="methodology-note-heading">How rates are calculated</h4>
        <p>
          <strong>Acceptance rate</strong> is calculated as the number of admits
          divided by the number of applicants for each school, campus, and year
          combination.
        </p>

        <h4 className="methodology-note-heading">Data source</h4>
        <p>
          All data is sourced from the{" "}
          <a
            href="https://www.universityofcalifornia.edu/about-us/information-center"
            target="_blank"
            rel="noopener noreferrer"
          >
            UC Information Center
          </a>
          , the official data portal of the University of California Office of
          the President.
        </p>

        <h4 className="methodology-note-heading">Suppressed data</h4>
        <p>
          When a school has very few applicants to a particular campus (small
          cell sizes), the UC Information Center suppresses the data to protect
          student privacy. These values appear as &ldquo;&#8212;&rdquo;
          (suppressed) in our tables and are excluded from rate calculations.
        </p>

        <h4 className="methodology-note-heading">School classifications</h4>
        <p>
          Charter schools are classified as <strong>public</strong> schools, per
          the UC Information Center&rsquo;s convention. The public/private
          designation follows the UC source data and may differ from other
          classification systems.
        </p>
      </div>
    </details>
  );
}
