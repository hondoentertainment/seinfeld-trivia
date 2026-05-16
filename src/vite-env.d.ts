/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SITE_CANONICAL?: string;
  /** e.g. owner/repo — enables "Report" GitHub new-issue deep links */
  readonly VITE_FEEDBACK_GITHUB_REPO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
