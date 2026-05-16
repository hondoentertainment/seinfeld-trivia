import type { EpisodeBundle } from "../types";

export type CorpusBreakdown = {
  episodeCount: number;
  questionCount: number;
  bySeason: { seasonIndex: number; episodes: number; questions: number }[];
  /** Sorted by question count descending */
  byType: { type: string; count: number }[];
  distinctTypes: string[];
};

/** Single pass aggregation for encyclopedic home + stats atlas */
export function buildCorpusBreakdown(episodes: EpisodeBundle[]): CorpusBreakdown {
  const qsBySeason = new Map<number, { episodes: number; questions: number }>();
  const qsByType = new Map<string, number>();
  let questionCount = 0;

  for (const ep of episodes) {
    const s = ep.season;
    if (!qsBySeason.has(s)) qsBySeason.set(s, { episodes: 0, questions: 0 });
    const row = qsBySeason.get(s)!;
    row.episodes++;
    row.questions += ep.questions.length;

    for (const q of ep.questions) {
      questionCount++;
      qsByType.set(q.type, (qsByType.get(q.type) ?? 0) + 1);
    }
  }

  const bySeason = [...qsBySeason.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([seasonIndex, agg]) => ({ seasonIndex, ...agg }));

  const byType = [...qsByType.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  return {
    episodeCount: episodes.length,
    questionCount,
    bySeason,
    byType,
    distinctTypes: byType.map((t) => t.type),
  };
}

/** How many playable prompts intersect a scripted category bucket */
export function countQuestionsForTypes(breakdown: CorpusBreakdown, types: readonly string[]): number {
  const set = new Set(types);
  let n = 0;
  for (const row of breakdown.byType) {
    if (set.has(row.type)) n += row.count;
  }
  return n;
}
