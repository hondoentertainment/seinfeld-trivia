const STORAGE_KEY = "yada-yada-trivia:questions-reviewed";

export function readQuestionsReviewed(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const n = raw ? Number.parseInt(raw, 10) : 0;
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.floor(n);
  } catch {
    return 0;
  }
}

export function writeQuestionsReviewed(n: number): void {
  try {
    const v = Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
    localStorage.setItem(STORAGE_KEY, String(v));
  } catch {
    /* quota / privacy mode */
  }
}
