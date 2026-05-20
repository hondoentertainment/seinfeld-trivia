import { loadEpisodes } from "../loadTriviaCorpus";

/** Start loading the full corpus in the background (safe to call repeatedly). */
export function prefetchTriviaCorpus(): void {
  void loadEpisodes().catch(() => {});
}
