/**
 * Builds multiple-choice trivia from full episode scripts at seinfeldscripts.com.
 * Sources: episode index (data/episodes.json) + per-episode script pages (same site).
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

/** @param {number} seed */
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function htmlToText(html) {
  let t = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  t = t
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

  const lines = t.split(/\r?\n/);
  const out = [];
  for (const line of lines) {
    const trimmed = line.replace(/\s+$/u, "").replace(/^\s+/u, "");
    if (trimmed) out.push(trimmed);
  }
  return out.join("\n");
}

function normalizeSpeaker(sp) {
  return sp.replace(/\s+/g, " ").trim();
}

const BAD_SPEAKERS = new Set([
  "I",
  "WE",
  "YOU",
  "HE",
  "SHE",
  "IT",
  "THEY",
  "A",
  "AN",
  "THE",
  "AND",
  "OR",
  "BUT",
  "NOT",
]);

/** @param {string} text */
function extractDialogueAlternate(text) {
  const names = [
    "Jerry",
    "George",
    "Elaine",
    "Kramer",
    "Newman",
    "Frank",
    "Estelle",
    "Helen",
    "Morty",
    "Wilhelm",
    "Bania",
    "Peterman",
    "Puddy",
    "Mickey",
    "Susan",
    "Lloyd",
    "Jimmy",
    "Tim",
    "Nina",
    "Julie",
    "Karen",
    "Bette",
    "Rudy",
    "Katie",
    "Larry",
    "David",
  ];
  const re = new RegExp(`\\b(${names.join("|")})\\s+`, "gi");
  /** @type {{index:number, speaker:string, start:number, end:number}[]} */
  const hits = [];
  let m;
  while ((m = re.exec(text)) != null) {
    hits.push({
      index: m.index,
      speaker: m[1].slice(0, 1).toUpperCase() + m[1].slice(1).toLowerCase(),
      start: m.index + m[0].length,
      end: 0,
    });
  }
  for (let i = 0; i < hits.length; i++) {
    hits[i].end = i + 1 < hits.length ? hits[i + 1].index : text.length;
  }
  /** @type {{speaker:string, line:string}[]} */
  const rows = [];
  for (const h of hits) {
    let line = text.slice(h.start, h.end).trim();
    line = line.replace(/\[[^\]]*\]/g, "").replace(/\([^)]{80,}\)/g, "").trim();
    if (line.length < 8) continue;
    rows.push({ speaker: h.speaker, line });
  }
  return rows;
}

/** @param {string} text */
function extractDialogueCombined(text) {
  const a = extractDialogue(text);
  const b = extractDialogueAlternate(text);
  const key = (r) => `${r.speaker}|${r.line.slice(0, 160)}`;
  const seen = new Set(a.map(key));
  for (const r of b) {
    if (!seen.has(key(r))) {
      a.push(r);
      seen.add(key(r));
    }
  }
  return a;
}

function isGarbageSpeakerLabel(speaker) {
  const s = normalizeSpeaker(speaker);
  if (/originally aired/i.test(s)) return true;
  if (/^(written by|directed by)$/iu.test(s)) return true;
  return false;
}

function isPlausibleSpeakerLabel(speaker) {
  const s = normalizeSpeaker(speaker);
  if (isGarbageSpeakerLabel(s)) return false;
  if (s.length < 2 || s.length > 32) return false;
  if (/^(i|you|we|he|she|they|it|let'?s|this|that|there|here|all|oh|uh|um)\b/iu.test(s)) return false;
  if (/[?!,:;()[\]“”"]/.test(s)) return false;
  if (!/^[A-Za-z][A-Za-z .'-]*$/u.test(s)) return false;
  const words = s.split(/\s+/u);
  if (words.length > 3) return false;
  return words.every((word) => /^[A-Z][A-Za-z'.-]*$/u.test(word) || /^[A-Z]{2,}$/u.test(word));
}

/** Strip colon bleed leftover from screenplay lines + double-space segmentation */
function cleanCreditExtract(raw) {
  if (!raw) return null;
  let s = raw.replace(/\.+$/, "").trim();
  const firstSegment = s.split(/\s{2,}/)[0]?.trim() ?? s;
  let cleaned = firstSegment.trimStart();
  while (cleaned.startsWith(":")) {
    cleaned = cleaned.slice(1).trimStart();
  }
  return cleaned.length ? cleaned : null;
}

/** @param {string} text */
function extractDialogue(text) {
  /** @type {{speaker:string, line:string}[]} */
  const rows = [];
  const re =
    /^\s*([A-Z][A-Za-z0-9 &'.-]{0,40}?)\s*:\s*(.+?)\s*$/gmu;
  let m;
  while ((m = re.exec(text)) != null) {
    let speaker = normalizeSpeaker(m[1]);
    if (/^(INT|EXT|SCENE|CUT TO|FADE)/i.test(speaker)) continue;
    if (speaker.length < 2 || speaker.length > 36) continue;
    if (BAD_SPEAKERS.has(speaker.toUpperCase())) continue;
    if (!isPlausibleSpeakerLabel(speaker)) continue;
    if (/\b(and|&)\b/i.test(speaker)) continue;
    let line = m[2].trim();
    line = line.replace(/\[[^\]]*\]/g, "").replace(/\([^)]{80,}\)/g, "").trim();
    if (line.length < 12) continue;
    rows.push({ speaker, line });
  }
  return rows;
}

/** @param {string} text */
function extractScenes(text) {
  const scenes = new Set();
  const re = /\[Scene:\s*([^\]]+)\]/gi;
  let m;
  while ((m = re.exec(text)) != null) {
    const s = m[1].replace(/\s+/g, " ").trim();
    if (s.length >= 4 && s.length < 120) scenes.add(s);
  }
  return [...scenes];
}

/** @param {string} text */
function extractCredits(text) {
  let writtenBy = null;
  let directedBy = null;
  const w = text.match(/Written\s+By\b[.\s]*([^\n]+)/i);
  if (w) writtenBy = cleanCreditExtract(w[1]);
  const d = text.match(/Directed\s+By\b[.\s]*([^\n]+)/i);
  if (d) directedBy = cleanCreditExtract(d[1]);
  return { writtenBy, directedBy };
}

/** @param {string} text */
function extractCastPairs(text) {
  /** @type {{role:string, actor:string}[]} */
  const pairs = [];
  const block = text.split(/Quotes and Scene summary/i)[0] || text;
  const lines = block.split(/\n/);
  const main = new Set([
    "jerry",
    "george",
    "elaine",
    "kramer",
    "jerry seinfeld",
    "george costanza",
    "george castanza",
    "newman",
  ]);
  const re = /^\s*([A-Za-z][A-Za-z0-9 &'.-]{1,40})\s*\.{2,}\s*(.+)$/u;
  for (const raw of lines) {
    const line = raw.trim();
    const m = line.match(re);
    if (!m) continue;
    const role = m[1].trim();
    const actor = m[2].replace(/\s*\([^)]*\)\s*$/u, "").trim();
    if (!actor || actor.length < 3) continue;
    const key = role.toLowerCase();
    if (main.has(key)) continue;
    if (/^(with|cast|production|supervising)/i.test(role)) continue;
    pairs.push({ role, actor });
  }
  return pairs.slice(0, 24);
}

/**
 * Used for clip-show style pages where dialogue extraction is sparse.
 * @param {string} scriptText
 * @param {(n:number)=>number} rng
 * @param {number} maxNeeded
 * @param {number} [minLen=6]
 */
function buildTranscriptWordQuestions(scriptText, rng, maxNeeded, minLen = 6) {
  const lower = scriptText.toLowerCase();
  const STOP = new Set([
    "about",
    "actually",
    "anything",
    "because",
    "could",
    "couldnt",
    "episode",
    "everything",
    "from",
    "have",
    "into",
    "nothing",
    "really",
    "script",
    "season",
    "seinfeld",
    "something",
    "their",
    "there",
    "these",
    "those",
    "though",
    "through",
    "under",
    "where",
    "which",
    "would",
  ]);
  const filler = [
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
  const re = new RegExp(`\\b[a-z]{${minLen},15}\\b`, "g");
  const words = [
    ...new Set(
      (lower.match(re) || []).filter((w) => {
        if (STOP.has(w)) return false;
        if (w.includes("seinfeld")) return false;
        return true;
      })
    ),
  ];
  const shuf = words.sort(() => rng() - 0.5);
  /** @type {any[]} */
  const out = [];
  for (let i = 0; i < maxNeeded && shuf.length; i++) {
    const correct = shuf.pop();
    const wrong = filler
      .filter((d) => d !== correct && !lower.includes(d))
      .sort(() => rng() - 0.5)
      .slice(0, 3);
    while (wrong.length < 3) {
      wrong.push(filler.find((d) => d !== correct && !wrong.includes(d)) ?? "episode");
    }
    const opts = [correct, ...wrong.slice(0, 3)].sort(() => rng() - 0.5);
    const correctIndex = opts.findIndex((o) => o === correct);
    out.push({
      type: "transcript_word",
      question: `Which word appears in the text of the SeinfeldScripts page for this episode?`,
      options: opts,
      correctIndex,
      answer: correct,
    });
  }
  return out;
}

function clipQuote(s, max = 96) {
  const one = s.replace(/\s+/g, " ").trim();
  const clipped = one.length <= max ? one : one.slice(0, max - 1).trimEnd() + "…";
  return clipped.replace(/\?+$/u, "").trim();
}

/** Stage-direction bleed or merged speaker lines — skip for “who said” quotes */
function isLikelyGarbledDialogueLine(line) {
  if (/[\[\]]/.test(line)) return true;
  if (/\s[A-Z]{2,}:\s/.test(line)) return true;
  return false;
}

/** @param {string[]} pool */
function pickDistractorSpeakers(correct, pool, need, rng) {
  const c = correct.toLowerCase();
  const rest = pool.filter((p) => p.toLowerCase() !== c);
  const out = [];
  const used = new Set();
  while (out.length < need && rest.length > 0) {
    const idx = Math.floor(rng() * rest.length);
    const pick = rest.splice(idx, 1)[0];
    const k = pick.toLowerCase();
    if (used.has(k)) continue;
    used.add(k);
    out.push(pick);
  }
  const fallback = ["Jerry", "George", "Elaine", "Kramer", "Newman"];
  for (const f of fallback) {
    if (out.length >= need) break;
    if (f.toLowerCase() === c) continue;
    if (used.has(f.toLowerCase())) continue;
    used.add(f.toLowerCase());
    out.push(f);
  }
  return out.slice(0, need);
}

function pickDistinctOptions(correct, pool, need, rng) {
  const out = [];
  const used = new Set([String(correct).toLowerCase()]);
  const rest = pool.filter((p) => {
    const key = String(p).toLowerCase();
    return key !== String(correct).toLowerCase() && !used.has(key);
  });
  while (out.length < need && rest.length > 0) {
    const idx = Math.floor(rng() * rest.length);
    const pick = rest.splice(idx, 1)[0];
    const key = String(pick).toLowerCase();
    if (used.has(key)) continue;
    used.add(key);
    out.push(pick);
  }
  return out;
}

function nearbySeriesNumbers(seriesIndex) {
  const candidates = [
    seriesIndex - 2,
    seriesIndex - 1,
    seriesIndex + 1,
    seriesIndex + 2,
    seriesIndex + 5,
    seriesIndex - 5,
  ];
  return candidates.filter((n) => n >= 1 && n <= 180).map(String);
}

function nearbyAirDates(ep, allEpisodes) {
  return allEpisodes
    .filter((other) => other.seriesIndex !== ep.seriesIndex && Math.abs(other.seriesIndex - ep.seriesIndex) <= 8)
    .sort((a, b) => Math.abs(a.seriesIndex - ep.seriesIndex) - Math.abs(b.seriesIndex - ep.seriesIndex))
    .map((other) => other.airDate);
}

function nearbyTitles(ep, allEpisodes) {
  return allEpisodes
    .filter((other) => other.seriesIndex !== ep.seriesIndex && (other.season === ep.season || Math.abs(other.seriesIndex - ep.seriesIndex) <= 8))
    .sort((a, b) => {
      const seasonA = a.season === ep.season ? 0 : 1;
      const seasonB = b.season === ep.season ? 0 : 1;
      return seasonA - seasonB || Math.abs(a.seriesIndex - ep.seriesIndex) - Math.abs(b.seriesIndex - ep.seriesIndex);
    })
    .map((other) => other.title);
}

/**
 * @param {any} ep
 * @param {any[]} allEpisodes
 * @param {string} scriptText
 * @param {(n:number)=>number} rng
 */
function buildQuestions(ep, allEpisodes, scriptText, rng) {
  const dialogue = extractDialogueCombined(scriptText);
  const scenes = extractScenes(scriptText);
  const credits = extractCredits(scriptText);
  const cast = extractCastPairs(scriptText);
  const speakerPool = [...new Set(dialogue.map((d) => d.speaker))].filter(
    (s) => isPlausibleSpeakerLabel(s),
  );

  /** @type {any[]} */
  const questions = [];
  let qid = 1;

  const usedLineIdx = new Set();
  const whoPool = [];
  for (let i = 0; i < dialogue.length; i++) {
    if (dialogue[i].line.length >= 20 && !isLikelyGarbledDialogueLine(dialogue[i].line)) whoPool.push(i);
  }

  const whoOrder = whoPool.slice().sort(() => rng() - 0.5);
  const targetWho = 14;
  for (let n = 0; n < targetWho && whoOrder.length > 0; n++) {
    const i = whoOrder.pop();
    if (i == null || usedLineIdx.has(i)) continue;
    usedLineIdx.add(i);
    const row = dialogue[i];
    const quote = clipQuote(row.line, 110);
    const wrong = pickDistractorSpeakers(row.speaker, speakerPool, 3, rng);
    const opts = [row.speaker, ...wrong].sort(() => rng() - 0.5);
    const correctIndex = opts.findIndex(
      (o) => o.toLowerCase() === row.speaker.toLowerCase()
    );
    questions.push({
      id: qid++,
      type: "who_said",
      question: `Who says: “${quote}”?`,
      options: opts,
      correctIndex,
      answer: row.speaker,
    });
  }

  const sceneTarget = Math.min(6, Math.max(0, scenes.length));
  const scenePool = scenes.slice().sort(() => rng() - 0.5);
  for (let n = 0; n < sceneTarget && scenePool.length; n++) {
    const correct = scenePool.pop();
    const wrongPool = scenes.filter((s) => s !== correct);
    const wrong = [];
    while (wrong.length < 3 && wrongPool.length) {
      const pick = wrongPool.splice(Math.floor(rng() * wrongPool.length), 1)[0];
      if (!wrong.includes(pick)) wrong.push(pick);
    }
    while (wrong.length < 3) wrong.push("Monk's café");
    const opts = [correct, ...wrong.slice(0, 3)].sort(() => rng() - 0.5);
    const correctIndex = opts.findIndex((o) => o === correct);
    questions.push({
      id: qid++,
      type: "scene_setting",
      question: `Which setting appears as a scripted scene heading in this episode?`,
      options: opts.map((o) => clipQuote(o, 100)),
      correctIndex,
      answer: clipQuote(correct, 200),
    });
  }

  if (credits.writtenBy) {
    const creditPool = [
      "Larry Charles",
      "David Steinberg",
      "Peter Mehlman",
      "Carol Leifer",
      "Marjorie Gross",
      "Spike Feresten",
      "Jennifer Crittenden",
      "Bruce Eric Kaplan",
      "Gregg Kavet",
      "Andy Robin",
      "Alec Berg",
      "Jeff Schaffer",
    ];
    const wrong = pickDistinctOptions(credits.writtenBy, creditPool, 3, rng);
    const opts = [credits.writtenBy, ...wrong].sort(() => rng() - 0.5);
    const correctIndex = opts.findIndex(
      (o) => o.toLowerCase() === credits.writtenBy.toLowerCase()
    );
    questions.push({
      id: qid++,
      type: "written_by",
      question: `According to the script transcription, who is credited as “Written By”?`,
      options: opts,
      correctIndex,
      answer: credits.writtenBy,
    });
  }

  if (credits.directedBy) {
    const directorPool = [
      "Tom Cherones",
      "Andy Ackerman",
      "David Steinberg",
      "Jason Alexander",
      "Joshua White",
      "Art Wolff",
      "Dwight Hemion",
    ];
    const wrong = pickDistinctOptions(credits.directedBy, directorPool, 3, rng);
    const opts = [credits.directedBy, ...wrong].sort(() => rng() - 0.5);
    const correctIndex = opts.findIndex(
      (o) => o.toLowerCase() === credits.directedBy.toLowerCase()
    );
    questions.push({
      id: qid++,
      type: "directed_by",
      question: `According to the script transcription, who is credited as “Directed By”?`,
      options: opts,
      correctIndex,
      answer: credits.directedBy,
    });
  }

  const castTarget = Math.min(3, cast.length);
  const castPool = cast.slice().sort(() => rng() - 0.5);
  for (let n = 0; n < castTarget && castPool.length; n++) {
    const { role, actor } = castPool.pop();
    const wrongActors = pickDistractorSpeakers(
      actor,
      [...new Set(cast.map((c) => c.actor))],
      3,
      rng
    );
    const opts = [actor, ...wrongActors].sort(() => rng() - 0.5);
    const correctIndex = opts.findIndex(
      (o) => o.toLowerCase() === actor.toLowerCase()
    );
    questions.push({
      id: qid++,
      type: "cast",
      question: `In the cast list, who plays \u201c${role}\u201d?`,
      options: opts,
      correctIndex,
      answer: actor,
    });
  }

  {
    const correct = String(ep.seriesIndex);
    const raw = [correct, ...nearbySeriesNumbers(ep.seriesIndex)];
    const opts = [...new Set(raw)].slice(0, 4);
    while (opts.length < 4) opts.push(String(Number(opts[opts.length - 1]) + 3));
    const shuffled = opts.sort(() => rng() - 0.5);
    questions.push({
      id: qid++,
      type: "meta_series",
      question: `On the SeinfeldScripts master episode list, which series episode number is this installment?`,
      options: shuffled,
      correctIndex: shuffled.findIndex((o) => o === correct),
      answer: correct,
    });
  }

  {
    const correct = `Season ${ep.season}`;
    const allSeasonLabels = Array.from({ length: 10 }, (_, i) => `Season ${i}`);
    const wrong = allSeasonLabels
      .filter((s) => s !== correct)
      .sort(() => rng() - 0.5)
      .slice(0, 3);
    const shuffled = [correct, ...wrong].sort(() => rng() - 0.5);
    questions.push({
      id: qid++,
      type: "meta_season",
      question: `On SeinfeldScripts.com, this episode is grouped under which season header?`,
      options: shuffled,
      correctIndex: shuffled.findIndex((o) => o === correct),
      answer: correct,
    });
  }

  {
    const correct = ep.airDate;
    const pool = [correct, ...nearbyAirDates(ep, allEpisodes)];
    const uniq = [];
    const seen = new Set();
    for (const d of pool) {
      if (!seen.has(d)) {
        seen.add(d);
        uniq.push(d);
      }
      if (uniq.length >= 4) break;
    }
    let n = 1;
    while (uniq.length < 4) {
      const stub = `${n}/15/95`;
      n++;
      if (!seen.has(stub)) {
        seen.add(stub);
        uniq.push(stub);
      }
    }
    const shuffled = uniq.slice(0, 4).sort(() => rng() - 0.5);
    questions.push({
      id: qid++,
      type: "meta_airdate",
      question: `The SeinfeldScripts episode index lists which original airdate stamp for this episode?`,
      options: shuffled,
      correctIndex: shuffled.findIndex((o) => o === correct),
      answer: correct,
    });
  }

  // Pad with additional “who said” if short
  while (questions.length < 25 && whoOrder.length > 0) {
    const i = whoOrder.pop();
    if (i == null || usedLineIdx.has(i)) continue;
    usedLineIdx.add(i);
    const row = dialogue[i];
    const quote = clipQuote(row.line, 110);
    const wrong = pickDistractorSpeakers(row.speaker, speakerPool, 3, rng);
    const opts = [row.speaker, ...wrong].sort(() => rng() - 0.5);
    const correctIndex = opts.findIndex(
      (o) => o.toLowerCase() === row.speaker.toLowerCase()
    );
    questions.push({
      id: qid++,
      type: "who_said",
      question: `Who says: “${quote}”?`,
      options: opts,
      correctIndex,
      answer: row.speaker,
    });
  }

  // Title recognition
  {
    const decoys = pickDistinctOptions(ep.title, nearbyTitles(ep, allEpisodes), 3, rng);
    const opts = [ep.title, ...decoys].sort(() => rng() - 0.5);
    const correctIndex = opts.findIndex((o) => o === ep.title);
    questions.push({
      id: qid++,
      type: "title",
      question: `Which episode title matches this SeinfeldScripts installment?`,
      options: opts,
      correctIndex,
      answer: ep.title,
    });
  }

  // Pad with trivial dialogue pulls: unique word in line
  while (questions.length < 25 && dialogue.length) {
    const idx = Math.floor(rng() * dialogue.length);
    const row = dialogue[idx];
    const quote = clipQuote(row.line, 80);
    const wrong = pickDistractorSpeakers(row.speaker, speakerPool, 3, rng);
    const opts = [row.speaker, ...wrong].sort(() => rng() - 0.5);
    const correctIndex = opts.findIndex(
      (o) => o.toLowerCase() === row.speaker.toLowerCase()
    );
    questions.push({
      id: qid++,
      type: "who_said",
      question: `Who says: “${quote}”?`,
      options: opts,
      correctIndex,
      answer: row.speaker,
    });
  }

  {
    const need = 25 - questions.length;
    let rem = need;
    for (let minLen = 6; minLen >= 4 && rem > 0; minLen--) {
      const batch = buildTranscriptWordQuestions(scriptText, rng, rem, minLen);
      for (const q of batch) {
        questions.push({ ...q, id: qid++ });
      }
      rem -= batch.length;
    }
  }

  let padIter = 0;
  while (questions.length < 25 && padIter < 30) {
    padIter++;
    const offset = padIter;
    const correct = `#${ep.seriesIndex}`;
    const opts = [correct, `#${ep.seriesIndex + offset}`, `#${ep.seriesIndex + offset * 3}`, `#${ep.seriesIndex + 17}`]
      .map((x) => x.replace("#-", "#"))
      .filter((v, i, a) => a.indexOf(v) === i);
    while (opts.length < 4) opts.push(`#${ep.seriesIndex + 40 + opts.length}`);
    const shuffled = opts.slice(0, 4).sort(() => rng() - 0.5);
    questions.push({
      id: qid++,
      type: "meta_series_alt",
      question: `Which SeinfeldScripts series index (left column number on the master list) is this episode?`,
      options: shuffled,
      correctIndex: shuffled.findIndex((o) => o === correct),
      answer: correct,
    });
  }

  // Renumber ids and trim to 25
  const finalQs = questions.slice(0, 25).map((q, i) => ({ ...q, id: i + 1 }));
  if (finalQs.length < 25) {
    throw new Error(`Could only form ${finalQs.length} questions for ${ep.title}`);
  }
  return finalQs;
}

async function fetchScript(url, attempts = 3) {
  const httpUrl = url.replace(/^https:/i, "http:");
  let lastErr;
  for (let a = 0; a < attempts; a++) {
    try {
      const res = await fetch(httpUrl, {
        headers: {
          "user-agent": "SeinfeldTriviaGenerator/1.0 (educational; +local)",
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      lastErr = e;
      await sleep(500 * (a + 1));
    }
  }
  throw lastErr;
}

function parseArgs(argv) {
  const out = { season: null, from: null, to: null, delay: 350 };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--season") out.season = Number(argv[++i]);
    else if (a === "--from") out.from = Number(argv[++i]);
    else if (a === "--to") out.to = Number(argv[++i]);
    else if (a === "--delay") out.delay = Number(argv[++i]);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  const indexPath = join(ROOT, "data", "episodes.json");
  const raw = await readFile(indexPath, "utf8");
  const pack = JSON.parse(raw);
  /** @type {any[]} */
  let episodes = pack.episodes;
  if (args.season != null && !Number.isNaN(args.season))
    episodes = episodes.filter((e) => e.season === args.season);
  if (args.from != null) episodes = episodes.filter((e) => e.seriesIndex >= args.from);
  if (args.to != null) episodes = episodes.filter((e) => e.seriesIndex <= args.to);

  const outDir = join(ROOT, "data", "trivia");
  await mkdir(outDir, { recursive: true });

  /** @type {Record<string, any[]>} */
  const bySeason = {};
  let done = 0;
  for (const ep of episodes) {
    const html = await fetchScript(ep.scriptUrl);
    const scriptText = htmlToText(html);
    const rng = mulberry32((ep.seriesIndex | 0) * 100003 + 977);
    const questions = buildQuestions(ep, pack.episodes, scriptText, rng);
    const bundle = {
      seriesIndex: ep.seriesIndex,
      season: ep.season,
      title: ep.title,
      airDate: ep.airDate,
      primarySource: ep.scriptUrl,
      indexSource: pack.source,
      generatedAt: new Date().toISOString(),
      questions,
    };
    const key = String(ep.season);
    if (!bySeason[key]) bySeason[key] = [];
    bySeason[key].push(bundle);
    done++;
    process.stdout.write(`\rGenerated ${done}/${episodes.length}  `);
    await sleep(Math.max(0, args.delay | 0));
  }

  for (const [season, list] of Object.entries(bySeason)) {
    const path = join(outDir, `season-${season.padStart(2, "0")}.json`);
    list.sort((a, b) => a.seriesIndex - b.seriesIndex);
    await writeFile(path, JSON.stringify(list, null, 2), "utf8");
  }

  const allPath = join(outDir, "all-episodes.json");
  const all = Object.values(bySeason)
    .flat()
    .sort((a, b) => a.seriesIndex - b.seriesIndex);
  await writeFile(allPath, JSON.stringify(all, null, 2), "utf8");

  console.log(`\nWrote season files + ${allPath} (${all.length} episodes).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
