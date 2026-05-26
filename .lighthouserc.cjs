const PREVIEW_PORT = process.env.PREVIEW_PORT ?? "4174";

module.exports = {
  ci: {
    collect: {
      startServerCommand: `npx vite preview --port ${PREVIEW_PORT} --strictPort`,
      url: [`http://localhost:${PREVIEW_PORT}/`],
      /** Vite emits the listening URL containing the port regardless of locale. */
      startServerReadyPattern: `localhost:${PREVIEW_PORT}`,
      startServerReadyTimeout: 240_000,
      numberOfRuns: 1,
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: 0.85 }],
        "categories:accessibility": ["error", { minScore: 0.9 }],
        "categories:best-practices": ["error", { minScore: 0.9 }],
        "categories:seo": ["warn", { minScore: 0.35 }],
        "largest-contentful-paint": ["warn", { maxNumericValue: 4000 }],
        "cumulative-layout-shift": ["warn", { maxNumericValue: 0.15 }],
      },
    },
  },
};
