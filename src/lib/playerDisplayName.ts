const STORAGE_KEY = "seinfeld-trivia-display-name-v1";
const MAX_LEN = 24;

export function getDisplayName(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)?.trim();
    if (!raw) return null;
    return raw.slice(0, MAX_LEN);
  } catch {
    return null;
  }
}

export function setDisplayName(name: string): void {
  const trimmed = name.trim().slice(0, MAX_LEN);
  if (!trimmed) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, trimmed);
}

export function clearDisplayNameForTests(): void {
  localStorage.removeItem(STORAGE_KEY);
}
