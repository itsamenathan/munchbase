import { useEffect } from "react";

type LockedProperty = "overflow" | "touchAction";

// Overlays can be mounted more than once at the same time (the detail pane is
// rendered per layout, with the inactive ones hidden by CSS). Each saving and
// restoring the body style on its own leaves the page locked, so the original
// value is saved once and only restored when the last lock is released.
const holds: Record<LockedProperty, number> = { overflow: 0, touchAction: 0 };
const originals: Record<LockedProperty, string> = { overflow: "", touchAction: "" };

function lockStyle(property: LockedProperty, value: string) {
  const { body } = document;
  if (holds[property]++ === 0) originals[property] = body.style[property];
  body.style[property] = value;
  return () => {
    if (--holds[property] === 0) body.style[property] = originals[property];
  };
}

/** Stops the page behind an overlay from scrolling. `touchNone` also blocks touch panning. */
export function useBodyScrollLock(enabled = true, { touchNone = false } = {}) {
  useEffect(() => {
    if (!enabled) return;
    const releases = [lockStyle("overflow", "hidden"), touchNone ? lockStyle("touchAction", "none") : null];
    return () => releases.forEach((release) => release?.());
  }, [enabled, touchNone]);
}
