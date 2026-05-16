import type { QuizRunConfig } from "./types";

export function quizUiStrings(run: QuizRunConfig): {
  subtitle: string;
  resultsTitle: string;
  replayHint: string;
} {
  switch (run.mode) {
    case "episode":
      return {
        subtitle: "Episode quiz",
        resultsTitle: "Episode results",
        replayHint: "Replay this episode",
      };
    case "marathon_random":
      return {
        subtitle: `${run.count}-question mega-mix`,
        resultsTitle: "Mega-mix results",
        replayHint: "New shuffle — same length",
      };
    case "daily":
      return {
        subtitle: `Daily challenge (${run.dateKeyUtc} UTC, ${run.count} questions)`,
        resultsTitle: "Daily challenge results",
        replayHint: "Replay today's puzzle",
      };
    case "season":
      return {
        subtitle:
          run.season === 0
            ? `Pilot & specials · ${run.count} questions`
            : `Season ${run.season} · ${run.count} questions`,
        resultsTitle:
          run.season === 0 ? "Pilot & specials · results" : `Season ${run.season} · results`,
        replayHint: "Same season · new shuffle",
      };
    case "categories":
      return {
        subtitle: `${run.categoryLabel} · ${run.count} questions`,
        resultsTitle: `${run.categoryLabel} · results`,
        replayHint: "Same category bucket · new shuffle",
      };
    case "full_corpus":
      return run.order === "broadcast"
        ? {
            subtitle: `Canon marathon · ${run.poolSize} prompts`,
            resultsTitle: "Canon archive marathon · results",
            replayHint: "Replay full archive (same order)",
          }
        : {
            subtitle: `Total shuffle marathon · ${run.poolSize} prompts`,
            resultsTitle: "Corpus mega-mix · results",
            replayHint: "Shuffle the entire pool again",
          };
  }
}

export function marathonStyleUi(run: QuizRunConfig): boolean {
  return run.mode !== "episode";
}
