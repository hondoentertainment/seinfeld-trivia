import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { PwaUpdateBar } from "./components/PwaUpdateBar";
import { AboutScreen } from "./screens/AboutScreen";
import { TrustScreen } from "./screens/TrustScreen";
import type { EpisodeBundle, GameScreen, QuizItem, QuizRunConfig } from "./types";
import { CATEGORY_GROUPS, readableTypeName } from "./lib/categories";
import { buildCorpusBreakdown, countQuestionsForTypes } from "./lib/corpusStats";
import { CORPUS_SUMMARY } from "./lib/corpusSummary";
import {
  getDailyPersonalBest,
  recordDailyPersonalBest,
  type DailyPersonalRow,
} from "./lib/localDailyBest";
import { buildQuestionReportBody, githubNewIssueUrl, mailtoFeedbackUrl } from "./lib/questionFeedback";
import { buildDailyResultShareUrl, parseDailyShareSearch, stripLaunchQueryParams, type DailySharePayload } from "./lib/shareLinks";
import { computeAnsweredTypeBreakdown } from "./lib/resultsBreakdown";
import { loadEpisodes } from "./loadTriviaCorpus";
import { marathonStyleUi, quizUiStrings } from "./quizLabels";
import { readQuestionsReviewed, writeQuestionsReviewed } from "./lib/questionsReviewedStorage";
import {
  dailyChallengeQuizItems,
  episodeQuizItems,
  marathonForSeason,
  marathonForTypes,
  marathonQuizItems,
  orderedFullCorpusRun,
  randomEpisode,
  shuffledFullCorpusRun,
} from "./shuffle";
import { SITE_CANONICAL } from "./siteConfig";

type QuizPhase = {
  run: QuizRunConfig;
  items: QuizItem[];
  index: number;
  answers: Record<number, { choice: number; correct: boolean }>;
  phase: "answer" | "reveal";
  lastPick: number | null;
  enteredFromBrowse: boolean;
};

function seasonTitle(s: number) {
  if (s === 0) return "Pilot";
  if (s === 10) return "Internet extras";
  return `Season ${s}`;
}

function NewTabAnnouncement() {
  return <span className="visually-hidden">opens in new tab</span>;
}

type ConfirmConfig = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
};

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive,
  onConfirm,
  onCancel,
}: ConfirmConfig & { onCancel: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const focusables = [
      ...el.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ];
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    window.queueMicrotask(() => first?.focus());

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancelRef.current();
        return;
      }
      if (e.key !== "Tab" || focusables.length === 0) return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onCancel}>
      <div
        ref={rootRef}
        className="dialog-panel"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId}>{title}</h2>
        <p id={descId}>{message}</p>
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost-light" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={destructive ? "btn btn-red" : "btn btn-teal"}
            onClick={() => onConfirm()}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const listener = () => setReduced(mq.matches);
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);
  return reduced;
}

function utcCalendarKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

const DAILY_COUNT = 15;

function documentTitleForScreen(screen: GameScreen, inQuiz: boolean): string {
  const base = "Yada yada trivia";
  if (inQuiz) return `Quiz · ${base}`;
  switch (screen.name) {
    case "home":
      return `${base} · Seinfeld quiz`;
    case "about":
      return `About · ${base}`;
    case "trust":
      return `Trust & sources · ${base}`;
    case "browse":
      return `Episode catalog · ${base}`;
    case "stats":
      return `Corpus atlas · ${base}`;
    case "quiz":
      return `Quiz · ${base}`;
    case "results":
      return `Results · ${base}`;
    default:
      return base;
  }
}

export function App() {
  const [screen, setScreen] = useState<GameScreen>({ name: "home" });
  const [quiz, setQuiz] = useState<QuizPhase | null>(null);
  const [browseSearch, setBrowseSearch] = useState("");
  const [questionsReviewed, setQuestionsReviewed] = useState(() => readQuestionsReviewed());
  const [notice, setNotice] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmConfig | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const closeConfirm = useCallback(() => setConfirm(null), []);

  /** Bumps whenever a quiz is started so reveal-bump keys stay unique per run. */
  const quizRunNonceRef = useRef(0);
  /** Prevents double-counting when React invokes state updaters more than once. */
  const lastRevealBumpKeyRef = useRef<string | null>(null);

  const [episodes, setEpisodes] = useState<EpisodeBundle[] | null>(null);
  const [isCorpusLoading, setIsCorpusLoading] = useState(false);
  const [corpusLoadError, setCorpusLoadError] = useState<string | null>(null);
  const [sharedDailyScore, setSharedDailyScore] = useState<DailySharePayload | null>(null);

  const ensureEpisodes = useCallback(async () => {
    if (episodes) return episodes;
    setCorpusLoadError(null);
    setIsCorpusLoading(true);
    try {
      const data = await loadEpisodes();
      setEpisodes(data);
      return data;
    } catch {
      setCorpusLoadError(
        "We couldn’t load the trivia archive. Check your connection and refresh the page.",
      );
      return null;
    } finally {
      setIsCorpusLoading(false);
    }
  }, [episodes]);

  useEffect(() => {
    if (screen.name === "browse" || screen.name === "stats" || screen.name === "about" || screen.name === "trust") {
      void ensureEpisodes();
    }
  }, [screen.name, ensureEpisodes]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const parsed = parseDailyShareSearch(window.location.search);
    if (parsed) setSharedDailyScore(parsed);
    const navScreen = params.get("screen");
    if (navScreen === "about") setScreen({ name: "about" });
    else if (navScreen === "trust") setScreen({ name: "trust" });
  }, []);

  useEffect(() => {
    const inQuiz = screen.name === "quiz" && quiz !== null;
    document.title = documentTitleForScreen(screen, inQuiz);
  }, [screen, quiz]);

  useEffect(() => {
    setNotice(null);
  }, [screen.name]);

  useEffect(() => {
    if (prefersReducedMotion) {
      window.scrollTo({ top: 0 });
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [screen.name, prefersReducedMotion]);

  const bySeason = useMemo(() => {
    if (!episodes) return [] as [number, EpisodeBundle[]][];
    const map = new Map<number, EpisodeBundle[]>();
    for (const ep of episodes) {
      const s = ep.season;
      if (!map.has(s)) map.set(s, []);
      map.get(s)!.push(ep);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.seriesIndex - b.seriesIndex);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [episodes]);

  const filteredBySeasonBrowse = useMemo(() => {
    const q = browseSearch.trim().toLowerCase();
    if (!q) return bySeason;
    return bySeason
      .map(
        ([season, eps]) =>
          [
            season,
            eps.filter(
              (e) =>
                e.title.toLowerCase().includes(q) ||
                String(e.seriesIndex).includes(q.replace(/^#/, "")),
            ),
          ] as [number, EpisodeBundle[]],
      )
      .filter(([, eps]) => eps.length > 0);
  }, [bySeason, browseSearch]);

  const goHome = useCallback(() => {
    setBrowseSearch("");
    setQuiz(null);
    setSharedDailyScore(null);
    stripLaunchQueryParams();
    setScreen({ name: "home" });
  }, []);

  const goAbout = useCallback(() => {
    setQuiz(null);
    setScreen({ name: "about" });
  }, []);

  const goTrust = useCallback(() => {
    setQuiz(null);
    setScreen({ name: "trust" });
  }, []);

  const goBrowse = useCallback(() => {
    setQuiz(null);
    setScreen({ name: "browse" });
  }, []);

  const goStats = useCallback(() => {
    setQuiz(null);
    setScreen({ name: "stats" });
  }, []);

  const corpus = useMemo(() => (episodes ? buildCorpusBreakdown(episodes) : CORPUS_SUMMARY), [episodes]);

  const coverageGaps = useMemo(() => {
    if (!corpus) return [];
    const covered = new Set(CATEGORY_GROUPS.flatMap((g) => [...g.types]));
    return corpus.byType.filter((row) => !covered.has(row.type));
  }, [corpus]);

  const startQuiz = useCallback(
    (items: QuizItem[], run: QuizRunConfig, enteredFromBrowse: boolean) => {
      if (items.length === 0) {
        setNotice("No questions matched that setup—pick another arc.");
        return;
      }
      quizRunNonceRef.current += 1;
      setQuiz({
        run,
        items,
        index: 0,
        answers: {},
        phase: "answer",
        lastPick: null,
        enteredFromBrowse,
      });
      setScreen({ name: "quiz", items, run, enteredFromBrowse });
    },
    [],
  );

  const replayFromConfig = useCallback(
    async (run: QuizRunConfig, itemsRef: QuizItem[], enteredFromBrowse: boolean) => {
      const archive = await ensureEpisodes();
      if (!archive) return;
      switch (run.mode) {
        case "episode": {
          const ep = itemsRef[0]?.episode;
          if (ep) startQuiz(episodeQuizItems(ep), { mode: "episode" }, enteredFromBrowse);
          break;
        }
        case "marathon_random":
          startQuiz(marathonQuizItems(archive, run.count, Math.random), run, false);
          break;
        case "daily":
          startQuiz(
            dailyChallengeQuizItems(archive, run.dateKeyUtc, run.count),
            run,
            false,
          );
          break;
        case "season":
          startQuiz(
            marathonForSeason(archive, run.season, run.count, Math.random),
            run,
            false,
          );
          break;
        case "categories":
          startQuiz(
            marathonForTypes(archive, run.questionTypes, run.count, Math.random),
            run,
            false,
          );
          break;
        case "full_corpus": {
          const items =
            run.order === "broadcast"
              ? orderedFullCorpusRun(archive)
              : shuffledFullCorpusRun(archive, Math.random);
          startQuiz(items, run, false);
          break;
        }
        case "miss_retry":
          startQuiz(itemsRef.slice(), run, enteredFromBrowse);
          break;
      }
    },
    [ensureEpisodes, startQuiz],
  );

  const startRandomEpisode = async () => {
    const archive = await ensureEpisodes();
    if (!archive) return;
    const ep = randomEpisode(archive, Math.random);
    startQuiz(episodeQuizItems(ep), { mode: "episode" }, false);
  };

  const startMarathonSized = async (count: number) => {
    const archive = await ensureEpisodes();
    if (!archive) return;
    startQuiz(marathonQuizItems(archive, count, Math.random), { mode: "marathon_random", count }, false);
  };

  const startDaily = async () => {
    setSharedDailyScore(null);
    stripLaunchQueryParams();
    const archive = await ensureEpisodes();
    if (!archive) return;
    const key = utcCalendarKey();
    startQuiz(dailyChallengeQuizItems(archive, key, DAILY_COUNT), { mode: "daily", dateKeyUtc: key, count: DAILY_COUNT }, false);
  };

  const startDailyForDate = async (dateKeyUtc: string) => {
    setSharedDailyScore(null);
    stripLaunchQueryParams();
    const archive = await ensureEpisodes();
    if (!archive) return;
    startQuiz(
      dailyChallengeQuizItems(archive, dateKeyUtc, DAILY_COUNT),
      { mode: "daily", dateKeyUtc, count: DAILY_COUNT },
      false,
    );
  };

  const startSeasonMix = async (season: number, request: number) => {
    const archive = await ensureEpisodes();
    if (!archive) return;
    const cap = corpus.bySeason.find((x) => x.seasonIndex === season)?.questions ?? 0;
    const count = Math.max(1, Math.min(request, cap));
    startQuiz(marathonForSeason(archive, season, count, Math.random), { mode: "season", season, count }, false);
  };

  const startCategoryMix = async (
    cat: (typeof CATEGORY_GROUPS)[number],
    request: number,
  ) => {
    const archive = await ensureEpisodes();
    if (!archive) return;
    const cap = countQuestionsForTypes(corpus, cat.types);
    const count = Math.max(1, Math.min(request, cap));
    startQuiz(marathonForTypes(archive, [...cat.types], count, Math.random), {
      mode: "categories",
      categoryLabel: cat.label,
      categoryId: cat.id,
      questionTypes: [...cat.types],
      count,
    }, false);
  };

  const startSingleTypeLens = async (typeKey: string, request: number) => {
    const archive = await ensureEpisodes();
    if (!archive) return;
    const cap = corpus.byType.find((r) => r.type === typeKey)?.count ?? 0;
    const count = Math.max(1, Math.min(request, cap));
    startQuiz(marathonForTypes(archive, [typeKey], count, Math.random), {
      mode: "categories",
      categoryLabel: readableTypeName(typeKey),
      categoryId: typeKey,
      questionTypes: [typeKey],
      count,
    }, false);
  };

  const startFullCorpus = async (order: "broadcast" | "shuffled") => {
    const archive = await ensureEpisodes();
    if (!archive) return;
    const pool =
      order === "broadcast" ? orderedFullCorpusRun(archive) : shuffledFullCorpusRun(archive, Math.random);
    const cfg: QuizRunConfig = {
      mode: "full_corpus",
      poolSize: pool.length,
      order,
    };
    if (pool.length <= 250) {
      startQuiz(pool, cfg, false);
      return;
    }
    setConfirm({
      title: "Start the full archive run?",
      message: `This run includes all ${pool.length.toLocaleString()} script-derived prompts and can take multiple hours split across breaks.`,
      cancelLabel: "Not now",
      confirmLabel: "Start marathon",
      destructive: false,
      onConfirm: () => {
        setConfirm(null);
        startQuiz(pool, cfg, false);
      },
    });
  };

  const currentItem = quiz ? (quiz.items[quiz.index] ?? null) : null;

  const advanceReveal = useCallback(() => {
    setQuiz((q) => {
      if (!q || q.phase !== "reveal") return q;
      const bumpKey = `${quizRunNonceRef.current}:${q.index}`;
      if (lastRevealBumpKeyRef.current !== bumpKey) {
        lastRevealBumpKeyRef.current = bumpKey;
        const nextLifetime = readQuestionsReviewed() + 1;
        writeQuestionsReviewed(nextLifetime);
        queueMicrotask(() => setQuestionsReviewed(nextLifetime));
      }
      if (q.index + 1 >= q.items.length) {
        const items = q.items;
        const answers = q.answers;
        const run = q.run;
        const enteredFromBrowse = q.enteredFromBrowse;
        setScreen({ name: "results", items, answers, run, enteredFromBrowse });
        return null;
      }
      return {
        ...q,
        index: q.index + 1,
        phase: "answer",
        lastPick: null,
      };
    });
  }, []);

  /** Auto-advance after reveal unless user prefers reduced motion (manual continue only). */
  useEffect(() => {
    if (!quiz || quiz.phase !== "reveal") return undefined;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return undefined;
    const t = window.setTimeout(advanceReveal, 980);
    return () => window.clearTimeout(t);
  }, [quiz, quiz?.index, quiz?.phase, advanceReveal]);

  const onPickAnswer = useCallback((choice: number) => {
    setQuiz((q) => {
      if (!q || q.phase !== "answer") return q;
      const item = q.items[q.index];
      if (!item) return q;
      const correct = choice === item.question.correctIndex;
      const nextAnswers = {
        ...q.answers,
        [q.index]: { choice, correct },
      };
      return {
        ...q,
        answers: nextAnswers,
        phase: "reveal",
        lastPick: choice,
      };
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (confirm) return;
      if (!quiz) return;
      if (quiz.phase === "answer") {
        const keys = ["1", "2", "3", "4"];
        const ix = keys.indexOf(e.key);
        if (ix === -1) return;
        e.preventDefault();
        const opts = quiz.items[quiz.index]?.question.options;
        if (!opts || ix >= opts.length) return;
        onPickAnswer(ix);
        return;
      }
      if (quiz.phase === "reveal" && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        advanceReveal();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [quiz, confirm, onPickAnswer, advanceReveal]);

  const quitQuiz = useCallback(() => {
    if (!quiz) return;
    const hasProgress = quiz.index > 0 || Object.keys(quiz.answers).length > 0;
    if (hasProgress) {
      setConfirm({
        title: "End this quiz?",
        message: "Your progress on this run will be lost. This cannot be undone.",
        confirmLabel: "End quiz",
        cancelLabel: "Keep playing",
        destructive: true,
        onConfirm: () => {
          setConfirm(null);
          goHome();
        },
      });
      return;
    }
    goHome();
  }, [quiz, goHome]);

  const progressValue = quiz
    ? Math.min(quiz.index + 1, quiz.items.length)
    : 0;
  const progressMax = quiz?.items.length ?? 1;

  const quizUi = quiz ? quizUiStrings(quiz.run) : null;

  if (corpusLoadError) {
    return (
      <div className="app-shell">
        <PwaUpdateBar />
        <main className="stack" style={{ padding: "1.5rem" }}>
          <div className="card" role="alert">
            <h2 className="card-heading">Could not load archive</h2>
            <p className="card-muted">{corpusLoadError}</p>
            <button type="button" className="btn btn-teal" onClick={() => window.location.reload()}>
              Try again
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <PwaUpdateBar />
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <header className="brand-lockup" role="banner">
        <h1>Yada yada trivia</h1>
        <p className="tagline">
          Among the deepest open homages wired straight from transcript sources—
          <strong> {corpus.questionCount}</strong> question-level prompts across{" "}
          <strong>{corpus.episodeCount}</strong> episodes. Episode grinds, synchronized dailies, season silos, trivia-type laboratories,
          mega-mixes, and exhaustive archive marathons in one offline-friendly site.
        </p>
        <div className="pill-strip" aria-hidden>
          <span className="pill">{corpus.episodeCount}&nbsp;episode mirror</span>
          <span className="pill">{corpus.questionCount}&nbsp;prompt matrix</span>
          <span className="pill">
            {CATEGORY_GROUPS.length + 4} challenge modes
          </span>
        </div>
        <nav className="site-nav" aria-label="Site sections">
          <button type="button" className="btn btn-ghost-light site-nav-btn" onClick={goAbout}>
            About
          </button>
          <button type="button" className="btn btn-ghost-light site-nav-btn" onClick={goTrust}>
            Trust &amp; sources
          </button>
          <button type="button" className="btn btn-ghost-light site-nav-btn" onClick={() => void startDaily()}>
            Daily challenge
          </button>
        </nav>
      </header>

      <main id="main-content" tabIndex={-1}>
        {notice ? (
          <div role="alert" className="app-notice">
            <p>{notice}</p>
            <button
              type="button"
              className="app-notice-dismiss"
              onClick={() => setNotice(null)}
              aria-label="Dismiss notice"
            >
              Dismiss
            </button>
          </div>
        ) : null}

      {screen.name === "home" && (
        <div className="stack">
          {sharedDailyScore ? (
            <div className="card share-landing-card" role="region" aria-label="Shared daily score">
              <h2 className="card-heading" style={{ marginTop: 0 }}>
                Someone shared a daily score
              </h2>
              <p className="card-muted">
                <strong>
                  {sharedDailyScore.correct}/{sharedDailyScore.total}
                </strong>{" "}
                on UTC date <code className="inline-code">{sharedDailyScore.dateKeyUtc}</code> — same seeded deck everyone played that day.
              </p>
              <div className="row-between" style={{ flexWrap: "wrap", gap: "0.5rem", marginTop: "0.75rem" }}>
                <button
                  type="button"
                  className="btn btn-teal"
                  onClick={() => void startDailyForDate(sharedDailyScore.dateKeyUtc)}
                  disabled={isCorpusLoading}
                >
                  Play that day&apos;s puzzle
                </button>
                <button type="button" className="btn btn-ghost-light" onClick={() => void startDaily()} disabled={isCorpusLoading}>
                  Today&apos;s UTC daily instead
                </button>
                <button
                  type="button"
                  className="btn btn-ghost-light"
                  onClick={() => {
                    setSharedDailyScore(null);
                    stripLaunchQueryParams();
                  }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ) : null}

          <div className="card">
            <p className="card-muted" style={{ marginTop: 0 }}>
              Every multiple-choice node is generated from the verbatim script index at{" "}
              <a
                href="http://www.seinfeldscripts.com/seinfeld-scripts.html"
                target="_blank"
                rel="noopener noreferrer"
              >
                SeinfeldScripts.com
                <NewTabAnnouncement />
              </a>{" "}
              (dialogue fingerprints, headings, structured metadata). Nothing here streams video or audio—we are purely a forensic
              text playground for superfans chasing <em>everything</em> about the canon.
            </p>
            <div className="row-between atlas-row">
              <h2 className="card-heading">Corpus intelligence</h2>
              <div className="row-between" style={{ gap: "0.35rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-ghost-light" onClick={goTrust}>
                  Trust
                </button>
                <button type="button" className="btn btn-ghost-light" onClick={goStats}>
                  Open atlas
                </button>
              </div>
            </div>
            <p className="card-muted corpus-footnote">
              Explore per-season densities, trivia archetypes, and how the dataset breaks down across {corpus.distinctTypes.length}{" "}
              distinct classifier tags.
            </p>
          </div>

          <div className="card">
            <h2 className="card-heading">Fast paths · fan-favorite drills</h2>
            <p className="card-muted" style={{ marginTop: "0.35rem" }}>
              One tap into the densest practice lanes—dialogue sleuths, episode craft, and metatext chronology.
            </p>
            <div className="fast-path-grid" style={{ marginTop: "0.75rem" }}>
              <button
                type="button"
                className="btn btn-teal btn-block"
                disabled={isCorpusLoading}
                onClick={() => void startCategoryMix(CATEGORY_GROUPS[0]!, 25)}
              >
                Dialogue · 25 cards
              </button>
              <button
                type="button"
                className="btn btn-ghost-light btn-block"
                disabled={isCorpusLoading}
                onClick={() => void startCategoryMix(CATEGORY_GROUPS[1]!, 25)}
              >
                Episode craft · 25 cards
              </button>
              <button
                type="button"
                className="btn btn-ghost-light btn-block"
                disabled={isCorpusLoading}
                onClick={() => void startCategoryMix(CATEGORY_GROUPS[4]!, 25)}
              >
                Lore &amp; chronology · 25 cards
              </button>
            </div>
          </div>

          <div className="card">
            <h2 className="card-heading">Daily hive-mind puzzle</h2>
            <p className="card-muted" style={{ marginTop: "0.35rem" }}>
              UTC date <code className="inline-code">{utcCalendarKey()}</code> locks everyone into the exact same {DAILY_COUNT}-prompt slate.
              Bragging rights unlocked.
            </p>
            <button type="button" className="btn btn-teal btn-block" onClick={() => void startDaily()} disabled={isCorpusLoading}>
              {isCorpusLoading ? "Loading archive…" : `Play today's seeded challenge (${DAILY_COUNT} questions)`}
            </button>
          </div>

          <div className="card">
            <h2 className="card-heading">Classic episode arcs</h2>
            <div className="stack" style={{ marginTop: "0.65rem" }}>
              <button type="button" className="btn btn-teal btn-block" onClick={() => void startRandomEpisode()} disabled={isCorpusLoading}>
                Random installment · full 25-question screenplay pass
              </button>
              <button type="button" className="btn btn-ghost-light btn-block" onClick={goBrowse}>
                Searchable catalogue (title + production order)
              </button>
            </div>
          </div>

          <div className="card">
            <h2 className="card-heading">Season silos · hyper-focused grinds</h2>
            <p className="card-muted" style={{ marginTop: "0.35rem" }}>
              Mash up only prompts tied to pilot/special arcs or any CBS/Fox-era season buckets—ideal for rewatches syncing with your
              current binge tracker.
            </p>
            <div className="season-grid">
              {corpus.bySeason.map(({ seasonIndex, episodes: epCt, questions: pq }) => {
                const playable = Math.min(25, pq);
                const disabled = pq === 0;
                return (
                  <button
                    key={seasonIndex}
                    type="button"
                    className="btn btn-ghost-light season-chip"
                    disabled={disabled}
                    onClick={() => void startSeasonMix(seasonIndex, 25)}
                    title={`${pq.toLocaleString()} prompts in bucket`}
                  >
                    <span>{seasonTitle(seasonIndex)}</span>
                    <small>
                      {epCt} episodes · {pq.toLocaleString()} prompts
                      {!disabled ? ` · samples ${playable} per hit` : null}
                    </small>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="card">
            <h2 className="card-heading">Archetype laboratories</h2>
            <p className="card-muted" style={{ marginTop: "0.35rem" }}>
              Dialogue sleuths versus writers-room receipts versus meta chronology—all powered by granular type tags surfaced in the
              generator.
            </p>
            <div className="category-list">
              {CATEGORY_GROUPS.map((cat) => {
                const cap = countQuestionsForTypes(corpus, cat.types);
                const disabled = cap === 0;
                const focus25 = Math.min(25, cap);
                const deep = Math.min(60, cap);
                return (
                  <div key={cat.id} className="category-row">
                    <div>
                      <div className="category-title">{cat.label}</div>
                      <div className="category-sub">{cat.subtitle}</div>
                      <div className="category-cap">{cap.toLocaleString()} prompts indexed</div>
                    </div>
                    <div className="category-actions">
                      <button
                        type="button"
                        className="btn btn-ghost-light"
                        disabled={disabled || cap < 15}
                        onClick={() => void startCategoryMix(cat, Math.min(15, cap))}
                      >
                        15 sprint
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost-light"
                        disabled={disabled}
                        onClick={() => void startCategoryMix(cat, focus25)}
                      >
                        {focus25}-deep
                      </button>
                      {deep > focus25 ? (
                        <button
                          type="button"
                          className="btn btn-ghost-light"
                          disabled={disabled}
                          onClick={() => void startCategoryMix(cat, deep)}
                        >
                          {deep}-obsessed
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {coverageGaps.length > 0 ? (
            <div className="card">
              <h2 className="card-heading">Residual classifier tags</h2>
              <p className="card-muted" style={{ marginTop: "0.35rem" }}>
                Every prompt type is enumerated here—even the long tail that didn&apos;t fit a themed bucket yet—so obsessive
                completists can still drill the entire taxonomy.
              </p>
              <div className="residual-tags">
                {coverageGaps.map((row) => {
                  const cap = row.count;
                  const playable = Math.min(25, cap);
                  const disabled = cap === 0;
                  return (
                    <button
                      key={row.type}
                      type="button"
                      className="btn btn-ghost-light residual-chip"
                      disabled={disabled}
                      onClick={() => void startSingleTypeLens(row.type, playable)}
                      title={`${cap.toLocaleString()} prompts`}
                    >
                      <span>{readableTypeName(row.type)}</span>
                      <small>{cap.toLocaleString()} indexed</small>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="card">
            <h2 className="card-heading">Total chaos mega-mixes</h2>
            <p className="card-muted" style={{ marginTop: "0.35rem" }}>
              Completely randomized pulls from the continental question pool—or flex with the entire corpus twice (ordered vs reshuffled).
            </p>
            <div className="marathon-actions">
              {[10, 25, 50, 100].map((n) => (
                <button key={n} type="button" className="btn btn-red btn-block" onClick={() => void startMarathonSized(n)}>
                  {n} random prompts
                </button>
              ))}
            </div>
            <div className="stack full-corpus-row">
              <button type="button" className="btn btn-teal btn-block" onClick={() => void startFullCorpus("broadcast")}>
                Canon order · entire matrix ({corpus.questionCount.toLocaleString()} prompts)
              </button>
              <button type="button" className="btn btn-ghost-light btn-block" onClick={() => void startFullCorpus("shuffled")}>
                Shuffle literally everything fresh
              </button>
            </div>
          </div>
        </div>
      )}

      {screen.name === "about" && (
        <AboutScreen onHome={goHome} onTrust={goTrust} onDaily={() => void startDaily()} />
      )}

      {screen.name === "trust" && <TrustScreen onHome={goHome} onAbout={goAbout} />}

      {screen.name === "browse" && (
        <div className="stack">
          <div className="card">
            <div className="row-between">
              <h2 className="card-heading">Select an episode</h2>
              <nav aria-label="Catalog" className="row-between" style={{ gap: "0.5rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-ghost-light" onClick={goStats}>
                  Atlas
                </button>
                <button type="button" className="btn btn-ghost-light" onClick={goHome}>
                  Home
                </button>
              </nav>
            </div>
            <label className="browse-search-label">
              <span className="visually-hidden">Filter episodes</span>
              <input
                type="search"
                className="browse-search-field"
                placeholder="Filter by episode title or series number…"
                value={browseSearch}
                onChange={(e) => setBrowseSearch(e.target.value)}
                autoComplete="off"
              />
            </label>
          </div>
          {isCorpusLoading && !episodes ? (
            <output className="card corpus-loading-status" aria-live="polite">
              <span className="loading-wordmark">Loading episode catalogue</span>
              <p className="card-muted">Fetching the full trivia archive…</p>
            </output>
          ) : null}
          <div className="card stack">
            {!episodes ? (
              <p className="card-muted">The episode catalogue will appear as soon as the archive is ready.</p>
            ) : filteredBySeasonBrowse.length === 0 ? (
              <p className="card-muted">No episodes match “{browseSearch.trim()}”—try loosening your filter.</p>
            ) : (
              filteredBySeasonBrowse.map(([season, seasonEps]) => (
              <details key={season} className="season-acc">
                <summary>
                  <span>{seasonTitle(season)}</span>
                  <span style={{ fontWeight: 600, opacity: 0.55 }}>
                    ({seasonEps.length}&nbsp;{seasonEps.length === 1 ? "episode" : "episodes"})
                  </span>
                </summary>
                {seasonEps.map((ep) => (
                  <button
                    key={ep.seriesIndex}
                    type="button"
                    className="ep-link"
                    onClick={() => startQuiz(episodeQuizItems(ep), { mode: "episode" }, true)}
                  >
                    {ep.title}{" "}
                    <span style={{ fontWeight: 500, color: "var(--ink-muted)" }}>(#{ep.seriesIndex})</span>
                  </button>
                ))}
              </details>
            ))
            )}
          </div>
        </div>
      )}

      {screen.name === "quiz" && currentItem && quiz && (
        <div className="stack">
          <div className="card">
            <h2 className="visually-hidden">Quiz in progress</h2>
            <div className="row-between">
              <button type="button" className="btn btn-ghost-light" onClick={quitQuiz}>
                Quit quiz
              </button>
              <span className="episode-meta quiz-progress-line">
                <span aria-live="polite" className="quiz-progress-live">
                  {quizUi ? `${quizUi.subtitle} · ` : null}
                  Question {quiz.index + 1} of {quiz.items.length}
                </span>
                <span className="reviewed-meta" aria-hidden title="Stored in this browser—each reveal you finish advances this count">
                  {" "}
                  · {questionsReviewed.toLocaleString()} reviewed
                </span>
              </span>
            </div>
            <div
              className="progress-bar-wrap"
              style={{ marginTop: "1rem" }}
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={progressMax}
              aria-valuenow={progressValue}
              aria-label="Quiz progress"
            >
              <div
                className="progress-fill"
                aria-hidden
                style={{
                  width: `${((quiz.index + (quiz.phase === "reveal" ? 0.92 : 0)) / quiz.items.length) * 100}%`,
                }}
              />
            </div>
            <div className="episode-meta" style={{ marginTop: "1rem" }}>
              {!marathonStyleUi(quiz.run) ? (
                <>
                  {seasonTitle(currentItem.episode.season)} · #{currentItem.episode.seriesIndex}{" "}
                  <span aria-hidden>·</span> {currentItem.episode.airDate}
                </>
              ) : (
                <>
                  Episode · {currentItem.episode.title}{" "}
                  <span style={{ fontWeight: 600, opacity: 0.6 }}>(#{currentItem.episode.seriesIndex})</span>
                </>
              )}
            </div>
            <div className="quiz-meta-tools">
              <a
                className="source-chip btn btn-ghost-light"
                href={currentItem.question.sourceUrl ?? currentItem.episode.primarySource}
                target="_blank"
                rel="noopener noreferrer"
              >
                {currentItem.question.sourceKind === "internet"
                  ? (currentItem.question.sourceLabel ?? "Internet source")
                  : "Episode transcript"}
                <NewTabAnnouncement />
              </a>
              <button
                type="button"
                className="btn btn-ghost-light"
                onClick={async () => {
                  const body = buildQuestionReportBody(currentItem);
                  const gh = githubNewIssueUrl("Trivia question QA", body);
                  if (gh) {
                    window.open(gh, "_blank", "noopener,noreferrer");
                    return;
                  }
                  const mail = mailtoFeedbackUrl("Seinfeld trivia QA", body);
                  if (mail) {
                    window.location.href = mail;
                    return;
                  }
                  try {
                    await navigator.clipboard.writeText(body);
                    setNotice("Issue details copied—paste them into email or your issue tracker.");
                  } catch {
                    setNotice("Could not copy automatically—open an issue and describe this prompt.");
                  }
                }}
              >
                Report / copy details
              </button>
            </div>
            <details className="keyboard-cheatsheet card-muted">
              <summary>Keyboard shortcuts</summary>
              <ul className="keyboard-cheatsheet-list">
                <li>
                  <kbd className="key-hint">1</kbd>–<kbd className="key-hint">4</kbd> Select an answer (on the reveal step they are inactive).
                </li>
                <li>
                  <kbd className="key-hint">Enter</kbd> or <kbd className="key-hint">Space</kbd> Advance after the reveal.
                </li>
              </ul>
            </details>
            <p className="question-type-chip" aria-label="Prompt archetype">
              {readableTypeName(currentItem.question.type)}
            </p>
            <p className="question-text">{currentItem.question.question}</p>
            <p id="quiz-keyboard-help" className="visually-hidden">
              Use number keys 1 through 4 to choose an answer. After each reveal, press Enter or Space to continue to the next
              question.
            </p>
            <div className="answer-grid" aria-describedby="quiz-keyboard-help">
              {currentItem.question.options.map((opt: string, i: number) => {
                let stateAttr: string | undefined;
                const isCorrect = i === currentItem.question.correctIndex;
                if (quiz.phase === "reveal") {
                  if (isCorrect) stateAttr = "revealed-correct";
                  else if (quiz.lastPick === i && !isCorrect) stateAttr = "picked-wrong";
                }
                const letter = ["A", "B", "C", "D"][i] ?? "?";
                return (
                  <button
                    key={i}
                    type="button"
                    className={`btn btn-ghost-light btn-block answer-choice`}
                    data-state={stateAttr}
                    disabled={quiz.phase === "reveal"}
                    onClick={() => onPickAnswer(i)}
                  >
                    <span style={{ opacity: 0.55 }}>{letter}.</span> {opt}{" "}
                    <kbd className="key-hint" aria-hidden>
                      {i + 1}
                    </kbd>
                  </button>
                );
              })}
            </div>
            {quiz.phase === "reveal" && (
              <div className="reveal-actions">
                <button type="button" className="btn btn-teal btn-block" onClick={advanceReveal}>
                  {quiz.index + 1 >= quiz.items.length ? "See results" : "Next question"}
                </button>
                <p className="card-muted reveal-hint" aria-hidden>
                  {prefersReducedMotion
                    ? "Press Enter or Space to continue."
                    : "Continuing automatically in a moment—or tap the button below."}
                </p>
              </div>
            )}
          </div>
          <span className="visually-hidden" aria-live="assertive">
            {quiz.phase === "reveal" && quiz.lastPick !== null ? (
              quiz.lastPick === currentItem.question.correctIndex ? "Correct." : "Incorrect."
            ) : (
              ""
            )}
          </span>
        </div>
      )}

      {screen.name === "stats" && (
        <div className="stack">
          <div className="card">
            <div className="row-between">
              <h2 className="card-heading">Corpus atlas · raw coverage</h2>
              <nav aria-label="Atlas">
                <button type="button" className="btn btn-ghost-light" onClick={goHome}>
                  Home
                </button>
              </nav>
            </div>
            <p className="card-muted" style={{ marginTop: "0.65rem", marginBottom: "1rem" }}>
              Transparent counts pulled straight from bundled JSON—no inflated marketing math. Tap any mode on the homepage to grind a
              specific wedge of this histogram.
            </p>
            <dl className="mega-stats-grid">
              <div>
                <dt>Episode transcripts mirrored</dt>
                <dd>{corpus.episodeCount}</dd>
              </div>
              <div>
                <dt>Distinct prompt nodes</dt>
                <dd>{corpus.questionCount.toLocaleString()}</dd>
              </div>
              <div>
                <dt>Classifier archetypes</dt>
                <dd>{corpus.distinctTypes.length}</dd>
              </div>
              <div>
                <dt>Lifetime prompts you&apos;ve reviewed</dt>
                <dd>{questionsReviewed.toLocaleString()}</dd>
              </div>
            </dl>
          </div>
          <div className="card">
            <h2 className="card-heading">Per-season density</h2>
            <div className="table-wrap" style={{ marginTop: "0.75rem" }}>
              <table className="data-sheet">
                <caption className="visually-hidden">Episodes and question counts for each season</caption>
                <thead>
                  <tr>
                    <th scope="col">Season</th>
                    <th scope="col">Episodes</th>
                    <th scope="col">Prompts</th>
                  </tr>
                </thead>
                <tbody>
                  {corpus.bySeason.map((row) => (
                    <tr key={row.seasonIndex}>
                      <td>{seasonTitle(row.seasonIndex)}</td>
                      <td>{row.episodes}</td>
                      <td>{row.questions.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card">
            <h2 className="card-heading">Classifier inventory</h2>
            <p className="card-muted" style={{ marginTop: "0.35rem" }}>
              Every label is emitted by the trivia generator so you can steer practice toward exactly the kind of screenplay signal you
              care about.
            </p>
            <div className="table-wrap" style={{ marginTop: "0.75rem" }}>
              <table className="data-sheet">
                <caption className="visually-hidden">Question counts for each trivia classifier type</caption>
                <thead>
                  <tr>
                    <th scope="col">Type</th>
                    <th scope="col">Prompts</th>
                  </tr>
                </thead>
                <tbody>
                  {corpus.byType.map((row) => (
                    <tr key={row.type}>
                      <td>{readableTypeName(row.type)}</td>
                      <td>{row.count.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {screen.name === "results" && (
        <ResultsPane
          items={screen.items}
          answers={screen.answers}
          run={screen.run}
          resultsTitle={quizUiStrings(screen.run).resultsTitle}
          replayHint={quizUiStrings(screen.run).replayHint}
          enteredFromBrowse={screen.enteredFromBrowse}
          onHome={goHome}
          onBrowse={goBrowse}
          onReplay={() =>
            replayFromConfig(screen.run, screen.items, screen.enteredFromBrowse)
          }
          onRetryMisses={() => {
            const missItems = screen.items.filter((_, i) => {
              const a = screen.answers[i];
              return !!(a && !a.correct);
            });
            if (missItems.length === 0) return;
            startQuiz(
              missItems,
              {
                mode: "miss_retry",
                count: missItems.length,
                sourceSummary: quizUiStrings(screen.run).resultsTitle,
              },
              screen.enteredFromBrowse,
            );
          }}
          onToast={setNotice}
        />
      )}

      </main>

      <footer className="site-footer">
        <p style={{ margin: 0 }}>
          Scripts & episode index credited to SeinfeldScripts.com fan transcripts. Questions are algorithmically derived and may include
          imperfect parsing—consult the script link on each bundle if something feels off.
        </p>
        <p style={{ margin: "0.5rem 0 0" }}>
          <button type="button" className="footer-inline-btn" onClick={goAbout}>
            About
          </button>
          {" · "}
          <button type="button" className="footer-inline-btn" onClick={goTrust}>
            Trust &amp; sources
          </button>
          {" · "}
          <a href="/sitemap.xml" className="footer-inline-link">
            Sitemap
          </a>
        </p>
      </footer>
      {confirm ? <ConfirmDialog {...confirm} onCancel={closeConfirm} /> : null}
    </div>
  );
}

function ResultsPane({
  items,
  answers,
  run,
  resultsTitle,
  replayHint,
  enteredFromBrowse,
  onHome,
  onBrowse,
  onReplay,
  onRetryMisses,
  onToast,
}: {
  items: QuizItem[];
  answers: Record<number, { choice: number; correct: boolean }>;
  run: QuizRunConfig;
  resultsTitle: string;
  replayHint: string;
  enteredFromBrowse: boolean;
  onHome: () => void;
  onBrowse: () => void;
  onReplay: () => void;
  onRetryMisses: () => void;
  onToast: (message: string) => void;
}) {
  let correctCt = 0;
  let wrongCt = 0;
  let skipped = items.length;

  items.forEach((_, i) => {
    const a = answers[i];
    if (!a) return;
    skipped -= 1;
    if (a.correct) correctCt++;
    else wrongCt++;
  });

  skipped = items.length - correctCt - wrongCt;

  const hasMisses = items.some((_, i) => answers[i] && !answers[i]?.correct);
  const accuracyPct = items.length > 0 ? Math.round((correctCt / items.length) * 1000) / 10 : 0;

  const typeRows = useMemo(() => computeAnsweredTypeBreakdown(items, answers), [items, answers]);

  const [dailySnapshot, setDailySnapshot] = useState<DailyPersonalRow | null>(null);
  useEffect(() => {
    if (run.mode !== "daily") return;
    recordDailyPersonalBest(run.dateKeyUtc, correctCt, items.length);
    setDailySnapshot(getDailyPersonalBest(run.dateKeyUtc));
  }, [run, correctCt, items.length]);

  useEffect(() => {
    if (run.mode !== "daily") return;
    const u = new URL(window.location.href);
    u.searchParams.set("d", run.dateKeyUtc);
    u.searchParams.set("s", String(correctCt));
    u.searchParams.set("t", String(items.length));
    window.history.replaceState({}, "", u.toString());
  }, [run, correctCt, items.length]);

  const shareUrl =
    run.mode === "daily"
      ? buildDailyResultShareUrl({
          dateKeyUtc: run.dateKeyUtc,
          correct: correctCt,
          total: items.length,
        })
      : SITE_CANONICAL;

  const shareLine =
    run.mode === "daily"
      ? `${correctCt}/${items.length} on the Yada yada daily (${run.dateKeyUtc} UTC). Same deck: ${shareUrl}`
      : `${SITE_CANONICAL} · ${quizUiStrings(run).resultsTitle}: ${correctCt}/${items.length} (${accuracyPct}% answered correctly)`;

  const onShareScore = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Yada yada trivia",
          text: shareLine,
          url: shareUrl,
        });
      } catch (e) {
        if ((e as Error)?.name !== "AbortError") {
          onToast("Sharing was interrupted—score not sent.");
        }
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(shareLine);
      onToast("Score copied to clipboard.");
    } catch {
      onToast(`Copy manually: ${shareLine}`);
    }
  };

  const onCopyShareLinkOnly = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      onToast(run.mode === "daily" ? "Share link copied — paste it anywhere." : "Link copied.");
    } catch {
      onToast(`Copy manually: ${shareUrl}`);
    }
  };

  return (
    <div className="stack">
      <div className="card">
        <h2 className="episode-meta" style={{ margin: 0 }}>
          {resultsTitle}
        </h2>
        <p className="results-score">{correctCt}&nbsp;<span style={{ opacity: 0.45 }}>/</span> {items.length}</p>
        <p className="card-muted session-accuracy-meta">
          Accuracy {accuracyPct}% on answered cards
          {skipped ? ` (${skipped} not reached).` : "."}
        </p>
        <p className="card-muted">
          {wrongCt ? `${wrongCt} missed. ` : null}
          {skipped ? `${skipped} unanswered. ` : null}
          {correctCt === items.length ? "Master of your domain." : "Serenity now—try again sometime."}
        </p>

        {run.mode === "daily" && dailySnapshot ? (
          <p className="card-muted" role="status">
            Personal best on this device for {run.dateKeyUtc} UTC: {dailySnapshot.correct}/{dailySnapshot.total}
          </p>
        ) : null}

        <div className="row-between results-share-row">
          <div className="results-share-actions">
            <button type="button" className="btn btn-ghost-light" onClick={() => void onShareScore()}>
              Share score
            </button>
            <button type="button" className="btn btn-ghost-light" onClick={() => void onCopyShareLinkOnly()}>
              {run.mode === "daily" ? "Copy share link" : "Copy site link"}
            </button>
          </div>
          {hasMisses ? (
            <button type="button" className="btn btn-teal" onClick={onRetryMisses}>
              Drill misses only ({wrongCt})
            </button>
          ) : (
            <span className="card-muted" style={{ fontSize: "0.85rem" }}>
              Clean sweep—no misses to drill.
            </span>
          )}
        </div>

        {typeRows.length > 0 ? (
          <div className="session-breakdown" style={{ marginTop: "1.15rem" }}>
            <h3 className="episode-meta" id="session-type-heading">
              This run by archetype
            </h3>
            <div className="table-wrap" style={{ marginTop: "0.5rem" }}>
              <table className="data-sheet" aria-labelledby="session-type-heading">
                <thead>
                  <tr>
                    <th scope="col">Type</th>
                    <th scope="col">Asked</th>
                    <th scope="col">Right</th>
                    <th scope="col">%</th>
                  </tr>
                </thead>
                <tbody>
                  {typeRows.slice(0, 12).map((row) => (
                    <tr key={row.type}>
                      <td>{row.label}</td>
                      <td>{row.asked}</td>
                      <td>{row.correct}</td>
                      <td>{row.asked ? Math.round((row.correct / row.asked) * 100) : 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {run.mode === "episode" && items[0] && (
          <p style={{ marginBottom: "0.65rem", marginTop: "1rem", fontWeight: 600 }}>
            Episode:{" "}
            <a href={items[0].episode.primarySource} target="_blank" rel="noopener noreferrer">
              {items[0].episode.title}
              <NewTabAnnouncement />
            </a>
          </p>
        )}

        <div className="stack results-footer-actions">
          <div className="row-between">
            <button type="button" className="btn btn-ghost-light" onClick={onHome}>
              Home
            </button>
            <button type="button" className="btn btn-teal" onClick={onReplay}>
              {replayHint}
            </button>
          </div>
          {enteredFromBrowse && (
            <button type="button" className="btn btn-ghost-light btn-block" onClick={onBrowse}>
              Back to catalog
            </button>
          )}
        </div>

        {hasMisses && (
          <div style={{ marginTop: "1.25rem" }}>
            <p className="episode-meta" id="review-misses-heading">
              Review misses
            </p>
            <ul
              className="card-muted"
              style={{ paddingLeft: "1rem", margin: "0.5rem 0 0", fontWeight: 500 }}
              aria-labelledby="review-misses-heading"
            >
              {items.map((item, i) => {
                const rec = answers[i];
                if (!rec || rec.correct) return null;
                return (
                  <li key={`${item.episode.seriesIndex}-${i}-${item.question.id}`}>
                    → {item.question.question.slice(0, 120)}
                    … <strong>Answer:</strong> {item.question.options[item.question.correctIndex]}{" "}
                    <a
                      href={item.episode.primarySource}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="miss-source-link"
                    >
                      transcript
                      <NewTabAnnouncement />
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
