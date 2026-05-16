const KEY = "yada-yada-trivia:daily-personal-bests";

export type DailyPersonalRow = {
  dateKeyUtc: string;
  correct: number;
  total: number;
  at: string;
};

export function recordDailyPersonalBest(
  dateKeyUtc: string,
  correct: number,
  total: number,
): DailyPersonalRow | null {
  try {
    const raw = localStorage.getItem(KEY);
    const list: DailyPersonalRow[] = raw ? JSON.parse(raw) : [];
    const prev = list.find((r) => r.dateKeyUtc === dateKeyUtc);
    if (prev && prev.correct >= correct) return prev;
    const next: DailyPersonalRow = {
      dateKeyUtc,
      correct,
      total,
      at: new Date().toISOString(),
    };
    const filtered = list.filter((r) => r.dateKeyUtc !== dateKeyUtc);
    filtered.unshift(next);
    localStorage.setItem(KEY, JSON.stringify(filtered.slice(0, 90)));
    return next;
  } catch {
    return null;
  }
}

export function getDailyPersonalBest(dateKeyUtc: string): DailyPersonalRow | null {
  try {
    const raw = localStorage.getItem(KEY);
    const list: DailyPersonalRow[] = raw ? JSON.parse(raw) : [];
    return list.find((r) => r.dateKeyUtc === dateKeyUtc) ?? null;
  } catch {
    return null;
  }
}
