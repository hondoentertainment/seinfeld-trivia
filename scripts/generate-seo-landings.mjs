import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const publicDir = path.join(root, "public");

const BASE = "https://seinfeld-trivia-navy.vercel.app";
const OG_IMAGE = `${BASE}/pwa-512.png`;
const BRAND = "Yada yada trivia";

/** @param {string} s */
function esc(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {{
 *   fileName: string;
 *   title: string;
 *   description: string;
 *   ogTitle: string;
 *   ogDescription: string;
 *   redirectPath: string;
 *   h1: string;
 *   bodyHtml: string;
 *   linkLabel: string;
 * }} opts
 */
function renderLanding(opts) {
  const canonical = `${BASE}/${opts.fileName}`;
  const redirectAmp = esc(opts.redirectPath);
  const redirectJs = opts.redirectPath.replace(/&/g, "&");

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(opts.title)}</title>
    <meta name="description" content="${esc(opts.description)}" />
    <link rel="canonical" href="${esc(canonical)}" />
    <meta property="og:title" content="${esc(opts.ogTitle)}" />
    <meta property="og:description" content="${esc(opts.ogDescription)}" />
    <meta property="og:url" content="${esc(canonical)}" />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="${esc(OG_IMAGE)}" />
    <meta http-equiv="refresh" content="0; url=${redirectAmp}" />
    <script>
      window.location.replace("${redirectJs}");
    </script>
  </head>
  <body style="font-family: system-ui, sans-serif; max-width: 42rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.55">
    <h1>${esc(opts.h1)}</h1>
    ${opts.bodyHtml}
    <p>
      If you are not redirected automatically,
      <a href="${redirectAmp}">${esc(opts.linkLabel)}</a>.
    </p>
  </body>
</html>
`;
}

/** @param {number} n */
function seasonLabel(n) {
  if (n === 0) return "Pilot";
  return `Season ${n}`;
}

/** @type {Array<{ season: number; description: string; blurb: string }>} */
const seasons = [
  {
    season: 0,
    description:
      "Script-sourced Seinfeld pilot trivia — multiple-choice questions from the series premiere and unaired pilot material.",
    blurb: "Drill the pilot and premiere arc with transcript-backed multiple choice.",
  },
  {
    season: 1,
    description:
      "Season 1 Seinfeld trivia quiz — early Jerry, George, Elaine, and Kramer moments from script-sourced prompts.",
    blurb: "Replay Season 1 episodes with per-episode and season-wide trivia runs.",
  },
  {
    season: 2,
    description:
      "Season 2 Seinfeld trivia — deeper bench of script-sourced questions across the show's breakout year.",
    blurb: "Challenge yourself on Season 2 storylines, quotes, and episode facts.",
  },
  {
    season: 3,
    description:
      "Season 3 Seinfeld trivia quiz — fan-favorite arcs and classic setups, all multiple choice from transcripts.",
    blurb: "Season 3 silo: episode passes, marathons, and archetype mixes.",
  },
  {
    season: 4,
    description:
      "Season 4 Seinfeld trivia — iconic mid-run episodes with script-first multiple-choice prompts.",
    blurb: "Master Season 4 with episode-targeted and full-season trivia modes.",
  },
  {
    season: 5,
    description:
      "Season 5 Seinfeld trivia — dense script coverage for one of the show's strongest comedic seasons.",
    blurb: "Season 5 drill: browse episodes or run a randomized season slate.",
  },
  {
    season: 6,
    description:
      "Season 6 Seinfeld trivia quiz — late-era classics with thousands of transcript-backed questions.",
    blurb: "Explore Season 6 episode by episode or shuffle the whole season.",
  },
  {
    season: 7,
    description:
      "Season 7 Seinfeld trivia — wedding arc, guest stars, and deep-cut script details in multiple choice.",
    blurb: "Season 7 trivia laboratory: episode grinds and season marathons.",
  },
  {
    season: 8,
    description:
      "Season 8 Seinfeld trivia — penultimate season episodes with script-sourced multiple-choice coverage.",
    blurb: "Test Season 8 knowledge with per-episode quizzes and season filters.",
  },
  {
    season: 9,
    description:
      "Season 9 Seinfeld trivia — final season episodes, finales, and deep script references in one PWA quiz.",
    blurb: "Close the series with Season 9 episode and marathon trivia modes.",
  },
];

/** @param {{ seriesIndex: number; season: number; title: string; airDate?: string }} ep */
function episodeMetaDescription(ep) {
  const label = seasonLabel(ep.season);
  return `${ep.title} Seinfeld trivia quiz — episode #${ep.seriesIndex} (${label}, aired ${ep.airDate ?? "classic run"}) with script-sourced multiple-choice questions.`;
}

/** @param {{ seriesIndex: number; season: number; title: string }} ep */
function episodeBlurb(ep) {
  const label = seasonLabel(ep.season);
  return `Episode #${ep.seriesIndex} (${label}): play transcript-backed trivia for “${ep.title}”.`;
}

const episodesPath = path.join(root, "data", "episodes.json");
const episodesPack = JSON.parse(fs.readFileSync(episodesPath, "utf8"));
/** @type {Array<{ seriesIndex: number; season: number; title: string; airDate?: string }>} */
const episodes = episodesPack.episodes.slice().sort((a, b) => a.seriesIndex - b.seriesIndex);

const STATIC_SITEMAP = [
  { loc: `${BASE}/`, changefreq: "daily", priority: "1.0" },
  { loc: `${BASE}/daily-challenge.html`, changefreq: "weekly", priority: "0.85" },
  { loc: `${BASE}/about-seinfeld-trivia.html`, changefreq: "monthly", priority: "0.7" },
  { loc: `${BASE}/trust-sources.html`, changefreq: "monthly", priority: "0.65" },
];

const created = [];

for (const { season, description, blurb } of seasons) {
  const label = seasonLabel(season);
  const fileName = `season-${season}-trivia.html`;
  const redirectPath = `/?season=${season}&utm_source=seo&utm_campaign=season`;
  const pageTitle =
    season === 0
      ? `Seinfeld pilot trivia quiz · ${BRAND}`
      : `Seinfeld ${label} trivia quiz · ${BRAND}`;

  const html = renderLanding({
    fileName,
    title: pageTitle,
    description,
    ogTitle: season === 0 ? "Seinfeld pilot trivia" : `Seinfeld ${label} trivia`,
    ogDescription: description,
    redirectPath,
    h1: season === 0 ? "Seinfeld pilot trivia" : `Seinfeld ${label} trivia`,
    bodyHtml: `<p>${esc(blurb)}</p>`,
    linkLabel: `open ${label.toLowerCase()} trivia in the app`,
  });

  const outPath = path.join(publicDir, fileName);
  fs.writeFileSync(outPath, html, "utf8");
  created.push(outPath);
}

for (const ep of episodes) {
  const { seriesIndex, title } = ep;
  const fileName = `episode-${seriesIndex}-trivia.html`;
  const redirectPath = `/?episode=${seriesIndex}&utm_source=seo&utm_campaign=episode`;
  const description = episodeMetaDescription(ep);
  const blurb = episodeBlurb(ep);

  const html = renderLanding({
    fileName,
    title: `${title} Seinfeld trivia · ${BRAND}`,
    description,
    ogTitle: `${title} — Seinfeld episode trivia`,
    ogDescription: description,
    redirectPath,
    h1: `${title} trivia`,
    bodyHtml: `<p>${esc(blurb)}</p>`,
    linkLabel: `play ${title} trivia in the app`,
  });

  const outPath = path.join(publicDir, fileName);
  fs.writeFileSync(outPath, html, "utf8");
  created.push(outPath);
}

const sitemapUrls = [
  ...STATIC_SITEMAP,
  ...seasons.map(({ season }) => ({
    loc: `${BASE}/season-${season}-trivia.html`,
    changefreq: "monthly",
    priority: "0.75",
  })),
  ...episodes.map(({ seriesIndex }) => ({
    loc: `${BASE}/episode-${seriesIndex}-trivia.html`,
    changefreq: "monthly",
    priority: "0.8",
  })),
];

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>
`;

const sitemapPath = path.join(publicDir, "sitemap.xml");
fs.writeFileSync(sitemapPath, sitemapXml, "utf8");
created.push(sitemapPath);

console.log(`Wrote ${created.length} files:`);
for (const p of created) {
  console.log(`  ${path.relative(root, p)}`);
}
