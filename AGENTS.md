# Agent playbook — Seinfeld Trivia

This repository is a Vite + React SPA with a bundled JSON trivia corpus (`data/trivia/all-episode*.json`), supplemental in `src/supplementalTrivia.ts`, and a generation pipeline under `scripts/`. Use **parallel agents** (or parallel sessions) for these lanes so work does not collide:

## 1. Corpus & data quality (`data` + `scripts/`)

- Regenerate or normalize trivia: `npm run normalize-data`, `npm run generate-trivia` (see `package.json`).
- Extend or fix **question types** in the generator, `src/lib/triviaQuality.ts`, and tests in `src/triviaQuality.test.ts`.
- **Do not** hand-edit `all-episodes.json` without running normalizers—prefer fixing the generator.

**Outputs:** higher signal prompts, fewer parse artifacts, updated `corpusSummary` counts.

## 2. Game logic & fairness (`src/shuffle.ts`, `src/types.ts`, tests)

- Daily seed determinism (`src/lib/seededRng.ts`), marathon filters, replay behaviour.
- **Constraint:** changing daily seeds breaks “same quiz for everyone”—document behaviour in tests (`shuffleModes.test.ts`).

## 3. Product / UX (`src/App.tsx`, `src/index.css`, `src/screens/`)

- New modes, navigation, results, accessibility, mobile layout.
- Keep **one** main screen router pattern (`GameScreen`); prefer small presentational components in `src/screens/` or `src/components/`.

## 4. Trust, SEO, and sharing (`index.html`, `public/`, `src/lib/shareLinks.ts`, `src/siteConfig.ts`)

- Static SEO landings in `public/*.html` redirect into the SPA with `?screen=` where needed.
- Share URLs use `?d=&s=&t=` (see `shareLinks.ts`). Changing param names is a breaking change for shared links.
- Deep links: `?episode=N` (series index), `?season=N` (0–10), `?screen=about|trust|browse|stats`.
- Regenerate SEO landings: `npm run generate-seo`.

## 5. Performance & PWA (`vite.config.ts`, service worker)

- Corpus stays async via `loadTriviaCorpus.ts`; avoid pulling `all-episodes.json` into the main chunk.
- Tune `manualChunks`, lazy routes, or prefetch—measure with build output and Lighthouse.

## 6. Verification

- `npm run test` — Vitest.
- `npm run test:e2e` — Playwright (`e2e/`).
- `npm run build` — must pass before deploy.

## Coordination rules

- **One agent per lane** when possible; merge order: data → shuffle/types → App UI → SEO/public assets.
- **Never** commit secrets (`.env`); use `VITE_*` for public build-time vars (`VITE_SITE_CANONICAL`, `VITE_FEEDBACK_GITHUB_REPO`, `VITE_FEEDBACK_EMAIL`).
