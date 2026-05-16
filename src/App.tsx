import { useCallback, useEffect, useMemo, useState } from "react";
import type { EpisodeBundle, GameScreen, QuizItem } from "./types";
import { EPISODES } from "./triviaData";
import {
  episodeQuizItems,
  marathonQuizItems,
  randomEpisode,
} from "./shuffle";

type QuizPhase = {
  marathon: boolean;
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

export function App() {
  const [screen, setScreen] = useState<GameScreen>({ name: "home" });
  const [quiz, setQuiz] = useState<QuizPhase | null>(null);
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

  const goHome = useCallback(() => {
    setQuiz(null);
    setScreen({ name: "home" });
  }, []);

  const goBrowse = useCallback(() => {
    setQuiz(null);
    setScreen({ name: "browse" });
  }, []);

  const startQuiz = useCallback(
    (items: QuizItem[], marathon: boolean, enteredFromBrowse: boolean) => {
      setQuiz({
        marathon,
        items,
        index: 0,
        answers: {},
        phase: "answer",
        lastPick: null,
        enteredFromBrowse,
      });
      setScreen({ name: "quiz", items, marathon, enteredFromBrowse });
    },
    [],
  );

  const startRandomEpisode = () => {
    const ep = randomEpisode(EPISODES, Math.random);
    startQuiz(episodeQuizItems(ep), false, false);
  };

  const startMarathon = (count: number) => {
    const items = marathonQuizItems(EPISODES, count, Math.random);
    startQuiz(items, true, false);
  };

  const currentItem = quiz ? (quiz.items[quiz.index] ?? null) : null;

  const advanceReveal = useCallback(() => {
    setQuiz((q) => {
      if (!q || q.phase !== "reveal") return q;
      if (q.index + 1 >= q.items.length) {
        const items = q.items;
        const answers = q.answers;
        const marathon = q.marathon;
        const enteredFromBrowse = q.enteredFromBrowse;
        setScreen({ name: "results", items, answers, marathon, enteredFromBrowse });
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

  return (
    <div className="app-shell">
      <header className="brand-lockup">
        <h1>Yada yada trivia</h1>
        <p className="tagline">Twenty-five script-sourced questions per episode—no hugging, no learning.</p>
        <div className="pill-strip" aria-hidden>
          <span className="pill">180 episodes</span>
          <span className="pill">4500 prompts</span>
          <span className="pill">Local play</span>
        </div>
      </header>

      {screen.name === "home" && (
        <div className="stack">
          <div className="card">
            <p className="card-muted" style={{ marginTop: 0 }}>
              Jump into any episode catalogued on{" "}
              <a
                href="http://www.seinfeldscripts.com/seinfeld-scripts.html"
                target="_blank"
                rel="noopener noreferrer"
              >
                SeinfeldScripts.com
                <NewTabAnnouncement />
              </a>
              , or remix questions across the run.
            </p>
            <div className="stack">
              <button type="button" className="btn btn-teal btn-block" onClick={startRandomEpisode}>
                Random episode (25 questions)
              </button>
              <button type="button" className="btn btn-ghost-light btn-block" onClick={goBrowse}>
                Browse catalog by season
              </button>
            </div>
          </div>
          <div className="card">
            <strong>Marathon</strong>
            <p className="card-muted" style={{ marginTop: "0.35rem" }}>
              Shuffle the full question pool—a little Frank Costanza chaos.
            </p>
            <div className="marathon-actions">
              {[10, 25, 50].map((n) => (
                <button key={n} type="button" className="btn btn-red btn-block" onClick={() => startMarathon(n)}>
                  {n} questions
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {screen.name === "browse" && (
        <div className="stack">
          <div className="card">
            <div className="row-between">
              <strong>Select an episode</strong>
              <button type="button" className="btn btn-ghost-light" onClick={goHome}>
                Home
              </button>
            </div>
          </div>
          <div className="card stack">
            {bySeason.map(([season, episodes]) => (
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
                    onClick={() => startQuiz(episodeQuizItems(ep), false, true)}
                  >
                    {ep.title}{" "}
                    <span style={{ fontWeight: 500, color: "var(--ink-muted)" }}>(#{ep.seriesIndex})</span>
                  </button>
                ))}
              </details>
            ))}
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
                {quiz.marathon ? "Marathon • " : null}
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
              {!quiz.marathon ? (
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

      {screen.name === "results" && (
        <ResultsPane
          items={screen.items}
          answers={screen.answers}
          marathon={screen.marathon}
          enteredFromBrowse={screen.enteredFromBrowse}
          onHome={goHome}
          onBrowse={goBrowse}
          onReplay={() => {
            if (!screen.marathon && screen.items[0]) {
              startQuiz(
                episodeQuizItems(screen.items[0].episode),
                false,
                screen.enteredFromBrowse,
              );
            } else if (screen.items.length > 0) {
              startMarathon(screen.items.length);
            }
          }}
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
  marathon,
  enteredFromBrowse,
  onHome,
  onBrowse,
  onReplay,
}: {
  items: QuizItem[];
  answers: Record<number, { choice: number; correct: boolean }>;
  marathon: boolean;
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
        <p className="episode-meta">{marathon ? "Marathon results" : "Episode results"}</p>
        <p className="results-score">{correctCt}&nbsp;<span style={{ opacity: 0.45 }}>/</span> {items.length}</p>
        <p className="card-muted">
          {wrongCt ? `${wrongCt} missed. ` : null}
          {skipped ? `${skipped} unanswered. ` : null}
          {correctCt === items.length ? "Master of your domain." : "Serenity now—try again sometime."}
        </p>

        {!marathon && items[0] && (
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
              {marathon ? "New marathon shuffle" : "Replay this episode"}
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
