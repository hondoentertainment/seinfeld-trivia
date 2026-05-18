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

const TITLE_STAND_INS = [
  "The Contest",
  "The Soup Nazi",
  "The Marine Biologist",
  "The Parking Garage",
  "The Chinese Restaurant",
  "The Puffy Shirt",
  "The Strike",
  "The Junior Mint",
  "The Opposite",
  "The Serenity Now",
];

const ACTOR_STAND_INS = [
  "Wayne Knight",
  "Heidi Swedberg",
  "John O'Hurley",
  "Patrick Warburton",
  "Barney Martin",
  "Liz Sheridan",
  "Jerry Stiller",
  "Estelle Harris",
  "Len Lesser",
  "Richard Herd",
  "Steve Hytner",
  "Danny Woodburn",
];

const TRANSCRIPT_WORD_STAND_INS = [
  "apartment",
  "restaurant",
  "neighbor",
  "telephone",
  "baseball",
  "doctor",
  "coffee",
  "parking",
  "movie",
  "office",
];

export type SanitizeReport = {
  creditColonNormalized: number;
  whoSpeakerJunkSwapped: number;
  duplicateOptionCellsRepaired: number;
  speakerOptionNormalized: number;
  whoPromptRewritten: number;
  whoPromptReplaced: number;
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

function titleCaseSpeakerOption(raw: string): string {
  const s = String(raw).trim();
  if (!/^[A-Z][A-Z .'-]+$/u.test(s)) return s;
  return s
    .toLowerCase()
    .replace(/\b[a-z]/gu, (m) => m.toUpperCase());
}

function isPlausibleSpeakerOption(raw: string): boolean {
  const s = String(raw).trim();
  if (s.length < 2 || s.length > 32) return false;
  if (WHO_OPTION_JUNK_EXACT_LC.has(normalizeComparable(s))) return false;
  if (/^(i|you|we|he|she|they|it|let'?s|this|that|there|here|all|oh|uh|um)\b/iu.test(s)) return false;
  if (/[?!,:;()[\]“”"]/.test(s)) return false;
  if (!/^[A-Za-z][A-Za-z .'-]*$/u.test(s)) return false;
  const words = s.split(/\s+/u);
  if (words.length > 3) return false;
  return words.every((word) => /^[A-Z][A-Za-z'.-]*$/u.test(word) || /^[A-Z]{2,}$/u.test(word));
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

function extractWhoQuoteText(question: string): string {
  return String(question)
    .replace(/^Who says:\s*[“"]/u, "")
    .replace(/[”"]\?\s*$/u, "")
    .replace(/[”"]\s*$/u, "")
    .trim();
}

function isGarbledWhoQuoteText(raw: string): boolean {
  const text = raw.trim();
  if (text.length < 12) return true;
  if (text.includes("??")) return true;
  if (/[\[\]]/.test(text)) return true;
  if (/\b[A-Z][A-Za-z'.-]{1,24}:\s/.test(text)) return true;
  return /^(sits|starts|walks|enters|exits|opens|closes|looks|turns|standing|sitting|gets|goes|comes|leaves|puts|takes|picks|continues|laughs|smiles|points|hands)\b/iu.test(text);
}

function quoteForSpeakerFromChunk(chunk: string, speaker: string): string | null {
  const escaped = speaker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = chunk.match(new RegExp(`\\b${escaped}:\\s*([^:]+?)(?=\\s+[A-Z][A-Za-z'.-]{1,24}:|$)`, "iu"));
  if (!match) return null;
  const cleaned = match[1]!
    .replace(/\([^)]*\)/gu, " ")
    .replace(/\[[^\]]*\]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  if (cleaned.length < 12) return null;
  return cleaned.length > 110 ? `${cleaned.slice(0, 109).trimEnd()}…` : cleaned;
}

function titleOptionsForEpisode(title: string, seriesIndex: number): string[] {
  const options = [title];
  for (const candidate of TITLE_STAND_INS) {
    if (normalizeComparable(candidate) !== normalizeComparable(title)) options.push(candidate);
    if (options.length === 4) break;
  }
  const shift = seriesIndex % options.length;
  return [...options.slice(shift), ...options.slice(0, shift)];
}

function replaceWithTitleQuestion(q: TriviaQuestion, ep: EpisodeBundle): TriviaQuestion {
  const options = titleOptionsForEpisode(ep.title, ep.seriesIndex);
  return {
    ...q,
    type: "title",
    question: "Which episode title matches this SeinfeldScripts installment?",
    options,
    correctIndex: options.findIndex((o) => normalizeComparable(o) === normalizeComparable(ep.title)),
    answer: ep.title,
  };
}

function replaceWithSeriesQuestion(q: TriviaQuestion, ep: EpisodeBundle): TriviaQuestion {
  const correct = String(ep.seriesIndex);
  const raw = [
    correct,
    String(Math.max(1, ep.seriesIndex - 1)),
    String(Math.min(180, ep.seriesIndex + 1)),
    String(Math.min(180, ep.seriesIndex + 7)),
  ];
  const options = [...new Set(raw)];
  let offset = 11;
  while (options.length < 4) {
    const candidate = String(Math.max(1, Math.min(180, ep.seriesIndex + offset)));
    if (!options.includes(candidate)) options.push(candidate);
    offset += 7;
  }
  return {
    ...q,
    type: "meta_series",
    question: "On the SeinfeldScripts master episode list, which series episode number is this installment?",
    options,
    correctIndex: options.findIndex((o) => o === correct),
    answer: correct,
  };
}

function isBadCastRoleQuestion(q: TriviaQuestion): boolean {
  if (q.type !== "cast") return false;
  const role = q.question.match(/who plays [“"](.+)[”"]\?/u)?.[1]?.trim() ?? "";
  const roleWords = role.split(/\s+/u);
  return (
    !isNameLikeOption(role) ||
    role.length < 4 ||
    /[.]/u.test(role) ||
    /^[A-Z\s]+$/u.test(role) ||
    /^(Hey|Hi|Hello|Yeah|Yes|No|Oh|Well|What|Why|How|When|Where)\b/u.test(role) ||
    (roleWords.length === 1 && !/^(Man|Woman|Waiter|Waitress|Doctor|Nurse|Clerk|Guard|Cop|Officer|Owner|Manager|Cashier)$/u.test(role))
  );
}

function isNameLikeOption(raw: string): boolean {
  return /^[A-Z][A-Za-z'.-]*(?: [A-Z][A-Za-z'.-]*){0,3}$/u.test(String(raw).trim());
}

function pickActorStandIn(existing: readonly string[]): string {
  const have = new Set(existing.map((x) => normalizeComparable(String(x))));
  for (const name of ACTOR_STAND_INS) {
    if (!have.has(normalizeComparable(name))) return name;
  }
  return "Guest Performer";
}

function dedupeActorOptions(opts: readonly string[]): { next: string[]; repairs: number } {
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
    next[dupAt] = pickActorStandIn(next);
    repairs++;
  }
  return { next, repairs };
}

function pickTranscriptWordStandIn(existing: readonly string[]): string {
  const have = new Set(existing.map((x) => normalizeComparable(String(x))));
  for (const word of TRANSCRIPT_WORD_STAND_INS) {
    if (!have.has(normalizeComparable(word))) return word;
  }
  return "episode";
}

function dedupeTranscriptWordOptions(opts: readonly string[]): { next: string[]; repairs: number } {
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
    next[dupAt] = pickTranscriptWordStandIn(next);
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
    let normalized = 0;
    for (let i = 0; i < opts.length; i++) {
      const before = opts[i]!;
      if (!isPlausibleSpeakerOption(before)) {
        opts[i] = pickStandInSpeaker(opts);
        swapped = true;
        continue;
      }
      const cleaned = titleCaseSpeakerOption(before);
      if (cleaned !== before) {
        opts[i] = cleaned;
        normalized++;
      }
    }
    if (swapped) delta.whoSpeakerJunkSwapped = 1;
    if (normalized > 0) delta.speakerOptionNormalized = normalized;

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

  if (next.type === "cast") {
    let repairs = 0;
    const options: string[] = [];
    for (const opt of next.options) {
      if (isNameLikeOption(opt)) {
        options.push(opt);
      } else {
        repairs++;
        options.push(pickActorStandIn([...next.options, ...options]));
      }
    }
    const { next: opts, repairs: dedupeRepairs } = dedupeActorOptions(options);
    if (repairs + dedupeRepairs > 0) {
      delta.duplicateOptionCellsRepaired =
        (delta.duplicateOptionCellsRepaired ?? 0) + repairs + dedupeRepairs;
      next = {
        ...next,
        options: opts,
        answer: opts[next.correctIndex]!,
      };
    }
  }

  if (next.type === "transcript_word") {
    const odd = /^(quagmire|marzipan|obstreperous|perspicacious|defenestrate|soliloquy|kleptocracy|verisimilitude|wanderlust)$/iu;
    let repairs = 0;
    const options = next.options.map((opt) => {
      if (!odd.test(String(opt).trim())) return opt;
      repairs++;
      return pickTranscriptWordStandIn(next.options);
    });
    const { next: deduped, repairs: dedupeRepairs } = dedupeTranscriptWordOptions(options);
    if (repairs + dedupeRepairs > 0) {
      next = {
        ...next,
        options: deduped,
        answer: deduped[next.correctIndex]!,
      };
      delta.duplicateOptionCellsRepaired =
        (delta.duplicateOptionCellsRepaired ?? 0) + repairs + dedupeRepairs;
    }
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
  if (delta.speakerOptionNormalized)
    total.speakerOptionNormalized += delta.speakerOptionNormalized;
  if (delta.whoPromptRewritten)
    total.whoPromptRewritten += delta.whoPromptRewritten;
  if (delta.whoPromptReplaced)
    total.whoPromptReplaced += delta.whoPromptReplaced;
}

export function sanitizeEpisodeBundle(ep: EpisodeBundle): {
  bundle: EpisodeBundle;
  report: SanitizeReport;
} {
  const aggregated: SanitizeReport = {
    creditColonNormalized: 0,
    whoSpeakerJunkSwapped: 0,
    duplicateOptionCellsRepaired: 0,
    speakerOptionNormalized: 0,
    whoPromptRewritten: 0,
    whoPromptReplaced: 0,
  };

  const questions = ep.questions.map((q0) => {
    const quoteText = q0.type === "who_said" ? extractWhoQuoteText(q0.question) : "";
    const repaired = isBadCastRoleQuestion(q0)
      ? {
          question: replaceWithSeriesQuestion(q0, ep),
          delta: { duplicateOptionCellsRepaired: 1 } satisfies SanitizeDelta,
        }
      : q0.type === "who_said" && isGarbledWhoQuoteText(quoteText)
        ? (() => {
            const quote = quoteForSpeakerFromChunk(quoteText, q0.answer);
            if (quote) {
              return {
                question: { ...q0, question: `Who says: “${quote}”?` },
                delta: { whoPromptRewritten: 1 } satisfies SanitizeDelta,
              };
            }
            return {
              question: replaceWithTitleQuestion(q0, ep),
              delta: { whoPromptReplaced: 1 } satisfies SanitizeDelta,
            };
          })()
        : { question: q0, delta: {} };

    mergeDelta(aggregated, repaired.delta);
    const { question: qOut, delta } = sanitizeQuestion(repaired.question);
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
