import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearDailyStreakForTests, getDailyStreakSnapshot, recordDailyStreakCompletion } from "./dailyStreak";

function mockLocalStorage() {
  const store = new Map<string, string>();
  const ls = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
  };
  vi.stubGlobal("localStorage", ls);
  return store;
}

beforeEach(() => {
  mockLocalStorage();
});

afterEach(() => {
  clearDailyStreakForTests();
  vi.unstubAllGlobals();
});

describe("recordDailyStreakCompletion", () => {
  it("starts at 1 on first play", () => {
    const r = recordDailyStreakCompletion("2026-05-01");
    expect(r).toEqual({ current: 1, best: 1, extended: true });
    expect(getDailyStreakSnapshot()?.best).toBe(1);
  });

  it("increments on consecutive UTC days", () => {
    recordDailyStreakCompletion("2026-05-01");
    const r = recordDailyStreakCompletion("2026-05-02");
    expect(r.current).toBe(2);
    expect(r.best).toBe(2);
  });

  it("does not double-count same day", () => {
    recordDailyStreakCompletion("2026-05-01");
    const r = recordDailyStreakCompletion("2026-05-01");
    expect(r.extended).toBe(false);
    expect(r.current).toBe(1);
  });
});
