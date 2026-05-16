import { describe, expect, it } from "vitest";
import type { EpisodeBundle, TriviaQuestion } from "./types";
import allEpisodes from "../data/trivia/all-episodes.json";
import {
  assessQuestionHeuristics,
  evaluateDataset,
  normalizeComparable,
  validateEpisodeShape,
  validateQuestionStructure,
} from "./lib/triviaQuality";
import { sanitizeEpisodeBundle } from "./lib/triviaSanitize";

const episodes = allEpisodes as EpisodeBundle[];

describe("normalizeComparable", () => {
  it("normalizes casing and whitespace for answer comparison", () => {
    expect(normalizeComparable("  JERRY  ")).toBe(normalizeComparable("jerry"));
  });
});

describe("validateQuestionStructure", () => {
  it("accepts a well-formed question", () => {
    const q: TriviaQuestion = {
      id: 1,
      type: "who_said",
      question: 'Who says: “Hello”?',
      options: ["Jerry", "George", "Elaine", "Kramer"],
      correctIndex: 0,
      answer: "Jerry",
    };
    expect(validateQuestionStructure(q)).toEqual([]);
  });

  it("flags mismatch between correct option and answer", () => {
    const q: TriviaQuestion = {
      id: 1,
      type: "meta",
      question: "Test?",
      options: ["A", "B", "C", "D"],
      correctIndex: 2,
      answer: "Wrong",
    };
    expect(validateQuestionStructure(q)).toContain("answer_mismatch");
  });
});

describe("trivia dataset (generated JSON)", () => {
  it("has 180 episodes and 4500 questions total", () => {
    expect(episodes.length).toBe(180);
    const n = episodes.reduce((a, ep) => a + ep.questions.length, 0);
    expect(n).toBe(4500);
  });

  it("has 25 questions per episode with unique ids", () => {
    for (const ep of episodes) {
      expect(validateEpisodeShape(ep)).toEqual([]);
    }
  });

  it("has zero structural validation failures across all questions", () => {
    const report = evaluateDataset(episodes);
    expect(report.structuralFailures).toBe(0);
    expect(report.samples).toEqual([]);
  });

  it("persisted trivia JSON has zero obvious screenplay parsing artifacts", () => {
    const report = evaluateDataset(episodes);
    expect(report.byHeuristicFlag.credit_line_leading_colon ?? 0).toBe(0);
    expect(report.byHeuristicFlag.metadata_boilerplate_speaker_option ?? 0).toBe(0);
    expect(report.byHeuristicFlag.duplicate_answer_options ?? 0).toBe(0);
  });

  it("sanitizeEpisodeBundle does not perturb already-canonical payloads", () => {
    const sample = episodes.slice(0, 20);
    for (const ep of sample) {
      const { bundle } = sanitizeEpisodeBundle(ep);
      expect(JSON.stringify(sanitizeEpisodeBundle(bundle).bundle)).toEqual(JSON.stringify(bundle));
    }
  });

  it("records heuristic quality metrics (non-blocking baseline)", () => {
    const report = evaluateDataset(episodes);
    expect(report.questionCount).toBe(4500);
    expect(report.heuristicRate).toBeGreaterThan(0);
    expect(report.heuristicRate).toBeLessThan(1);
    expect(report.byHeuristicFlag).toBeDefined();
  });
});

describe("assessQuestionHeuristics", () => {
  it("flags embedded brackets inside a who_said quote", () => {
    const q: TriviaQuestion = {
      id: 1,
      type: "who_said",
      question: 'Who says: “[laughing] Hello there”?',
      options: ["A", "B", "C", "D"],
      correctIndex: 0,
      answer: "A",
    };
    expect(assessQuestionHeuristics(q)).toContain("who_said_brackets_in_quote");
  });
});
