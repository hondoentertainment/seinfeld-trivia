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
};

function seasonTitle(s: number) {
  if (s === 0) return "Pilot";
  return `Season ${s}`;
}

export function App() {
  const [screen, setScreen] = useState<GameScreen>({ name: "home" });
  const [quiz, setQuiz] = useState<QuizPhase | null>(null);

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

  const startQuiz = useCallback((items: QuizItem[], marathon: boolean) => {
    setQuiz({
      marathon,
      items,
      index: 0,
      answers: {},
      phase: "answer",
      lastPick: null,
    });
    setScreen({ name: "quiz", items, marathon });
  }, []);

  const goHome = useCallback(() => {
    setQuiz(null);
    setScreen({ name: "home" });
  }, []);

  const startRandomEpisode = () => {
    const ep = randomEpisode(EPISODES, Math.random);
    startQuiz(episodeQuizItems(ep), false);
  };

  const startMarathon = (count: number) => {
    const items = marathonQuizItems(EPISODES, count, Math.random);
    startQuiz(items, true);
  };

  const currentItem = quiz ? (quiz.items[quiz.index] ?? null) : null;

  /** Advance after reveal timer */
  useEffect(() => {
    if (!quiz || quiz.phase !== "reveal") return undefined;
    const t = window.setTimeout(() => {
      setQuiz((q) => {
        if (!q) return q;
        if (q.index + 1 >= q.items.length) {
          const items = q.items;
          const answers = q.answers;
          const marathon = q.marathon;
          setScreen({ name: "results", items, answers, marathon });
          return null;
        }
        return {
          ...q,
          index: q.index + 1,
          phase: "answer",
          lastPick: null,
        };
      });
    }, 980);
    return () => window.clearTimeout(t);
  }, [quiz, quiz?.index, quiz?.phase]);

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
      if (!quiz || quiz.phase !== "answer") return;
      const keys = ["1", "2", "3", "4"];
      const ix = keys.indexOf(e.key);
      if (ix === -1) return;
      e.preventDefault();
      const opts = quiz.items[quiz.index]?.question.options;
      if (!opts || ix >= opts.length) return;
      onPickAnswer(ix);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [quiz, onPickAnswer]);

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
              <a href="http://www.seinfeldscripts.com/seinfeld-scripts.html" target="_blank" rel="noreferrer">
                SeinfeldScripts.com
              </a>
              , or remix questions across the run.
            </p>
            <div className="stack">
              <button type="button" className="btn btn-teal btn-block" onClick={startRandomEpisode}>
                Random episode (25 questions)
              </button>
              <button
                type="button"
                className="btn btn-ghost-light btn-block"
                onClick={() => setScreen({ name: "browse" })}
              >
                Browse catalog by season
              </button>
            </div>
          </div>
          <div className="card">
            <strong>Marathon</strong>
            <p className="card-muted" style={{ marginTop: "0.35rem" }}>
              Shuffle the full question pool—a little Frank Costanza chaos.
            </p>
            <div className="row-between">
              {[10, 25, 50].map((n) => (
                <button key={n} type="button" className="btn btn-red" onClick={() => startMarathon(n)}>
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
                Back home
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
                    onClick={() => startQuiz(episodeQuizItems(ep), false)}
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
              <button type="button" className="btn btn-ghost-light" onClick={goHome} disabled={quiz.phase === "reveal"}>
                Exit
              </button>
              <span className="episode-meta" aria-live="polite">
                {quiz.marathon ? "Marathon • " : null}
                {quiz.index + 1} / {quiz.items.length}
              </span>
            </div>
            <div className="progress-bar-wrap" aria-hidden style={{ marginTop: "1rem" }}>
              <div
                className="progress-fill"
                style={{ width: `${((quiz.index + (quiz.phase === "reveal" ? 0.92 : 0)) / quiz.items.length) * 100}%` }}
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
            <div className="answer-grid">
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
          onHome={goHome}
          onReplay={() => {
            if (!screen.marathon && screen.items[0]) {
              startQuiz(episodeQuizItems(screen.items[0].episode), false);
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
  onHome,
  onReplay,
}: {
  items: QuizItem[];
  answers: Record<number, { choice: number; correct: boolean }>;
  marathon: boolean;
  onHome: () => void;
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
            <a href={items[0].episode.primarySource} target="_blank" rel="noreferrer">
              {items[0].episode.title}
            </a>
          </p>
        )}

        <div className="row-between">
          <button type="button" className="btn btn-ghost-light" onClick={onHome}>
            Home
          </button>
          <button type="button" className="btn btn-teal" onClick={onReplay}>
            {marathon ? "New marathon shuffle" : "Replay this episode"}
          </button>
        </div>

        {(marathon ? items.slice(0, 12) : items).some((_, i) => answers[i] && !answers[i]?.correct) && (
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
