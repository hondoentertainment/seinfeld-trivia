import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { EpisodeBundle, TriviaQuestion } from "../src/types";
import { assessQuestionHeuristics, evaluateDataset } from "../src/lib/triviaQuality";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function rowFor(ep: EpisodeBundle, q: TriviaQuestion) {
  return {
    episode: `${ep.seriesIndex}. ${ep.title}`,
    id: q.id,
    type: q.type,
    question: q.question,
    options: q.options,
    answer: q.answer,
    flags: assessQuestionHeuristics(q),
  };
}

async function main() {
  const data = JSON.parse(
    await readFile(path.join(ROOT, "data", "trivia", "all-episodes.json"), "utf8"),
  ) as EpisodeBundle[];
  const report = evaluateDataset(data);
  const samples: ReturnType<typeof rowFor>[] = [];
  const seenTypes = new Set<string>();

  for (const ep of data) {
    for (const q of ep.questions) {
      if (seenTypes.has(q.type)) continue;
      samples.push(rowFor(ep, q));
      seenTypes.add(q.type);
    }
  }

  console.log(JSON.stringify({ report, samples }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
