# Changelog

All notable changes to **Yada yada trivia** are documented here.

## [Unreleased]

### Added
- Dynamic daily share OG images via `/api/og` (Vercel Edge)
- Display name for share text; “Challenge a friend” on daily results
- UTC streak at-risk reminder; PWA install prompt
- 180 episode SEO landings; `launchRouter` for deep links
- GitHub issue template for trivia QA; Search Console doc
- Shareable daily scores via `?d=&s=&t=` query params with landing card on home
- About and Trust screens; static SEO landings and regenerated `sitemap.xml`
- Episode (`?episode=`) and season (`?season=`) deep links from SEO pages
- UTC daily streak tracking (local device) with home and results integration
- Parallel season-shard corpus loading and idle prefetch warmup
- Running-gag supplemental question type (`running_gag`)
- GitHub Actions CI (unit, build, E2E, Lighthouse)
- Agent playbook (`AGENTS.md`) for parallel development lanes

### Changed
- App shell split into lazy-loaded screens; vendor code-splitting in Vite build
- QA reporting: GitHub issues, optional `mailto:` fallback, clipboard

## [1.0.0] — 2026-05

- Script-sourced Seinfeld trivia corpus (~4.5k prompts, 180 episodes)
- Daily UTC challenge, season silos, category labs, full-corpus marathons
- PWA with offline caching after first load
