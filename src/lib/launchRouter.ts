import type { EpisodeBundle, GameScreen } from "../types";
import { buildCorpusBreakdown } from "./corpusStats";
import { parseLaunchIntent, stripLaunchQueryParams } from "./launchQuery";
import { seasonTitle } from "./seasonTitle";
import { episodeQuizItems, marathonForSeason } from "../shuffle";
import type { QuizItem, QuizRunConfig } from "../types";

export type LaunchRouterDeps = {
  ensureEpisodes: () => Promise<EpisodeBundle[] | null>;
  startQuiz: (items: QuizItem[], run: QuizRunConfig, enteredFromBrowse: boolean) => void;
  setScreen: (screen: GameScreen) => void;
  setNotice: (message: string) => void;
};

/** Apply `?episode=` / `?season=` deep links once corpus is available. */
export async function consumeEpisodeOrSeasonLaunch(
  search: string,
  deps: LaunchRouterDeps,
): Promise<boolean> {
  const intent = parseLaunchIntent(search);
  if (!intent || intent.kind === "screen") return false;

  const archive = await deps.ensureEpisodes();
  if (!archive) return false;

  if (intent.kind === "episode") {
    const ep = archive.find((e) => e.seriesIndex === intent.seriesIndex);
    stripLaunchQueryParams();
    if (ep) {
      deps.startQuiz(episodeQuizItems(ep), { mode: "episode" }, false);
      return true;
    }
    deps.setNotice(`Episode #${intent.seriesIndex} is not in the archive.`);
    deps.setScreen({ name: "browse" });
    return true;
  }

  if (intent.kind === "season") {
    stripLaunchQueryParams();
    const cap =
      buildCorpusBreakdown(archive).bySeason.find((x) => x.seasonIndex === intent.seasonIndex)?.questions ?? 0;
    const count = Math.max(1, Math.min(25, cap));
    if (cap === 0) {
      deps.setNotice(`No prompts indexed for ${seasonTitle(intent.seasonIndex)} yet.`);
      return true;
    }
    deps.startQuiz(
      marathonForSeason(archive, intent.seasonIndex, count, Math.random),
      { mode: "season", season: intent.seasonIndex, count },
      false,
    );
    return true;
  }

  return false;
}
