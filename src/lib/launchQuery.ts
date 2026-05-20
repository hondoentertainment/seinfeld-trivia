/** Parsed deep-link / marketing query params on first load. */
export type LaunchIntent =
  | { kind: "episode"; seriesIndex: number }
  | { kind: "season"; seasonIndex: number }
  | { kind: "screen"; screen: "about" | "trust" | "browse" | "stats" };

const SCREEN_NAMES = new Set(["about", "trust", "browse", "stats"]);

export function parseLaunchIntent(search: string): LaunchIntent | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const ep = params.get("episode");
  if (ep !== null) {
    const seriesIndex = Number(ep);
    if (Number.isInteger(seriesIndex) && seriesIndex >= 1) {
      return { kind: "episode", seriesIndex };
    }
  }
  const season = params.get("season");
  if (season !== null) {
    const seasonIndex = Number(season);
    if (Number.isInteger(seasonIndex) && seasonIndex >= 0 && seasonIndex <= 10) {
      return { kind: "season", seasonIndex };
    }
  }
  const screen = params.get("screen");
  if (screen && SCREEN_NAMES.has(screen)) {
    return { kind: "screen", screen: screen as "about" | "trust" | "browse" | "stats" };
  }
  return null;
}

/** Params removed after the app has consumed a deep link. */
export function stripLaunchQueryParams(href = window.location.href): void {
  const u = new URL(href);
  const keys = [
    "d",
    "s",
    "t",
    "screen",
    "episode",
    "season",
    "utm_source",
    "utm_campaign",
    "utm_medium",
  ] as const;
  let touched = false;
  for (const k of keys) {
    if (u.searchParams.has(k)) {
      u.searchParams.delete(k);
      touched = true;
    }
  }
  if (!touched) return;
  const next = `${u.pathname}${u.search}${u.hash}`;
  window.history.replaceState({}, "", next || "/");
}
