import { useCallback, useEffect, useMemo, useState } from "react";
import type { EpisodeBundle, GameScreen, QuizItem, QuizRunConfig } from "./types";
import { EPISODES } from "./triviaData";
import { CATEGORY_GROUPS, readableTypeName } from "./lib/categories";
import { buildCorpusBreakdown, countQuestionsForTypes } from "./lib/corpusStats";
import { marathonStyleUi, quizUiStrings } from "./quizLabels";
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
  return `Season ${s}`;
}

function NewTabAnnouncement() {
  return <span className="visually-hidden">opens in new tab</span>;
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

export function App() {
  const [screen, setScreen] = useState<GameScreen>({ name: "home" });
  const [quiz, setQuiz] = useState<QuizPhase | null>(null);
  const [browseSearch, setBrowseSearch] = useState("");
  const prefersReducedMotion = usePrefersReducedMotion();

  const bySeason = useMemo(() => {
    const map = new Map<number, EpisodeBundle[]>();
    for (const ep of EPISODES) {
      const s = ep.season;
      if (!map.has(s)) map.set(s, []);
      map.get(s)!.push(ep);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.seriesIndex - b.seriesIndex);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, []);

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
    setScreen({ name: "home" });
  }, []);

  const goBrowse = useCallback(() => {
    setQuiz(null);
    setScreen({ name: "browse" });
  }, []);

  const goStats = useCallback(() => {
    setQuiz(null);
    setScreen({ name: "stats" });
  }, []);

  const corpus = useMemo(() => buildCorpusBreakdown(EPISODES), []);

  const coverageGaps = useMemo(() => {
    const covered = new Set(CATEGORY_GROUPS.flatMap((g) => [...g.types]));
    return corpus.byType.filter((row) => !covered.has(row.type));
  }, [corpus]);

  const startQuiz = useCallback(
    (items: QuizItem[], run: QuizRunConfig, enteredFromBrowse: boolean) => {
      if (items.length === 0) {
        window.alert("No questions matched that setup—pick another arc.");
        return;
      }
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
    (run: QuizRunConfig, itemsRef: QuizItem[], enteredFromBrowse: boolean) => {
      switch (run.mode) {
        case "episode": {
          const ep = itemsRef[0]?.episode;
          if (ep) startQuiz(episodeQuizItems(ep), { mode: "episode" }, enteredFromBrowse);
          break;
        }
        case "marathon_random":
          startQuiz(marathonQuizItems(EPISODES, run.count, Math.random), run, false);
          break;
        case "daily":
          startQuiz(
            dailyChallengeQuizItems(EPISODES, run.dateKeyUtc, run.count),
            run,
            false,
          );
          break;
        case "season":
          startQuiz(
            marathonForSeason(EPISODES, run.season, run.count, Math.random),
            run,
            false,
          );
          break;
        case "categories":
          startQuiz(
            marathonForTypes(EPISODES, run.questionTypes, run.count, Math.random),
            run,
            false,
          );
          break;
        case "full_corpus": {
          const items =
            run.order === "broadcast"
              ? orderedFullCorpusRun(EPISODES)
              : shuffledFullCorpusRun(EPISODES, Math.random);
          startQuiz(items, run, false);
          break;
        }
      }
    },
    [startQuiz],
  );

  const startRandomEpisode = () => {
    const ep = randomEpisode(EPISODES, Math.random);
    startQuiz(episodeQuizItems(ep), { mode: "episode" }, false);
  };

  const startMarathonSized = (count: number) => {
    startQuiz(marathonQuizItems(EPISODES, count, Math.random), { mode: "marathon_random", count }, false);
  };

  const startDaily = () => {
    const key = utcCalendarKey();
    startQuiz(dailyChallengeQuizItems(EPISODES, key, DAILY_COUNT), { mode: "daily", dateKeyUtc: key, count: DAILY_COUNT }, false);
  };

  const startSeasonMix = (season: number, request: number) => {
    const cap = corpus.bySeason.find((x) => x.seasonIndex === season)?.questions ?? 0;
    const count = Math.max(1, Math.min(request, cap));
    startQuiz(marathonForSeason(EPISODES, season, count, Math.random), { mode: "season", season, count }, false);
  };

  const startCategoryMix = (
    cat: (typeof CATEGORY_GROUPS)[number],
    request: number,
  ) => {
    const cap = countQuestionsForTypes(corpus, cat.types);
    const count = Math.max(1, Math.min(request, cap));
    startQuiz(marathonForTypes(EPISODES, [...cat.types], count, Math.random), {
      mode: "categories",
      categoryLabel: cat.label,
      categoryId: cat.id,
      questionTypes: [...cat.types],
      count,
    }, false);
  };

  const startSingleTypeLens = (typeKey: string, request: number) => {
    const cap = corpus.byType.find((r) => r.type === typeKey)?.count ?? 0;
    const count = Math.max(1, Math.min(request, cap));
    startQuiz(marathonForTypes(EPISODES, [typeKey], count, Math.random), {
      mode: "categories",
      categoryLabel: readableTypeName(typeKey),
      categoryId: typeKey,
      questionTypes: [typeKey],
      count,
    }, false);
  };

  const startFullCorpus = (order: "broadcast" | "shuffled") => {
    const pool =
      order === "broadcast" ? orderedFullCorpusRun(EPISODES) : shuffledFullCorpusRun(EPISODES, Math.random);
    const cfg: QuizRunConfig = {
      mode: "full_corpus",
      poolSize: pool.length,
      order,
    };
    const ok =
      pool.length <= 250 ||
      window.confirm(
        `This run includes all ${pool.length} script-derived prompts and can take multiple hours split across breaks. Kick it off anyway?`,
      );
    if (ok) startQuiz(pool, cfg, false);
  };

  const currentItem = quiz ? (quiz.items[quiz.index] ?? null) : null;

  const advanceReveal = useCallback(() => {
    setQuiz((q) => {
      if (!q || q.phase !== "reveal") return q;
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
  }, [quiz, onPickAnswer, advanceReveal]);

  const quitQuiz = useCallback(() => {
    if (!quiz) return;
    const hasProgress =
      quiz.index > 0 || Object.keys(quiz.answers).length > 0;
    if (hasProgress) {
      const ok = window.confirm(
        "End this quiz? Your progress on this run will be lost.",
      );
      if (!ok) return;
    }
    goHome();
  }, [quiz, goHome]);

  const progressValue = quiz
    ? Math.min(quiz.index + 1, quiz.items.length)
    : 0;
  const progressMax = quiz?.items.length ?? 1;

  const quizUi = quiz ? quizUiStrings(quiz.run) : null;

  return (
    <div className="app-shell">
      <header className="brand-lockup">
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
      </header>

      {screen.name === "home" && (
        <div className="stack">
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
              <strong>Corpus intelligence</strong>
              <button type="button" className="btn btn-ghost-light" onClick={goStats}>
                Open atlas
              </button>
            </div>
            <p className="card-muted corpus-footnote">
              Explore per-season densities, trivia archetypes, and how the dataset breaks down across {corpus.distinctTypes.length}{" "}
              distinct classifier tags.
            </p>
          </div>

          <div className="card">
            <strong>Daily hive-mind puzzle</strong>
            <p className="card-muted" style={{ marginTop: "0.35rem" }}>
              UTC date <code className="inline-code">{utcCalendarKey()}</code> locks everyone into the exact same {DAILY_COUNT}-prompt slate.
              Bragging rights unlocked.
            </p>
            <button type="button" className="btn btn-teal btn-block" onClick={startDaily}>
              Play today&apos;s seeded challenge ({DAILY_COUNT} questions)
            </button>
          </div>

          <div className="card">
            <strong>Classic episode arcs</strong>
            <div className="stack" style={{ marginTop: "0.65rem" }}>
              <button type="button" className="btn btn-teal btn-block" onClick={startRandomEpisode}>
                Random installment · full 25-question screenplay pass
              </button>
              <button type="button" className="btn btn-ghost-light btn-block" onClick={goBrowse}>
                Searchable catalogue (title + production order)
              </button>
            </div>
          </div>

          <div className="card">
            <strong>Season silos · hyper-focused grinds</strong>
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
                    onClick={() => startSeasonMix(seasonIndex, 25)}
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
            <strong>Archetype laboratories</strong>
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
                        onClick={() => startCategoryMix(cat, Math.min(15, cap))}
                      >
                        15 sprint
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost-light"
                        disabled={disabled}
                        onClick={() => startCategoryMix(cat, focus25)}
                      >
                        {focus25}-deep
                      </button>
                      {deep > focus25 ? (
                        <button
                          type="button"
                          className="btn btn-ghost-light"
                          disabled={disabled}
                          onClick={() => startCategoryMix(cat, deep)}
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
              <strong>Residual classifier tags</strong>
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
                      onClick={() => startSingleTypeLens(row.type, playable)}
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
            <strong>Total chaos mega-mixes</strong>
            <p className="card-muted" style={{ marginTop: "0.35rem" }}>
              Completely randomized pulls from the continental question pool—or flex with the entire corpus twice (ordered vs reshuffled).
            </p>
            <div className="marathon-actions">
              {[10, 25, 50, 100].map((n) => (
                <button key={n} type="button" className="btn btn-red btn-block" onClick={() => startMarathonSized(n)}>
                  {n} random prompts
                </button>
              ))}
            </div>
            <div className="stack full-corpus-row">
              <button type="button" className="btn btn-teal btn-block" onClick={() => startFullCorpus("broadcast")}>
                Canon order · entire matrix ({corpus.questionCount.toLocaleString()} prompts)
              </button>
              <button type="button" className="btn btn-ghost-light btn-block" onClick={() => startFullCorpus("shuffled")}>
                Shuffle literally everything fresh
              </button>
            </div>
          </div>
        </div>
      )}

      {screen.name === "browse" && (
        <div className="stack">
          <div className="card">
            <div className="row-between">
              <strong>Select an episode</strong>
              <div className="row-between" style={{ gap: "0.5rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-ghost-light" onClick={goStats}>
                  Atlas
                </button>
                <button type="button" className="btn btn-ghost-light" onClick={goHome}>
                  Home
                </button>
              </div>
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
          <div className="card stack">
            {filteredBySeasonBrowse.length === 0 ? (
              <p className="card-muted">No episodes match “{browseSearch.trim()}”—try loosening your filter.</p>
            ) : (
              filteredBySeasonBrowse.map(([season, episodes]) => (
              <details key={season} className="season-acc">
                <summary>
                  <span>{seasonTitle(season)}</span>
                  <span style={{ fontWeight: 600, opacity: 0.55 }}>
                    ({episodes.length}&nbsp;{episodes.length === 1 ? "episode" : "episodes"})
                  </span>
                </summary>
                {episodes.map((ep) => (
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
            <div className="row-between">
              <button type="button" className="btn btn-ghost-light" onClick={quitQuiz}>
                Quit quiz
              </button>
              <span className="episode-meta" aria-live="polite">
                {quizUi ? `${quizUi.subtitle} · ` : null}
                {quiz.index + 1} / {quiz.items.length}
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
              <strong>Corpus atlas · raw coverage</strong>
              <button type="button" className="btn btn-ghost-light" onClick={goHome}>
                Home
              </button>
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
            </dl>
          </div>
          <div className="card">
            <strong>Per-season density</strong>
            <div className="table-wrap" style={{ marginTop: "0.75rem" }}>
              <table className="data-sheet">
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
            <strong>Classifier inventory</strong>
            <p className="card-muted" style={{ marginTop: "0.35rem" }}>
              Every label is emitted by the trivia generator so you can steer practice toward exactly the kind of screenplay signal you
              care about.
            </p>
            <div className="table-wrap" style={{ marginTop: "0.75rem" }}>
              <table className="data-sheet">
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
        />
      )}

      <footer style={{ marginTop: "3rem", textAlign: "center", opacity: 0.55, fontSize: "0.78rem", lineHeight: 1.5 }}>
        Scripts & episode index credited to SeinfeldScripts.com fan transcripts. Questions are algorithmically derived and
        may include imperfect parsing—consult the script link on each bundle if something feels off.
      </footer>
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

  return (
    <div className="stack">
      <div className="card">
        <p className="episode-meta">{resultsTitle}</p>
        <p className="results-score">{correctCt}&nbsp;<span style={{ opacity: 0.45 }}>/</span> {items.length}</p>
        <p className="card-muted">
          {wrongCt ? `${wrongCt} missed. ` : null}
          {skipped ? `${skipped} unanswered. ` : null}
          {correctCt === items.length ? "Master of your domain." : "Serenity now—try again sometime."}
        </p>

        {run.mode === "episode" && items[0] && (
          <p style={{ marginBottom: "0.65rem", fontWeight: 600 }}>
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
            <p className="episode-meta">Review misses</p>
            <ul className="card-muted" style={{ paddingLeft: "1rem", margin: "0.5rem 0 0", fontWeight: 500 }}>
              {items.map((item, i) => {
                const rec = answers[i];
                if (!rec || rec.correct) return null;
                return (
                  <li key={`${item.episode.seriesIndex}-${i}-${item.question.id}`}>
                    → {item.question.question.slice(0, 120)}
                    … <strong>Answer:</strong> {item.question.options[item.question.correctIndex]}
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
