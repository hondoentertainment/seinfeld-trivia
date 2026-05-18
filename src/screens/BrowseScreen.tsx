import type { EpisodeBundle } from "../types";
import { seasonTitle } from "../lib/seasonTitle";

export type BrowseScreenProps = {
  browseSearch: string;
  setBrowseSearch: (v: string) => void;
  filteredBySeasonBrowse: readonly [number, EpisodeBundle[]][];
  /** True while hydrating archive on first catalogue visit */
  isCorpusLoading: boolean;
  episodes: EpisodeBundle[] | null;
  goStats: () => void;
  goHome: () => void;
  onEpisodeSelect: (ep: EpisodeBundle) => void;
};

export default function BrowseScreen({
  browseSearch,
  setBrowseSearch,
  filteredBySeasonBrowse,
  isCorpusLoading,
  episodes,
  goStats,
  goHome,
  onEpisodeSelect,
}: BrowseScreenProps) {
  return (
    <div className="stack">
      <div className="card">
        <div className="row-between">
          <h2 className="card-heading">Select an episode</h2>
          <nav
            aria-label="Catalog"
            className="row-between"
            style={{ gap: "0.5rem", flexWrap: "wrap", justifyContent: "flex-end" }}
          >
            <button type="button" className="btn btn-ghost-light" onClick={goStats}>
              Atlas
            </button>
            <button type="button" className="btn btn-ghost-light" onClick={goHome}>
              Home
            </button>
          </nav>
        </div>
        <label className="browse-search-label">
          <span className="visually-hidden">Filter episodes</span>
          <input
            type="search"
            className="browse-search-field"
            placeholder="Filter by episode title or series number…"
            value={browseSearch}
            onChange={(e) => setBrowseSearch(e.target.value)}
            autoComplete="off"
          />
        </label>
      </div>
      {isCorpusLoading && !episodes ? (
        <output className="card corpus-loading-status" aria-live="polite">
          <span className="loading-wordmark">Loading episode catalogue</span>
          <p className="card-muted">Fetching the full trivia archive…</p>
        </output>
      ) : null}
      <div className="card stack">
        {!episodes ? (
          <p className="card-muted">The episode catalogue will appear as soon as the archive is ready.</p>
        ) : filteredBySeasonBrowse.length === 0 ? (
          <p className="card-muted">No episodes match “{browseSearch.trim()}”—try loosening your filter.</p>
        ) : (
          filteredBySeasonBrowse.map(([season, seasonEps]) => (
            <details key={season} className="season-acc">
              <summary>
                <span>{seasonTitle(season)}</span>
                <span style={{ fontWeight: 600, opacity: 0.55 }}>
                  ({seasonEps.length}&nbsp;{seasonEps.length === 1 ? "episode" : "episodes"})
                </span>
              </summary>
              {seasonEps.map((ep) => (
                <button
                  key={ep.seriesIndex}
                  type="button"
                  className="ep-link"
                  onClick={() => onEpisodeSelect(ep)}
                >
                  {ep.title}{" "}
                  <span style={{ fontWeight: 500, color: "var(--ink-muted)" }}>(#{ep.seriesIndex})</span>
                </button>
              ))}
            </details>
          ))
        )}
      </div>
    </div>
  );
}
