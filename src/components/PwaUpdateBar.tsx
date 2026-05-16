import { useRegisterSW } from "virtual:pwa-register/react";

/**
 * Shown when a new service worker is waiting; refresh applies the update.
 */
export function PwaUpdateBar() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered() {
      /* dev: optional log */
    },
    onRegisterError() {
      /* non-fatal */
    },
  });

  if (needRefresh) {
    return (
      <div className="pwa-update-bar" role="status">
        <p>A new version is ready.</p>
        <button
          type="button"
          className="btn btn-teal"
          onClick={() => {
            void updateServiceWorker(true);
            setNeedRefresh(false);
          }}
        >
          Reload to update
        </button>
        <button type="button" className="btn btn-ghost-light" onClick={() => setNeedRefresh(false)}>
          Later
        </button>
      </div>
    );
  }

  if (offlineReady) {
    return (
      <div className="pwa-update-bar pwa-update-bar--info" role="status">
        <p>Content cached — this site works offline after the first visit.</p>
        <button type="button" className="btn btn-ghost-light" onClick={() => setOfflineReady(false)}>
          OK
        </button>
      </div>
    );
  }

  return null;
}
