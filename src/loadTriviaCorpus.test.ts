import { beforeEach, describe, expect, it } from "vitest";
import { clearEpisodesCacheForTests, loadEpisodes } from "./loadTriviaCorpus";
import { prefetchTriviaCorpus } from "./lib/prefetchCorpus";

describe("loadEpisodes", () => {
  beforeEach(() => {
    clearEpisodesCacheForTests();
  });

  it("returns episodes sorted by seriesIndex with unique indices", async () => {
    const episodes = await loadEpisodes();
    const indices = episodes.map((episode) => episode.seriesIndex);
    expect(indices).toEqual([...indices].sort((a, b) => a - b));
    expect(new Set(indices).size).toBe(indices.length);
  });
});

describe("prefetchTriviaCorpus", () => {
  beforeEach(() => {
    clearEpisodesCacheForTests();
  });

  it("does not throw when called twice", () => {
    expect(() => {
      prefetchTriviaCorpus();
      prefetchTriviaCorpus();
    }).not.toThrow();
  });
});
