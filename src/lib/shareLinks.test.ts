import { describe, expect, it, vi } from "vitest";
import { buildDailyResultShareUrl, parseDailyShareSearch } from "./shareLinks";

vi.mock("../siteConfig", () => ({
  SITE_CANONICAL: "https://example.test",
}));

describe("parseDailyShareSearch", () => {
  it("returns payload for valid query", () => {
    expect(parseDailyShareSearch("?d=2026-05-17&s=12&t=15")).toEqual({
      dateKeyUtc: "2026-05-17",
      correct: 12,
      total: 15,
    });
  });

  it("returns null when incomplete", () => {
    expect(parseDailyShareSearch("?d=2026-05-17&s=12")).toBeNull();
    expect(parseDailyShareSearch("")).toBeNull();
  });

  it("rejects impossible scores", () => {
    expect(parseDailyShareSearch("?d=2026-05-17&s=20&t=15")).toBeNull();
    expect(parseDailyShareSearch("?d=bad-date&s=1&t=2")).toBeNull();
  });
});

describe("buildDailyResultShareUrl", () => {
  it("embeds params on canonical base", () => {
    const u = buildDailyResultShareUrl({ dateKeyUtc: "2026-01-02", correct: 3, total: 15 });
    expect(u).toContain("example.test");
    expect(u).toContain("d=2026-01-02");
    expect(u).toContain("s=3");
    expect(u).toContain("t=15");
  });
});
