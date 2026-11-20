import { useCallback, useEffect, useEffectEvent } from "react";

// Which keys have a history entry pushed. Module level, so an overlay whose component remounts (a layout change when
// the phone turns) still closes on Back and still goes back over its entry.
const pushed = new Set<string>();

/**
 * The phone's Back button closes a full-screen overlay (the in-app camera) instead of leaving the page.
 *
 * `push()` (called from the tap that opens the overlay, not from an effect, so StrictMode's double effects cannot
 * push and pop it) adds a history entry for the same address with `key` set in its state. The existing state is kept,
 * so the App Router's own entry data travels with it and going back over it restores the page without a navigation
 * or a refetch. Back (popstate) then calls `onBack`. Closing the overlay any other way calls `close()`, which goes
 * back over that entry so entries do not pile up; the popstate that follows is ignored.
 */
export function useBackCloses(key: string, onBack: () => void) {
  const back = useEffectEvent(onBack);

  useEffect(() => {
    const onPopState = () => {
      if (!pushed.has(key)) return;
      // Forward onto the marked entry again (after Back) is not a reason to close anything.
      if ((window.history.state as Record<string, unknown> | null)?.[key]) return;
      pushed.delete(key);
      back();
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [key]);

  const push = useCallback(() => {
    if (pushed.has(key)) return;
    pushed.add(key);
    window.history.pushState({ ...(window.history.state as object | null), [key]: true }, "");
  }, [key]);

  const close = useCallback(() => {
    if (!pushed.delete(key)) return;
    window.history.back();
  }, [key]);

  return { push, close };
}
