import { describe, expect, it } from "vitest";
import type { EpisodeBundle } from "./types";
import { episodeQuizItems, marathonQuizItems, randomEpisode, shuffleInPlace } from "./shuffle";

function lcg(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

const sampleEp = (i: number): EpisodeBundle =>
  ({
    seriesIndex: i,
    season: 1,
    title: `Ep ${i}`,
    airDate: "1/1/90",
    primarySource: "",
    indexSource: "",
    questions: Array.from({ length: 25 }, (_, id) => ({
      id: id + 1,
      type: "who_said",
      question: `Q${id}`,
      options: ["a", "b", "c", "d"],
      correctIndex: 0,
      answer: "a",
    })),
  }) as EpisodeBundle;

describe("shuffleInPlace", () => {
  it("permutes in place and preserves length", () => {
    const arr = [1, 2, 3, 4, 5];
    const rng = lcg(42);
    shuffleInPlace(arr, rng);
    expect(arr).toHaveLength(5);
    expect(arr.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  });

  it("is deterministic for a fixed RNG", () => {
    const a = [1, 2, 3, 4, 5];
    const b = [1, 2, 3, 4, 5];
    shuffleInPlace(a, lcg(99));
    shuffleInPlace(b, lcg(99));
    expect(a).toEqual(b);
  });
});

describe("randomEpisode", () => {
  it("throws when list is empty", () => {
    expect(() => randomEpisode([], Math.random)).toThrow("No episodes");
  });

  it("returns an element from the list", () => {
    const eps = [sampleEp(1), sampleEp(2)];
    const pick = randomEpisode(eps, lcg(1));
    expect(eps).toContainEqual(pick);
  });
});

describe("marathonQuizItems", () => {
  it("returns at most count items and shuffles order", () => {
    const eps = [sampleEp(1), sampleEp(2)];
    const rng = lcg(7);
    const run = marathonQuizItems(eps, 30, rng);
    expect(run.length).toBe(30);
    expect(run[0]?.episode).toBeDefined();
  });

  it("caps at pool size when count is huge", () => {
    const ep = sampleEp(1);
    const run = marathonQuizItems([ep], 9999, Math.random);
    expect(run.length).toBe(25);
  });
});

describe("episodeQuizItems", () => {
  it("maps 25 questions with indices", () => {
    const ep = sampleEp(9);
    const items = episodeQuizItems(ep);
    expect(items).toHaveLength(25);
    expect(items[0]?.qIndexInEp).toBe(0);
    expect(items[24]?.qIndexInEp).toBe(24);
  });
});
