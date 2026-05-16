/** Public site URL for share text and JSON-LD (override per deploy with VITE_SITE_CANONICAL). */
export const SITE_CANONICAL =
  (import.meta.env.VITE_SITE_CANONICAL as string | undefined)?.replace(/\/$/, "") ??
  "https://seinfeld-trivia-navy.vercel.app";
