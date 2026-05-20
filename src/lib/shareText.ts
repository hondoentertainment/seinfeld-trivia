import type { DailySharePayload } from "./shareLinks";
import { buildDailyOgImageUrl, buildDailyResultShareUrl } from "./shareLinks";
import { getDisplayName } from "./playerDisplayName";
import { SITE_CANONICAL } from "../siteConfig";

export function formatDailyShareLine(payload: DailySharePayload): string {
  const url = buildDailyResultShareUrl(payload);
  const who = getDisplayName();
  const prefix = who ? `${who} scored ` : "";
  return `${prefix}${payload.correct}/${payload.total} on the Yada yada daily (${payload.dateKeyUtc} UTC). Same deck: ${url}`;
}

export function formatGenericShareLine(title: string, correct: number, total: number, accuracyPct: number): string {
  const who = getDisplayName();
  const prefix = who ? `${who}: ` : "";
  return `${prefix}${SITE_CANONICAL} · ${title}: ${correct}/${total} (${accuracyPct}% answered correctly)`;
}

export function dailyOgImageUrl(payload: DailySharePayload): string {
  return buildDailyOgImageUrl(payload);
}
