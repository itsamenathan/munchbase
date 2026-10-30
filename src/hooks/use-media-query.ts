import { useSyncExternalStore } from "react";

/**
 * Whether a CSS media query currently matches. Reports false while rendering on the
 * server and during hydration, then updates, so the first client render matches the HTML.
 */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (notify) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", notify);
      return () => media.removeEventListener("change", notify);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
