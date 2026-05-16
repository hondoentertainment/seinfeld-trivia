import type { QuizItem } from "../types";

export function buildQuestionReportBody(item: QuizItem): string {
  return [
    `Episode: #${item.episode.seriesIndex} — ${item.episode.title}`,
    `Question id: ${item.question.id}`,
    `Type: ${item.question.type}`,
    `Prompt: ${item.question.question}`,
    `Script URL: ${item.episode.primarySource}`,
    "",
    "What looks wrong?",
  ].join("\n");
}

export function githubNewIssueUrl(title: string, body: string): string | null {
  const repo = import.meta.env.VITE_FEEDBACK_GITHUB_REPO as string | undefined;
  if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) return null;
  const t = encodeURIComponent(title);
  const b = encodeURIComponent(body);
  return `https://github.com/${repo}/issues/new?title=${t}&body=${b}`;
}
