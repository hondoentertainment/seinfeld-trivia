import { SITE_CANONICAL } from "../siteConfig";

const REPO = "hondoentertainment/seinfeld-trivia";

export function TrustScreen(props: { onHome: () => void; onAbout: () => void }) {
  const { onHome, onAbout } = props;
  return (
    <div className="stack">
      <div className="card">
        <div className="row-between">
          <h2 className="card-heading" style={{ margin: 0 }}>
            Trust, sources &amp; corrections
          </h2>
          <nav aria-label="Trust navigation">
            <button type="button" className="btn btn-ghost-light" onClick={onHome}>
              Home
            </button>
          </nav>
        </div>
        <p className="card-muted" style={{ marginTop: "0.75rem" }}>
          We treat trivia as <strong>derived editorial content</strong>: prompts are built from structured script text and supplemental
          facts that we label when they are not direct transcript lines.
        </p>

        <h3 className="episode-meta" style={{ marginTop: "1.25rem" }}>
          Primary sources
        </h3>
        <ul className="card-muted trust-list">
          <li>
            <strong>Episode transcripts</strong> — questions tied to dialogue and screenplay structure trace to pages mirrored from the{" "}
            <a href="http://www.seinfeldscripts.com/seinfeld-scripts.html" target="_blank" rel="noopener noreferrer">
              SeinfeldScripts.com
            </a>{" "}
            fan archive (linked on every card as &quot;Episode transcript&quot; unless overridden).
          </li>
          <li>
            <strong>Internet-sourced cards</strong> — a small curated layer (<code className="inline-code">internet_series</code>)
            cites third-party references (e.g. Wikipedia summaries) in the prompt flow; those cards show an explicit source chip instead
            of the transcript default.
          </li>
        </ul>

        <h3 className="episode-meta" style={{ marginTop: "1.25rem" }}>
          Accuracy &amp; reporting
        </h3>
        <p className="card-muted">
          Automated extraction can misparse edge cases—ambiguous speakers, reused lines, or heading quirks. Every quiz screen includes{" "}
          <strong>Report / copy details</strong>, which opens a prefilled GitHub issue when{" "}
          <code className="inline-code">VITE_FEEDBACK_GITHUB_REPO</code> is configured for this deployment, or copies a structured report
          to your clipboard so you can email it manually.
        </p>
        <p className="card-muted">
          Public codebase for transparency:{" "}
          <a href={`https://github.com/${REPO}`} target="_blank" rel="noopener noreferrer">
            github.com/{REPO}
          </a>
          {" "}
          · see <a href={`https://github.com/${REPO}/blob/main/CHANGELOG.md`}>CHANGELOG</a> and{" "}
          <a href={`https://github.com/${REPO}/releases`}>releases</a> for what shipped recently.
        </p>
        <p className="card-muted">
          Report bad prompts with the in-quiz button or{" "}
          <a href={`https://github.com/${REPO}/issues/new/choose`}>open a GitHub issue</a>.
        </p>

        <h3 className="episode-meta" style={{ marginTop: "1.25rem" }}>
          Fair use
        </h3>
        <p className="card-muted">
          The experience is transformative trivia about the program—short factual prompts and multiple-choice structure—not a
          reproduction of scripts. When in doubt, we link out rather than paste long excerpt blocks in marketing copy.
        </p>

        <div className="row-between" style={{ marginTop: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <button type="button" className="btn btn-ghost-light" onClick={onAbout}>
            About the site
          </button>
          <a
            className="btn btn-teal"
            href={SITE_CANONICAL}
            style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
          >
            Open quiz home
          </a>
        </div>
      </div>
    </div>
  );
}

export default TrustScreen;
