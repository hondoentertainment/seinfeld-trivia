import { hashStringToSeed, mulberry32 } from "./lib/seededRng";

/** Fisher–Yates; mutates arr */
export function shuffleInPlace<T>(arr: T[], rng: () => number = Math.random): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function randomEpisode(episodes: import("./types").EpisodeBundle[], rng: () => number) {
  if (episodes.length === 0) throw new Error("No episodes.");
  const i = Math.floor(rng() * episodes.length);
  return episodes[i]!;
}

export function episodeQuizItems(ep: import("./types").EpisodeBundle): import("./types").QuizItem[] {
  return ep.questions.map((question, qIndexInEp) => ({
    episode: ep,
    question,
    qIndexInEp,
  }));
}

export function buildFullQuizPool(episodes: import("./types").EpisodeBundle[]): import("./types").QuizItem[] {
  const pool: import("./types").QuizItem[] = [];
  for (const ep of episodes) {
    for (let qi = 0; qi < ep.questions.length; qi++) {
      pool.push({
        episode: ep,
        question: ep.questions[qi]!,
        qIndexInEp: qi,
      });
    }
  }
  return pool;
}

export function marathonQuizItems(
  episodes: import("./types").EpisodeBundle[],
  count: number,
  rng: () => number,
): import("./types").QuizItem[] {
  const pool = buildFullQuizPool(episodes);
  shuffleInPlace(pool, rng);
  return pool.slice(0, Math.min(count, pool.length));
}

export function marathonQuizItemsWhere(
  episodes: import("./types").EpisodeBundle[],
  count: number,
  rng: () => number,
  predicate: (qi: import("./types").QuizItem) => boolean,
): import("./types").QuizItem[] {
  const pool = buildFullQuizPool(episodes).filter(predicate);
  if (pool.length === 0) return [];
  shuffleInPlace(pool, rng);
  return pool.slice(0, Math.min(count, pool.length));
}

export function marathonForSeason(
  episodes: import("./types").EpisodeBundle[],
  season: number,
  count: number,
  rng: () => number,
): import("./types").QuizItem[] {
  return marathonQuizItemsWhere(episodes, count, rng, (qi) => qi.episode.season === season);
}

export function marathonForTypes(
  episodes: import("./types").EpisodeBundle[],
  types: readonly string[],
  count: number,
  rng: () => number,
): import("./types").QuizItem[] {
  const set = new Set(types);
  return marathonQuizItemsWhere(episodes, count, rng, (qi) => set.has(qi.question.type));
}

/** Deterministic for a calendar day in UTC — same questions for everyone worldwide. */
export function dailyChallengeQuizItems(
  episodes: import("./types").EpisodeBundle[],
  dateKeyUtc: string,
  count: number,
): import("./types").QuizItem[] {
  const pool = buildFullQuizPool(episodes);
  const seed = hashStringToSeed(`seinfeld-trivia-daily|v1|${dateKeyUtc}`);
  const rng = mulberry32(seed);
  shuffleInPlace(pool, rng);
  return pool.slice(0, Math.min(count, pool.length));
}

/** Every script-derived prompt in original series order (Pilot → finale). */
export function orderedFullCorpusRun(episodes: import("./types").EpisodeBundle[]): import("./types").QuizItem[] {
  const sorted = [...episodes].sort((a, b) => a.seriesIndex - b.seriesIndex);
  const out: import("./types").QuizItem[] = [];
  for (const ep of sorted) {
    for (let qi = 0; qi < ep.questions.length; qi++) {
      out.push({ episode: ep, question: ep.questions[qi]!, qIndexInEp: qi });
    }
  }
  return out;
}

export function shuffledFullCorpusRun(
  episodes: import("./types").EpisodeBundle[],
  rng: () => number,
): import("./types").QuizItem[] {
  const pool = buildFullQuizPool(episodes);
  shuffleInPlace(pool, rng);
  return pool;
}
