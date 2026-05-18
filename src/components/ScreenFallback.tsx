/** Lightweight placeholder while lazily-loaded views parse. */
export function ScreenFallback() {
  return (
    <output className="card corpus-loading-status" aria-live="polite" aria-busy="true">
      <span className="loading-wordmark">Loading section…</span>
      <p className="card-muted">Fetching UI chunk…</p>
    </output>
  );
}
