import type { EpisodeBundle } from "./types";
import { withSupplementalTrivia } from "./supplementalTrivia";

let cache: EpisodeBundle[] | null = null;

/** Async chunk so the initial JS bundle stays small; safe to call many times. */
export async function loadEpisodes(): Promise<EpisodeBundle[]> {
  if (cache) return cache;
  const mod = await import("../data/trivia/all-episodes.json");
  cache = withSupplementalTrivia(mod.default as EpisodeBundle[]);
  return cache;
}

export function clearEpisodesCacheForTests(): void {
  cache = null;
}
