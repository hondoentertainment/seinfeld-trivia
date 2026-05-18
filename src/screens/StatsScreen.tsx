import { readableTypeName } from "../lib/categories";
import type { CorpusBreakdown } from "../lib/corpusStats";
import { seasonTitle } from "../lib/seasonTitle";

export type StatsScreenProps = {
  corpus: CorpusBreakdown;
  questionsReviewed: number;
  goHome: () => void;
};

export default function StatsScreen({ corpus, questionsReviewed, goHome }: StatsScreenProps) {
  return (
    <div className="stack">
      <div className="card">
        <div className="row-between">
          <h2 className="card-heading">Corpus atlas · raw coverage</h2>
          <nav aria-label="Atlas">
            <button type="button" className="btn btn-ghost-light" onClick={goHome}>
              Home
            </button>
          </nav>
        </div>
        <p className="card-muted" style={{ marginTop: "0.65rem", marginBottom: "1rem" }}>
          Transparent counts pulled straight from bundled JSON—no inflated marketing math. Tap any mode on the homepage to grind a
          specific wedge of this histogram.
        </p>
        <dl className="mega-stats-grid">
          <div>
            <dt>Episode transcripts mirrored</dt>
            <dd>{corpus.episodeCount}</dd>
          </div>
          <div>
            <dt>Distinct prompt nodes</dt>
            <dd>{corpus.questionCount.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Classifier archetypes</dt>
            <dd>{corpus.distinctTypes.length}</dd>
          </div>
          <div>
            <dt>Lifetime prompts you&apos;ve reviewed</dt>
            <dd>{questionsReviewed.toLocaleString()}</dd>
          </div>
        </dl>
      </div>
      <div className="card">
        <h2 className="card-heading">Per-season density</h2>
        <div className="table-wrap" style={{ marginTop: "0.75rem" }}>
          <table className="data-sheet">
            <caption className="visually-hidden">Episodes and question counts for each season</caption>
            <thead>
              <tr>
                <th scope="col">Season</th>
                <th scope="col">Episodes</th>
                <th scope="col">Prompts</th>
              </tr>
            </thead>
            <tbody>
              {corpus.bySeason.map((row) => (
                <tr key={row.seasonIndex}>
                  <td>{seasonTitle(row.seasonIndex)}</td>
                  <td>{row.episodes}</td>
                  <td>{row.questions.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <h2 className="card-heading">Classifier inventory</h2>
        <p className="card-muted" style={{ marginTop: "0.35rem" }}>
          Every label is emitted by the trivia generator so you can steer practice toward exactly the kind of screenplay signal you care
          about.
        </p>
        <div className="table-wrap" style={{ marginTop: "0.75rem" }}>
          <table className="data-sheet">
            <caption className="visually-hidden">Question counts for each trivia classifier type</caption>
            <thead>
              <tr>
                <th scope="col">Type</th>
                <th scope="col">Prompts</th>
              </tr>
            </thead>
            <tbody>
              {corpus.byType.map((row) => (
                <tr key={row.type}>
                  <td>{readableTypeName(row.type)}</td>
                  <td>{row.count.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
