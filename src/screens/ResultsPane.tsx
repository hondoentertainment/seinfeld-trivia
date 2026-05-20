import { useEffect, useMemo, useState } from "react";
import { getDailyStreakSnapshot, recordDailyStreakCompletion } from "../lib/dailyStreak";
import {
  getDailyPersonalBest,
  recordDailyPersonalBest,
  type DailyPersonalRow,
} from "../lib/localDailyBest";
import { computeAnsweredTypeBreakdown } from "../lib/resultsBreakdown";
import { applyDailyShareMeta } from "../lib/shareMeta";
import { buildDailyResultShareUrl } from "../lib/shareLinks";
import { formatDailyShareLine, formatGenericShareLine } from "../lib/shareText";
import { quizUiStrings } from "../quizLabels";
import { SITE_CANONICAL } from "../siteConfig";
import type { QuizItem, QuizRunConfig } from "../types";
import { NewTabAnnouncement } from "../ui/NewTabAnnouncement";

export type ResultsPaneProps = {
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
  onDailyStreakUpdated?: () => void;
};

export default function ResultsPane({
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
  onDailyStreakUpdated,
}: ResultsPaneProps) {
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
  const [streakAfter, setStreakAfter] = useState<{ current: number; best: number } | null>(null);

  useEffect(() => {
    if (run.mode !== "daily") return;
    recordDailyPersonalBest(run.dateKeyUtc, correctCt, items.length);
    setDailySnapshot(getDailyPersonalBest(run.dateKeyUtc));
    recordDailyStreakCompletion(run.dateKeyUtc);
    setStreakAfter(getDailyStreakSnapshot());
    onDailyStreakUpdated?.();
    applyDailyShareMeta({
      dateKeyUtc: run.dateKeyUtc,
      correct: correctCt,
      total: items.length,
    });
  }, [run, correctCt, items.length, onDailyStreakUpdated]);

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

  const dailyPayload =
    run.mode === "daily"
      ? { dateKeyUtc: run.dateKeyUtc, correct: correctCt, total: items.length }
      : null;

  const shareLine = dailyPayload
    ? formatDailyShareLine(dailyPayload)
    : formatGenericShareLine(quizUiStrings(run).resultsTitle, correctCt, items.length, accuracyPct);

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
        <p className="results-score">
          {correctCt}&nbsp;<span style={{ opacity: 0.45 }}>/</span> {items.length}
        </p>
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

        {run.mode === "daily" && streakAfter && streakAfter.current > 0 ? (
          <p className="card-muted daily-streak-line" role="status">
            UTC streak: <strong>{streakAfter.current}</strong> day{streakAfter.current === 1 ? "" : "s"} · best {streakAfter.best}
          </p>
        ) : null}

        <div className="row-between results-share-row">
          <div className="results-share-actions">
            {run.mode === "daily" ? (
              <button type="button" className="btn btn-teal" onClick={() => void onCopyShareLinkOnly()}>
                Challenge a friend
              </button>
            ) : null}
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
