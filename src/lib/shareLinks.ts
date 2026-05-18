import { SITE_CANONICAL } from "../siteConfig";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type DailySharePayload = {
  dateKeyUtc: string;
  correct: number;
  total: number;
};

/** Build a URL that opens the site with a daily score baked into the query string (shareable). */
export function buildDailyResultShareUrl(payload: DailySharePayload): string {
  const u = new URL(SITE_CANONICAL);
  u.pathname = u.pathname.replace(/\/?$/, "/");
  u.searchParams.set("d", payload.dateKeyUtc);
  u.searchParams.set("s", String(payload.correct));
  u.searchParams.set("t", String(payload.total));
  return u.toString();
}

/** Parse `?d=&s=&t=` when present and numerically sane. */
export function parseDailyShareSearch(search: string): DailySharePayload | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const d = params.get("d");
  const s = params.get("s");
  const t = params.get("t");
  if (!d || !DATE_RE.test(d) || s === null || t === null) return null;
  const correct = Number(s);
  const total = Number(t);
  if (!Number.isFinite(correct) || !Number.isFinite(total)) return null;
  if (correct < 0 || total < 1) return null;
  if (correct > total) return null;
  if (!Number.isInteger(correct) || !Number.isInteger(total)) return null;
  return { dateKeyUtc: d, correct, total };
}

/** Strip launch/marketing/share params after navigation to home so bookmarks stay clean. */
export function stripLaunchQueryParams(href = window.location.href): void {
  const u = new URL(href);
  const keys = ["d", "s", "t", "screen", "utm_source", "utm_campaign", "utm_medium"] as const;
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
