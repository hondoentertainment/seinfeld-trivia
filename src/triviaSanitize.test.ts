import { describe, expect, it } from "vitest";
import type { TriviaQuestion } from "./types";
import { assessQuestionHeuristics } from "./lib/triviaQuality";
import { sanitizeQuestion } from "./lib/triviaSanitize";

describe("sanitizeQuestion", () => {
  it("strips screenplay colon bleed off writer/director trivia", () => {
    const q: TriviaQuestion = {
      id: 9,
      type: "written_by",
      question: `According to the script transcription, who is credited as “Written By”?`,
      options: [": Larry David and Jerry Seinfeld", "Larry Charles", "Tom Cherones", "Andy Ackerman"],
      correctIndex: 0,
      answer: ": Larry David and Jerry Seinfeld",
    };
    expect(assessQuestionHeuristics(q)).toContain("credit_line_leading_colon");

    const { question: cleaned, delta } = sanitizeQuestion(q);
    expect(delta.creditColonNormalized).toBe(1);
    expect(cleaned.options[0]).toBe("Larry David and Jerry Seinfeld");
    expect(cleaned.answer).toBe("Larry David and Jerry Seinfeld");
    expect(assessQuestionHeuristics(cleaned)).not.toContain("credit_line_leading_colon");
  });
  it("purges nonsense tabular labels from speaker distractors", () => {
    const q: TriviaQuestion = {
      id: 2,
      type: "who_said",
      question: 'Who says: “Hello there?”',
      options: ["Jerry", "Originally Aired", "George", "Elaine"],
      correctIndex: 0,
      answer: "Jerry",
    };
    expect(assessQuestionHeuristics(q)).toContain("metadata_boilerplate_speaker_option");

    const { question: cleaned, delta } = sanitizeQuestion(q);
    expect(delta.whoSpeakerJunkSwapped).toBe(1);
    expect(cleaned.options).not.toContain("Originally Aired");
    expect(new Set(cleaned.options.map((o) => o.toLowerCase())).size).toBe(4);
    expect(cleaned.answer).toBe("Jerry");
    expect(cleaned.correctIndex).toBe(0);
    expect(assessQuestionHeuristics(cleaned)).not.toContain("metadata_boilerplate_speaker_option");
  });

  it("fills in fresh credit foils when the generator repeats the same name twice", () => {
    const q: TriviaQuestion = {
      id: 31,
      type: "directed_by",
      question: `According to the script transcription, who is credited as “Directed By”?`,
      options: ["Tom Cherones", "Larry Charles", "Larry Charles", "David Steinberg"],
      correctIndex: 0,
      answer: "Tom Cherones",
    };
    expect(assessQuestionHeuristics(q)).toContain("duplicate_answer_options");

    const { question: cleaned, delta } = sanitizeQuestion(q);
    expect(delta.duplicateOptionCellsRepaired).toBeGreaterThan(0);
    const lower = cleaned.options.map((o) => o.toLowerCase());
    expect(new Set(lower).size).toBe(4);
    expect(cleaned.answer).toBe(cleaned.options[cleaned.correctIndex]);
    expect(assessQuestionHeuristics(cleaned)).not.toContain("duplicate_answer_options");
  });
});
