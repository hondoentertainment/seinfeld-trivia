/**
 * Rewrites bundled trivia JSON in-place: strips colon bleed on writer/director rows,
 * replaces garbage table labels in “who said” distractors, rebuilds all-episodes.json.
 */
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { EpisodeBundle } from "../src/types";
import { type SanitizeReport, sanitizeEpisodeBundle } from "../src/lib/triviaSanitize";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const TRIVIA = path.join(ROOT, "data", "trivia");

async function main() {
  const files = (await readdir(TRIVIA))
    .filter((f) => /^season-\d{2}\.json$/iu.test(f))
    .sort();
  const total: SanitizeReport = {
    creditColonNormalized: 0,
    whoSpeakerJunkSwapped: 0,
    duplicateOptionCellsRepaired: 0,
  };
  const merged: EpisodeBundle[] = [];

  for (const fname of files) {
    const filePath = path.join(TRIVIA, fname);
    const episodes = JSON.parse(await readFile(filePath, "utf8")) as EpisodeBundle[];
    const out: EpisodeBundle[] = [];

    for (const ep of episodes) {
      const { bundle, report } = sanitizeEpisodeBundle(ep);
      total.creditColonNormalized += report.creditColonNormalized;
      total.whoSpeakerJunkSwapped += report.whoSpeakerJunkSwapped;
      total.duplicateOptionCellsRepaired += report.duplicateOptionCellsRepaired;
      out.push(bundle);
    }

    merged.push(...out);
    await writeFile(filePath, `${JSON.stringify(out, null, 2)}\n`, "utf8");
    console.warn(`Normalized ${fname} (${episodes.length} episodes)`);
  }

  merged.sort((a, b) => a.seriesIndex - b.seriesIndex);
  await writeFile(path.join(TRIVIA, "all-episodes.json"), `${JSON.stringify(merged, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({ sanitize: total, episodes: merged.length, prompts: merged.reduce((a, e) => a + e.questions.length, 0) }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
