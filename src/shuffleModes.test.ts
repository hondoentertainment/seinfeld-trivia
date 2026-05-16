import { describe, expect, it } from "vitest";
import type { EpisodeBundle } from "./types";
import {
  buildFullQuizPool,
  dailyChallengeQuizItems,
  marathonForSeason,
  marathonForTypes,
  orderedFullCorpusRun,
} from "./shuffle";

function miniEp(
  seriesIndex: number,
  season: number,
  types: string[],
): EpisodeBundle {
  return {
    seriesIndex,
    season,
    title: `Ep ${seriesIndex}`,
    airDate: "1/1/90",
    primarySource: "",
    indexSource: "",
    questions: types.map((type, id) => ({
      id: id + 1,
      type,
      question: `Q${id}`,
      options: ["a", "b", "c", "d"],
      correctIndex: 0,
      answer: "a",
    })),
  } as EpisodeBundle;
}

describe("dailyChallengeQuizItems", () => {
  it("is identical for the same UTC date key", () => {
    const eps = [miniEp(1, 1, ["who_said", "title"]), miniEp(2, 2, ["title", "cast"])];
    const a = dailyChallengeQuizItems(eps, "2034-06-07", 3);
    const b = dailyChallengeQuizItems(eps, "2034-06-07", 3);
    expect(a.map((x) => x.question.id)).toEqual(b.map((x) => x.question.id));
  });

  it("changes between dates", () => {
    const eps = [miniEp(1, 1, ["who_said"]), miniEp(2, 2, ["title"])];
    const a = dailyChallengeQuizItems(eps, "2034-06-07", 2).map((x) => `${x.episode.seriesIndex}:${x.question.id}`);
    const b = dailyChallengeQuizItems(eps, "2034-06-08", 2).map((x) => `${x.episode.seriesIndex}:${x.question.id}`);
    expect(a).not.toEqual(b);
  });
});

describe("marathonForSeason", () => {
  it("never leaves the requested season bucket", () => {
    const eps = [miniEp(1, 1, ["who_said"]), miniEp(2, 9, ["title"])];
    const run = marathonForSeason(eps, 9, 50, Math.random);
    expect(run.every((x) => x.episode.season === 9)).toBe(true);
  });
});

describe("marathonForTypes", () => {
  it("only pulls requested trivia archetypes", () => {
    const eps = [
      miniEp(1, 1, ["who_said", "title", "cast"]),
      miniEp(2, 2, ["title", "title"]),
    ];
    const run = marathonForTypes(eps, ["cast"], 20, Math.random);
    expect(run.every((x) => x.question.type === "cast")).toBe(true);
    expect(run).toHaveLength(1);
  });
});

describe("orderedFullCorpusRun", () => {
  it("tracks broadcast index order across episodes", () => {
    const eps = [miniEp(3, 1, ["a"]), miniEp(1, 1, ["b"]), miniEp(2, 2, ["c"])];
    const run = orderedFullCorpusRun(eps);
    expect(run.map((r) => r.episode.seriesIndex)).toEqual([1, 2, 3]);
  });
});

describe("buildFullQuizPool", () => {
  it("sizes to every prompt in the corpus", () => {
    const eps = [miniEp(1, 1, ["a", "b"]), miniEp(2, 1, ["c"])];
    expect(buildFullQuizPool(eps)).toHaveLength(3);
  });
});
