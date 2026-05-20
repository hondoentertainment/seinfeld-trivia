import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "seinfeld-trivia-pwa-install-dismissed-v1";

export function PwaInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  if (!deferred || dismissed) return null;

  const onInstall = async () => {
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  const onDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
    setDeferred(null);
  };

  return (
    <div className="pwa-install-bar" role="region" aria-label="Install app">
      <p className="pwa-install-text">Install for offline play after your first visit.</p>
      <div className="pwa-install-actions">
        <button type="button" className="btn btn-teal" onClick={() => void onInstall()}>
          Add to home screen
        </button>
        <button type="button" className="btn btn-ghost-light" onClick={onDismiss}>
          Not now
        </button>
      </div>
    </div>
  );
}
