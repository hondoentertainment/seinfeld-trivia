import type { EpisodeBundle } from "./types";
import { withSupplementalTrivia } from "./supplementalTrivia";

const SEASON_SHARD_IDS = Array.from({ length: 10 }, (_, i) =>
  String(i).padStart(2, "0"),
);

let cache: EpisodeBundle[] | null = null;

async function loadSeasonShards(): Promise<EpisodeBundle[]> {
  const mods = await Promise.all(
    SEASON_SHARD_IDS.map((id) => import(`../data/trivia/season-${id}.json`)),
  );
  const merged = mods.flatMap((mod) => mod.default as EpisodeBundle[]);
  const bySeriesIndex = new Map<number, EpisodeBundle>();
  for (const episode of merged) {
    bySeriesIndex.set(episode.seriesIndex, episode);
  }
  return [...bySeriesIndex.values()].sort((a, b) => a.seriesIndex - b.seriesIndex);
}

/** Async chunk so the initial JS bundle stays small; safe to call many times. */
export async function loadEpisodes(): Promise<EpisodeBundle[]> {
  if (cache) return cache;
  cache = withSupplementalTrivia(await loadSeasonShards());
  return cache;
}

export function clearEpisodesCacheForTests(): void {
  cache = null;
}
