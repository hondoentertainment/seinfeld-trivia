import type { EpisodeBundle, TriviaQuestion } from "../types";
import { normalizeComparable, validateQuestionStructure } from "./triviaQuality";

const CREDIT_TYPES = new Set<string>(["written_by", "directed_by"]);

/** Plausible foil names for Written By trivia (excluding odd parsing tokens) */
const WRITTEN_STAND_INS = [
  "Larry Charles",
  "Tom Cherones",
  "Andy Ackerman",
  "David Steinberg",
  "Peter Mehlman",
  "Carol Leifer",
  "Marjorie Gross",
  "Spike Feresten",
  "Jennifer Crittenden",
  "Bruce Eric Kaplan",
  "Bruce Kirschbaum",
  "Gregg Kavet",
  "Andy Robin",
];

/** Plausible foil names for Directed By trivia */
const DIRECTED_STAND_INS = [
  "Tom Cherones",
  "Andy Ackerman",
  "David Steinberg",
  "Jason Alexander",
  "Joshua White",
  "Art Wolff",
  "Dwight Hemion",
];

/** Table/boilerplate text that leaked into “who said” distractors */
const WHO_OPTION_JUNK_EXACT_LC = new Set([
  "originally aired",
  "written by",
  "directed by",
]);

const SPEAKER_STAND_INS = [
  "Jerry",
  "George",
  "Elaine",
  "Kramer",
  "Newman",
  "Morty",
  "Helen",
  "Frank",
  "Estelle",
  "Susan",
  "Peterman",
  "Puddy",
  "Wilhelm",
  "Bania",
];

export type SanitizeReport = {
  creditColonNormalized: number;
  whoSpeakerJunkSwapped: number;
  duplicateOptionCellsRepaired: number;
};

export type SanitizeDelta = Partial<SanitizeReport>;

function pickCreditStandin(existing: readonly string[], kind: "written_by" | "directed_by"): string {
  const have = new Set(existing.map((x) => normalizeComparable(String(x))));
  const pool = kind === "written_by" ? WRITTEN_STAND_INS : DIRECTED_STAND_INS;
  for (const name of pool) {
    if (!have.has(normalizeComparable(name))) return name;
  }
  let n = 0;
  for (;;) {
    const stub = `${kind === "written_by" ? "Writer foil" : "Director foil"} ${++n}`;
    if (!have.has(normalizeComparable(stub))) return stub;
  }
}

/** Same normalized text appears twice → replace extras with unused stand-ins */
function dedupeCreditOptions(
  optsIn: readonly string[],
  correctIndex: number,
  kind: "written_by" | "directed_by",
): { opts: string[]; repairs: number } {
  let options = [...optsIn];
  let repairs = 0;
  for (let guard = 0; guard < 48; guard++) {
    const keys = options.map((o) => normalizeComparable(o));
    const posByKey = new Map<string, number[]>();
    keys.forEach((k, i) => {
      if (!posByKey.has(k)) posByKey.set(k, []);
      posByKey.get(k)!.push(i);
    });
    let conflict: number[] | null = null;
    for (const poses of posByKey.values()) {
      if ((poses?.length ?? 0) > 1) {
        conflict = poses!;
        break;
      }
    }
    if (!conflict) break;
    const sorted = [...conflict].sort((a, b) => a - b);
    const keeper = sorted.includes(correctIndex) ? correctIndex : sorted[0]!;
    for (const ix of sorted) {
      if (ix === keeper) continue;
      options[ix] = pickCreditStandin(options, kind);
      repairs++;
    }
  }
  return { opts: options, repairs };
}

function stripLeadingColon(s: string): string {
  let t = String(s).trim();
  while (t.startsWith(":")) {
    t = t.slice(1).trimStart();
  }
  return t.trim();
}

function pickStandInSpeaker(existing: readonly string[]): string {
  const have = new Set(existing.map((x) => normalizeComparable(String(x))));
  for (const p of SPEAKER_STAND_INS) {
    if (!have.has(normalizeComparable(p))) return p;
  }
  /* c8 ignore next */
  return "Guest voice";
}

function dedupeSpeakerOptions(opts: readonly string[]): { next: string[]; repairs: number } {
  const next = [...opts];
  let repairs = 0;
  for (let guard = 0; guard < 48; guard++) {
    const keys = next.map((o) => normalizeComparable(o));
    const seen = new Set<string>();
    let dupAt = -1;
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i]!;
      if (seen.has(k)) {
        dupAt = i;
        break;
      }
      seen.add(k);
    }
    if (dupAt < 0) break;
    next[dupAt] = pickStandInSpeaker(next);
    repairs++;
  }
  return { next, repairs };
}

export function sanitizeQuestion(q: TriviaQuestion): {
  question: TriviaQuestion;
  delta: SanitizeDelta;
} {
  let next: TriviaQuestion = { ...q, options: [...q.options] };
  const delta: SanitizeDelta = {};

  if (CREDIT_TYPES.has(next.type)) {
    const kind = next.type as "written_by" | "directed_by";
    const beforeOpts = [...next.options];
    const strippedOpts = next.options.map((o) => stripLeadingColon(o));
    const stripped = strippedOpts.some((o, i) => o !== beforeOpts[i]);

    const { opts: uniqOpts, repairs: creditDedupRepairs } = dedupeCreditOptions(
      strippedOpts,
      next.correctIndex,
      kind,
    );
    next = {
      ...next,
      options: uniqOpts,
      answer: uniqOpts[next.correctIndex]!,
    };
    if (stripped) delta.creditColonNormalized = 1;
    if (creditDedupRepairs > 0) {
      delta.duplicateOptionCellsRepaired =
        (delta.duplicateOptionCellsRepaired ?? 0) + creditDedupRepairs;
    }
  }

  if (next.type === "who_said") {
    let opts = [...next.options];
    let swapped = false;
    for (let i = 0; i < opts.length; i++) {
      if (WHO_OPTION_JUNK_EXACT_LC.has(normalizeComparable(opts[i]!))) {
        opts[i] = pickStandInSpeaker(opts);
        swapped = true;
      }
    }
    if (swapped) delta.whoSpeakerJunkSwapped = 1;

    const { next: uniq, repairs: speakerDedupRepairs } = dedupeSpeakerOptions(opts);
    if (speakerDedupRepairs > 0) {
      delta.duplicateOptionCellsRepaired =
        (delta.duplicateOptionCellsRepaired ?? 0) + speakerDedupRepairs;
    }

    next = {
      ...next,
      options: uniq,
      answer: uniq[next.correctIndex]!,
    };
  }

  const issues = validateQuestionStructure(next);
  if (issues.length > 0) {
    throw new Error(`sanitize produced structural issues: ${issues.join(",")}`);
  }

  return { question: next, delta };
}

export function mergeDelta(total: SanitizeReport, delta: SanitizeDelta): void {
  if (delta.creditColonNormalized)
    total.creditColonNormalized += delta.creditColonNormalized;
  if (delta.whoSpeakerJunkSwapped)
    total.whoSpeakerJunkSwapped += delta.whoSpeakerJunkSwapped;
  if (delta.duplicateOptionCellsRepaired)
    total.duplicateOptionCellsRepaired += delta.duplicateOptionCellsRepaired;
}

export function sanitizeEpisodeBundle(ep: EpisodeBundle): {
  bundle: EpisodeBundle;
  report: SanitizeReport;
} {
  const aggregated: SanitizeReport = {
    creditColonNormalized: 0,
    whoSpeakerJunkSwapped: 0,
    duplicateOptionCellsRepaired: 0,
  };

  const questions = ep.questions.map((q0) => {
    const { question: qOut, delta } = sanitizeQuestion(q0);
    if (Object.keys(delta).length > 0) {
      mergeDelta(aggregated, delta);
    }
    return qOut;
  });

  return {
    bundle: { ...ep, questions },
    report: aggregated,
  };
}
