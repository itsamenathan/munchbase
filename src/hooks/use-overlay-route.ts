"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

type Options = {
  /** Where to land when closing an overlay that was deep-linked into. */
  fallbackHref: string;
  /** Runs before either close path, for resetting overlay-local state. */
  onClose?: () => void;
};

export type OverlayRoute = {
  open: (href: string) => void;
  close: () => void;
};

/**
 * Drives an overlay whose open/closed state lives in the URL.
 *
 * Closing has to distinguish two cases: the user opened the overlay from inside
 * the app (so there is history to pop, and popping keeps the back button
 * consistent), or they deep-linked straight to it (so there is nothing to pop,
 * and `router.back()` would leave Munchbase entirely).
 */
export function useOverlayRoute(isOpen: boolean, { fallbackHref, onClose }: Options): OverlayRoute {
  const router = useRouter();
  const openedInAppRef = useRef(false);

  // Once the overlay closes by any route change, forget how it was opened.
  useEffect(() => {
    if (!isOpen) openedInAppRef.current = false;
  }, [isOpen]);

  // Callers pass an inline callback; hold it in a ref so `close` stays stable.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  const open = useCallback(
    (href: string) => {
      openedInAppRef.current = true;
      router.push(href, { scroll: false });
    },
    [router],
  );

  const close = useCallback(() => {
    // Guard against a child firing onClose when the overlay is already gone —
    // without it, a stray call would pop an unrelated history entry.
    if (!isOpen) return;
    onCloseRef.current?.();
    if (openedInAppRef.current) router.back();
    else router.replace(fallbackHref, { scroll: false });
  }, [fallbackHref, isOpen, router]);

  return { open, close };
}
