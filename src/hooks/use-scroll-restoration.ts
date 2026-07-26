"use client";

import { useCallback, useEffect, useRef } from "react";
import { tabHref, type BottomTab, type RestaurantOrigin } from "@/lib/routes";

type Options = {
  activeTab: BottomTab;
  activeListId: number | null;
  selectedRestaurantId: number | null;
  /** Runs when a Restaurant detail closes, so callers can reset their own state. */
  onLeaveRestaurant?: () => void;
};

/**
 * Keeps the scroll offset of each root tab across Restaurant detail and tab
 * navigation. Positions are keyed by the tab's href, so a list-scoped Explore
 * (`/explore?list=3`) restores independently from the unscoped one.
 */
export function useScrollRestoration({
  activeTab,
  activeListId,
  selectedRestaurantId,
  onLeaveRestaurant,
}: Options) {
  const positionsRef = useRef(new globalThis.Map<string, number>());
  const pendingRestoreRef = useRef<string | null>(null);
  const previousRestaurantRef = useRef<number | null>(null);
  // Callers pass an inline callback, so hold it in a ref rather than a dependency —
  // otherwise the scroll effect below would re-run on every render.
  const onLeaveRestaurantRef = useRef(onLeaveRestaurant);
  useEffect(() => {
    onLeaveRestaurantRef.current = onLeaveRestaurant;
  });

  useEffect(() => {
    const previousId = previousRestaurantRef.current;
    if (selectedRestaurantId && previousId !== selectedRestaurantId) {
      // Only on a genuine change of Restaurant — re-rendering the same one must
      // not yank the reader back to the top.
      window.scrollTo({ top: 0, left: 0 });
    } else if (!selectedRestaurantId && previousId) {
      const top = positionsRef.current.get(tabHref(activeTab, activeListId));
      // rAF: restoring before layout settles would scroll against a short page.
      if (top !== undefined) window.requestAnimationFrame(() => window.scrollTo({ top, left: 0 }));
      onLeaveRestaurantRef.current?.();
    }
    previousRestaurantRef.current = selectedRestaurantId;
  }, [activeListId, activeTab, selectedRestaurantId]);

  useEffect(() => {
    if (selectedRestaurantId || !pendingRestoreRef.current) return;
    const href = pendingRestoreRef.current;
    pendingRestoreRef.current = null;
    const top = positionsRef.current.get(href) ?? 0;
    window.requestAnimationFrame(() => window.scrollTo({ top, left: 0 }));
  }, [activeListId, activeTab, selectedRestaurantId]);

  /** Records the current offset before opening a Restaurant from `origin`. */
  const rememberRoot = useCallback(
    (origin: RestaurantOrigin) => {
      positionsRef.current.set(tabHref(origin, activeListId), window.scrollY);
    },
    [activeListId],
  );

  /** Records the current offset and queues a restore for the destination tab. */
  const prepareNavigation = useCallback(
    (tab: BottomTab, listId: number | null = activeListId) => {
      if (!selectedRestaurantId) {
        positionsRef.current.set(tabHref(activeTab, activeListId), window.scrollY);
      }
      pendingRestoreRef.current = tabHref(tab, listId);
    },
    [activeListId, activeTab, selectedRestaurantId],
  );

  return { rememberRoot, prepareNavigation };
}
