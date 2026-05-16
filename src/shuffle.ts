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

export function marathonQuizItems(
  episodes: import("./types").EpisodeBundle[],
  count: number,
  rng: () => number,
): import("./types").QuizItem[] {
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
  shuffleInPlace(pool, rng);
  return pool.slice(0, Math.min(count, pool.length));
}
