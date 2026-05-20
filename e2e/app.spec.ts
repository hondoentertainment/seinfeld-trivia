import { expect, test } from "@playwright/test";

test.describe("app shell", () => {
  test("loads corpus then starts daily quiz flow", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /yada yada trivia/i })).toBeVisible({
      timeout: 120_000,
    });
    const daily = page.getByRole("button", { name: /today's seeded challenge/i });
    await expect(daily).toBeVisible({ timeout: 120_000 });
    await daily.click();
    await expect(page.getByRole("heading", { name: /quiz in progress/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^quit quiz$/i })).toBeVisible();
    await page.keyboard.press("1");
    await expect(
      page.getByRole("button", { name: /next question|see results/i }).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("shows shared daily score landing from query params", async ({ page }) => {
    await page.goto("/?d=2026-01-15&s=10&t=15");
    await expect(page.getByRole("region", { name: /shared daily score/i })).toBeVisible({
      timeout: 120_000,
    });
    await expect(page.getByText("10/15")).toBeVisible();
    await expect(page.getByText("2026-01-15")).toBeVisible();
  });

  test("opens About via screen query", async ({ page }) => {
    await page.goto("/?screen=about");
    await expect(page.getByRole("heading", { name: /about this archive/i })).toBeVisible({
      timeout: 30_000,
    });
  });

  test("episode deep link starts quiz when corpus loads", async ({ page }) => {
    await page.goto("/?episode=47");
    await expect(page.getByRole("heading", { name: /quiz in progress/i })).toBeVisible({
      timeout: 120_000,
    });
    await expect(page.getByText(/#47/)).toBeVisible({ timeout: 15_000 });
  });

  test("season deep link starts quiz when corpus loads", async ({ page }) => {
    await page.goto("/?season=4");
    await expect(page.getByRole("heading", { name: /quiz in progress/i })).toBeVisible({
      timeout: 120_000,
    });
  });

  test("trust screen loads from query", async ({ page }) => {
    await page.goto("/?screen=trust");
    await expect(page.getByRole("heading", { name: /trust, sources/i })).toBeVisible({
      timeout: 30_000,
    });
  });
});
