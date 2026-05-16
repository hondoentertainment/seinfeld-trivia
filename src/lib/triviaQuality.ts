import type { EpisodeBundle, TriviaQuestion } from "../types";

/** Normalize for comparing stored answer to selected option text */
export function normalizeComparable(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[’']/g, "'");
}

export type StructureIssue =
  | "missing_question"
  | "wrong_option_count"
  | "correct_index_range"
  | "missing_option_at_correct"
  | "answer_mismatch"
  | "empty_option";

export function validateQuestionStructure(q: TriviaQuestion): StructureIssue[] {
  const out: StructureIssue[] = [];
  if (!q.question || q.question.trim().length === 0) out.push("missing_question");
  if (!Array.isArray(q.options) || q.options.length !== 4) out.push("wrong_option_count");
  if (q.correctIndex < 0 || q.correctIndex > 3) out.push("correct_index_range");
  const picked = q.options[q.correctIndex];
  if (picked === undefined || String(picked).trim() === "") out.push("missing_option_at_correct");
  for (const opt of q.options) {
    if (opt === undefined || String(opt).trim() === "") out.push("empty_option");
  }
  if (picked !== undefined && normalizeComparable(picked) !== normalizeComparable(q.answer)) {
    out.push("answer_mismatch");
  }
  return [...new Set(out)];
}

export type HeuristicFlag =
  | "who_said_brackets_in_quote"
  | "who_said_nested_speaker_pattern"
  | "who_said_very_long_question"
  | "speaker_option_too_long"
  | "duplicate_answer_options"
  | "transcript_word_bogus_filler"
  | "weird_double_question_mark";

/** Non-blocking quality signals for review / trend tracking */
export function assessQuestionHeuristics(q: TriviaQuestion): HeuristicFlag[] {
  const flags: HeuristicFlag[] = [];
  const text = q.question;
  if (text.includes("??")) flags.push("weird_double_question_mark");

  if (q.type === "who_said") {
    const inner = text.replace(/^Who says:\s*[“"]/u, "").replace(/[”"]\?\s*$/u, "").replace(/[”"]\s*$/u, "");
    if (/[\[\]]/.test(inner)) flags.push("who_said_brackets_in_quote");
    if (/\s[A-Z]{2,}:\s/.test(inner) || /\]\s*[A-Za-z]+\s*:/.test(inner)) {
      flags.push("who_said_nested_speaker_pattern");
    }
    if (text.length > 220) flags.push("who_said_very_long_question");
    for (const opt of q.options) {
      if (String(opt).length > 40) flags.push("speaker_option_too_long");
    }
  }

  if (q.type === "transcript_word") {
    if (q.options.includes("quagmire")) flags.push("transcript_word_bogus_filler");
  }

  const lowerOpts = q.options.map((o) => normalizeComparable(String(o)));
  if (new Set(lowerOpts).size !== lowerOpts.length) {
    flags.push("duplicate_answer_options");
  }

  return [...new Set(flags)];
}

export type DatasetStats = {
  episodes: number;
  questionCount: number;
  structuralFailures: number;
  byStructureIssue: Partial<Record<StructureIssue, number>>;
  /** Percent of all questions with ≥1 heuristic flag */
  heuristicRate: number;
  byHeuristicFlag: Partial<Record<HeuristicFlag, number>>;
  samples: { episode: string; seriesIndex: number; id: number; issues: StructureIssue[] }[];
};

export function evaluateDataset(episodes: EpisodeBundle[]): DatasetStats {
  let structuralFailures = 0;
  const byStructureIssue: Partial<Record<StructureIssue, number>> = {};
  const samples: DatasetStats["samples"] = [];
  let flagged = 0;
  const byHeuristicFlag: Partial<Record<HeuristicFlag, number>> = {};
  let questionCount = 0;

  for (const ep of episodes) {
    for (const q of ep.questions) {
      questionCount++;
      const s = validateQuestionStructure(q);
      if (s.length > 0) {
        structuralFailures++;
        for (const issue of s) {
          byStructureIssue[issue] = (byStructureIssue[issue] ?? 0) + 1;
        }
        if (samples.length < 12) {
          samples.push({
            episode: ep.title,
            seriesIndex: ep.seriesIndex,
            id: q.id,
            issues: s,
          });
        }
      }
      const hf = assessQuestionHeuristics(q);
      if (hf.length > 0) {
        flagged++;
        for (const f of hf) {
          byHeuristicFlag[f] = (byHeuristicFlag[f] ?? 0) + 1;
        }
      }
    }
  }

  return {
    episodes: episodes.length,
    questionCount,
    structuralFailures,
    byStructureIssue,
    heuristicRate: questionCount ? flagged / questionCount : 0,
    byHeuristicFlag,
    samples,
  };
}

/** Expect 25 questions per bundle (generator contract) */
export function validateEpisodeShape(ep: EpisodeBundle): string[] {
  const e: string[] = [];
  if (ep.questions.length !== 25) e.push(`Expected 25 questions, got ${ep.questions.length}`);
  const ids = new Set(ep.questions.map((q) => q.id));
  if (ids.size !== ep.questions.length) e.push("Duplicate question ids within episode");
  return e;
}
