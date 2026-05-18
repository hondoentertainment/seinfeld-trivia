import type { QuizItem } from "../types";

export function buildQuestionReportBody(item: QuizItem): string {
  return [
    `Episode: #${item.episode.seriesIndex} — ${item.episode.title}`,
    `Question id: ${item.question.id}`,
    `Type: ${item.question.type}`,
    `Prompt: ${item.question.question}`,
    `Script URL: ${item.episode.primarySource}`,
    item.question.sourceUrl ? `Question source: ${item.question.sourceLabel ?? item.question.sourceKind ?? "source"} — ${item.question.sourceUrl}` : null,
    "",
    "What looks wrong?",
  ].filter(Boolean).join("\n");
}

export function githubNewIssueUrl(title: string, body: string): string | null {
  const repo = import.meta.env.VITE_FEEDBACK_GITHUB_REPO as string | undefined;
  if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) return null;
  const t = encodeURIComponent(title);
  const b = encodeURIComponent(body);
  return `https://github.com/${repo}/issues/new?title=${t}&body=${b}`;
}

/** When `VITE_FEEDBACK_EMAIL` is set at build time, opens the user’s mail client with a prefilled QA report. */
export function mailtoFeedbackUrl(subject: string, body: string): string | null {
  const to = import.meta.env.VITE_FEEDBACK_EMAIL as string | undefined;
  if (!to?.includes("@")) return null;
  return `mailto:${encodeURIComponent(to.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
