import { SITE_CANONICAL } from "../siteConfig";

export function AboutScreen(props: {
  onHome: () => void;
  onTrust: () => void;
  onDaily: () => void;
}) {
  const { onHome, onTrust, onDaily } = props;
  return (
    <div className="stack">
      <div className="card">
        <div className="row-between">
          <h2 className="card-heading" style={{ margin: 0 }}>
            About this archive
          </h2>
          <nav aria-label="About navigation">
            <button type="button" className="btn btn-ghost-light" onClick={onHome}>
              Home
            </button>
          </nav>
        </div>
        <p className="card-muted" style={{ marginTop: "0.75rem" }}>
          <strong>Yada yada trivia</strong> is a script-first Seinfeld quiz: thousands of multiple-choice nodes generated from the same
          transcript index superfans already use for deep dives—not streaming video, not official studio APIs, just obsessive text craft.
        </p>
        <ul className="card-muted trust-list">
          <li>
            <strong>Daily UTC puzzle</strong> — everyone on Earth gets the identical seeded slate for the calendar day (UTC), so scores
            are comparable.
          </li>
          <li>
            <strong>Episode mode</strong> — a full pass over every prompt tied to a single installment (ideal for rewatch nights).
          </li>
          <li>
            <strong>Season silos &amp; archetype labs</strong> — practice the exact classifier tags emitted by the generator (dialogue,
            credits, setting, cast, chronology, and more).
          </li>
          <li>
            <strong>Full-corpus marathons</strong> — broadcast order or a fresh shuffle across the entire open dataset.
          </li>
        </ul>
        <p className="card-muted">
          Canonical URL for sharing and metadata:{" "}
          <a href={SITE_CANONICAL} className="inline-link">
            {SITE_CANONICAL.replace(/^https:\/\//, "")}
          </a>
        </p>
        <div className="row-between" style={{ marginTop: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <button type="button" className="btn btn-teal" onClick={onDaily}>
            Jump to today&apos;s daily
          </button>
          <button type="button" className="btn btn-ghost-light" onClick={onTrust}>
            Accuracy &amp; sources
          </button>
        </div>
      </div>

      <div className="card">
        <h3 className="episode-meta">Why it exists</h3>
        <p className="card-muted">
          Most trivia apps optimize for breadth across hundreds of shows. This one optimizes for <em>depth</em> inside a single comedy
          institution—transparent counts, transcript links on every card, and offline-friendly delivery after the first load.
        </p>
      </div>
    </div>
  );
}

export default AboutScreen;
