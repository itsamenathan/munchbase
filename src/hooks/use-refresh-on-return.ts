import { useEffect } from "react";

/**
 * Reloads server data when the app comes back to the foreground, so a screen left
 * open does not keep showing what it saw hours ago. Throttled, since returning to
 * the tab and focusing the window often fire together.
 */
export function useRefreshOnReturn(refresh: () => void, enabled: boolean, minIntervalMs = 15_000) {
  useEffect(() => {
    if (!enabled) return;
    let lastRun = Date.now();
    const run = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastRun < minIntervalMs) return;
      lastRun = now;
      refresh();
    };
    document.addEventListener("visibilitychange", run);
    window.addEventListener("focus", run);
    return () => {
      document.removeEventListener("visibilitychange", run);
      window.removeEventListener("focus", run);
    };
  }, [enabled, minIntervalMs, refresh]);
}
