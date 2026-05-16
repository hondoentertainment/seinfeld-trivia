import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;
/** Keep in sync with `.lighthouserc.cjs` (`PREVIEW_PORT`). */
const PREVIEW_PORT = process.env.PREVIEW_PORT ?? "4174";
const baseURL = `http://localhost:${PREVIEW_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: [["list"], ...(isCI ? [["github" as const]] : [])],
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: isCI
      ? `npx vite preview --port ${PREVIEW_PORT} --strictPort`
      : `npm run build && npx vite preview --port ${PREVIEW_PORT} --strictPort`,
    url: baseURL,
    /** CI never reuses — avoids flaky “wrong build” attaches; local allows quick re-runs. */
    reuseExistingServer: !isCI,
    /** Local includes `npm run build`; corpus + PWA can be slow on cold runners. */
    timeout: isCI ? 180_000 : 480_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
