import type { QuizItem } from "../types";
import { readableTypeName } from "./categories";

export type TypeStatRow = {
  type: string;
  label: string;
  asked: number;
  correct: number;
};

export function computeAnsweredTypeBreakdown(
  items: QuizItem[],
  answers: Record<number, { choice: number; correct: boolean }>,
): TypeStatRow[] {
  const map = new Map<string, { asked: number; correct: number }>();
  for (let i = 0; i < items.length; i++) {
    const a = answers[i];
    if (!a) continue;
    const t = items[i]!.question.type;
    const cur = map.get(t) ?? { asked: 0, correct: 0 };
    cur.asked++;
    if (a.correct) cur.correct++;
    map.set(t, cur);
  }
  return [...map.entries()]
    .map(([type, v]) => ({
      type,
      label: readableTypeName(type),
      asked: v.asked,
      correct: v.correct,
    }))
    .sort((a, b) => b.asked - a.asked);
}
