import { SITE_CANONICAL } from "../siteConfig";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type DailySharePayload = {
  dateKeyUtc: string;
  correct: number;
  total: number;
};

/** Build a URL that opens the site with a daily score baked into the query string (shareable). */
/** Social preview image for a daily score (Vercel OG route). */
export function buildDailyOgImageUrl(payload: DailySharePayload): string {
  const u = new URL(SITE_CANONICAL);
  u.pathname = "/api/og";
  u.searchParams.set("d", payload.dateKeyUtc);
  u.searchParams.set("s", String(payload.correct));
  u.searchParams.set("t", String(payload.total));
  return u.toString();
}

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

export { stripLaunchQueryParams } from "./launchQuery";
