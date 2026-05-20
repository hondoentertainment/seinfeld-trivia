const STORAGE_KEY = "seinfeld-trivia-daily-streak-v1";

type StreakState = {
  /** Last UTC calendar day the user finished a daily run */
  lastPlayedDate: string;
  current: number;
  best: number;
};

function utcCalendarKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function readState(): StreakState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StreakState;
    if (typeof parsed.lastPlayedDate !== "string") return null;
    if (!Number.isFinite(parsed.current) || !Number.isFinite(parsed.best)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeState(state: StreakState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/** Call when a daily run reaches results (any score). */
export function recordDailyStreakCompletion(dateKeyUtc: string): { current: number; best: number; extended: boolean } {
  const prev = readState();
  let current = 1;
  let best = 1;
  let extended = true;

  if (prev) {
    const prevDate = prev.lastPlayedDate;
    if (prevDate === dateKeyUtc) {
      return { current: prev.current, best: prev.best, extended: false };
    }
    const prevMs = Date.parse(`${prevDate}T00:00:00Z`);
    const playMs = Date.parse(`${dateKeyUtc}T00:00:00Z`);
    const dayDiff = Math.round((playMs - prevMs) / 86_400_000);
    if (dayDiff === 1) {
      current = prev.current + 1;
    } else if (dayDiff === 0) {
      current = prev.current;
      extended = false;
    } else {
      current = 1;
    }
    best = Math.max(prev.best, current);
  }

  writeState({ lastPlayedDate: dateKeyUtc, current, best });
  return { current, best, extended };
}

export function getDailyStreakSnapshot(): { current: number; best: number } | null {
  const prev = readState();
  if (!prev) return null;
  const today = utcCalendarKey();
  const prevMs = Date.parse(`${prev.lastPlayedDate}T00:00:00Z`);
  const todayMs = Date.parse(`${today}T00:00:00Z`);
  const dayDiff = Math.round((todayMs - prevMs) / 86_400_000);
  if (dayDiff > 1) return { current: 0, best: prev.best };
  return { current: prev.current, best: prev.best };
}

export function clearDailyStreakForTests(): void {
  localStorage.removeItem(STORAGE_KEY);
}

function utcYesterdayKey(d = new Date()) {
  const y = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - 1));
  return y.toISOString().slice(0, 10);
}

/** True when the player had a streak through yesterday but has not finished today's UTC daily yet. */
export function isStreakAtRiskToday(): boolean {
  const prev = readState();
  if (!prev || prev.current < 1) return false;
  const today = utcCalendarKey();
  if (prev.lastPlayedDate === today) return false;
  return prev.lastPlayedDate === utcYesterdayKey();
}
