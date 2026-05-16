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
});
