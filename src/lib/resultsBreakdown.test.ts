import { describe, expect, it } from "vitest";
import type { QuizItem } from "../types";
import { computeAnsweredTypeBreakdown } from "./resultsBreakdown";

const mkItem = (type: string): QuizItem => ({
  episode: {
    seriesIndex: 1,
    season: 1,
    title: "Test",
    airDate: "",
    primarySource: "",
    indexSource: "",
    questions: [],
  },
  question: {
    id: 1,
    type,
    question: "?",
    options: ["a", "b", "c", "d"],
    correctIndex: 0,
    answer: "a",
  },
  qIndexInEp: 0,
});

describe("computeAnsweredTypeBreakdown", () => {
  it("aggregates only answered questions by type", () => {
    const items: QuizItem[] = [mkItem("cast"), mkItem("cast"), mkItem("meta")];
    const answers = {
      0: { choice: 0, correct: true },
      1: { choice: 1, correct: false },
      /* 2 unanswered */
    };
    const rows = computeAnsweredTypeBreakdown(items, answers);
    expect(rows).toHaveLength(1);
    const cast = rows.find((r) => r.type === "cast");
    expect(cast?.asked).toBe(2);
    expect(cast?.correct).toBe(1);
    const meta = rows.find((r) => r.type === "meta");
    expect(meta).toBeUndefined();
  });
});
