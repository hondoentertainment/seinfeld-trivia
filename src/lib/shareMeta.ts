import type { DailySharePayload } from "./shareLinks";
import { buildDailyOgImageUrl } from "./shareLinks";
import { SITE_CANONICAL } from "../siteConfig";

const OG_IMAGE_FALLBACK = `${SITE_CANONICAL.replace(/\/$/, "")}/pwa-512.png`;

function setMeta(property: string, content: string, isName = false) {
  const attr = isName ? "name" : "property";
  let el = document.querySelector(`meta[${attr}="${property}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, property);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

/** Updates OG/Twitter tags when a daily score is shareable (crawlers that run JS may pick this up). */
export function applyDailyShareMeta(payload: DailySharePayload): void {
  const title = `Seinfeld daily ${payload.correct}/${payload.total} · ${payload.dateKeyUtc} UTC`;
  const description = `Score on the Yada yada trivia UTC daily — same ${payload.total} questions for everyone that day.`;
  document.title = title;
  setMeta("og:title", title);
  setMeta("og:description", description);
  setMeta("og:url", window.location.href);
  const ogImage = buildDailyOgImageUrl(payload);
  setMeta("og:image", ogImage);
  setMeta("twitter:title", title, true);
  setMeta("twitter:description", description, true);
  setMeta("twitter:image", ogImage, true);
}

export function resetShareMeta(): void {
  const title = "Yada yada trivia · Seinfeld quiz";
  document.title = title;
  setMeta("og:title", "Yada yada trivia — Seinfeld trivia archive");
  setMeta(
    "og:description",
    "Episode quizzes, daily hive-mind puzzles, season-only silos, trivia-type labs, randomized mega-mixes, and canon-order full series marathons.",
  );
  setMeta("og:url", SITE_CANONICAL);
  setMeta("og:image", OG_IMAGE_FALLBACK);
}
