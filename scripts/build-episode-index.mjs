/**
 * Parses https://www.seinfeldscripts.com/seinfeld-scripts.html and writes data/episodes.json
 */
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const INDEX_URL = "http://www.seinfeldscripts.com/seinfeld-scripts.html";

function parseEpisodes(html) {
  /** @type {Array<{seriesIndex:number, season:number, title:string, airDate:string, scriptUrl:string}>} */
  const episodes = [];

  const seasonHeaderRe = /<b>(?:Pilot|Season\s+(\d+))\s*[^<]*<\/b>/gi;
  let season = 0;
  let lastIdx = 0;
  let hm;
  const regions = [];
  while ((hm = seasonHeaderRe.exec(html)) != null) {
    const start = hm.index;
    const seasonNum = hm[1] != null ? Number(hm[1]) : 0;
    regions.push({ start, season: seasonNum });
  }
  for (let i = 0; i < regions.length; i++) {
    const start = regions[i].start;
    const end = i + 1 < regions.length ? regions[i + 1].start : html.length;
    const block = html.slice(start, end);
    season = regions[i].season;
    const rowRe =
      /<tr>\s*<td[^>]*>\s*(\d+)\s*<\/td>\s*<td[^>]*>\s*<a\s+href=["']\s*([^"']+)["'][^>]*>([^<]+)<\/a>\s*\(([^)]+)\)/gi;
    let m;
    while ((m = rowRe.exec(block)) != null) {
      const seriesIndex = Number(m[1]);
      const rawHref = m[2].trim();
      const title = m[3].replace(/\s+/g, " ").trim();
      const airDate = m[4].trim();
      const scriptUrl = new URL(rawHref, INDEX_URL).href;
      episodes.push({
        seriesIndex,
        season,
        title,
        airDate,
        scriptUrl,
      });
    }
  }

  episodes.sort((a, b) => a.seriesIndex - b.seriesIndex);
  return episodes;
}

async function main() {
  const res = await fetch(INDEX_URL);
  if (!res.ok) throw new Error(`Index fetch failed: ${res.status}`);
  const html = await res.text();
  const episodes = parseEpisodes(html);
  if (episodes.length < 170) {
    console.warn(`Warning: only parsed ${episodes.length} episodes (expected ~180).`);
  }
  const outDir = join(ROOT, "data");
  await mkdir(outDir, { recursive: true });
  const payload = {
    source: INDEX_URL,
    generatedAt: new Date().toISOString(),
    episodeCount: episodes.length,
    episodes,
  };
  await writeFile(join(outDir, "episodes.json"), JSON.stringify(payload, null, 2), "utf8");
  console.log(`Wrote data/episodes.json (${episodes.length} episodes).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
