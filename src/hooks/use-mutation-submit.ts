"use client";

import { useRouter } from "next/navigation";
import { useCallback, type FormEvent } from "react";
import { submitMutation } from "@/lib/mutation-client";
import { addListHistoryDepth, restaurantOriginHref, type AddListStep, type RestaurantOrigin } from "@/lib/routes";

type Options = {
  activeListId: number | null;
  restaurantOrigin: RestaurantOrigin;
  addListStep: AddListStep;
  /** True when the Add list wizard was opened in-app, so its history can be rewound. */
  addListOpenedInApp: () => boolean;
  /** Marks that leaving edit mode should trigger a refresh. */
  markPendingEditRefresh: () => void;
};

/**
 * Refetches the layout segment that supplies AppState after a navigation.
 *
 * `/mutate` is a Route Handler, not a Server Action, so the `revalidatePath()`
 * it calls only clears the server cache — nothing invalidates the browser's
 * Router Cache. Every route shares the layout that loads AppState, so a
 * client-side navigation reuses that cached segment and renders pre-mutation
 * data: a just-created Restaurant is missing from `allRestaurants` and its
 * detail pane falls back to "Select a restaurant".
 *
 * The refresh has to run *after* the navigation. Called before, it refetches
 * the old URL and the subsequent navigation still serves the stale segment.
 */
function refreshAfterNavigation(router: { refresh: () => void }) {
  router.refresh();
}

/**
 * Intercepts every `/mutate` form submission bubbling up through AppShell and
 * routes the response, instead of letting the browser do a full page POST.
 *
 * Attach the returned handler to a container's onSubmit — the app has no Server
 * Actions, so all writes are plain forms posting to `/mutate`.
 */
export function useMutationSubmit({
  activeListId,
  restaurantOrigin,
  addListStep,
  addListOpenedInApp,
  markPendingEditRefresh,
}: Options) {
  const router = useRouter();

  return useCallback(
    async (event: FormEvent<HTMLElement>) => {
      if (event.defaultPrevented) return;
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || new URL(form.action, window.location.href).pathname !== "/mutate") return;
      event.preventDefault();

      const action = String(new FormData(form).get("__action") ?? "");
      // The sheet is a mobile overlay: replace so it does not stack another entry.
      const fromAddSheet = form.closest(".add-restaurant-sheet") !== null;
      const submitter = (event.nativeEvent as SubmitEvent).submitter;
      if (submitter instanceof HTMLButtonElement) submitter.disabled = true;

      try {
        const result = await submitMutation(form);
        if (!result.ok) {
          router.replace(result.redirectTo, { scroll: false });
          return;
        }
        if (action === "updateEntryAndRatings") {
          // Leaving edit mode triggers the refresh; see markPendingEditRefresh.
          markPendingEditRefresh();
          router.back();
        } else if (action === "createList" && addListOpenedInApp()) {
          // Rewind past every wizard step, then redirect once the pop lands.
          window.addEventListener("popstate", () => {
            router.replace(result.redirectTo, { scroll: false });
            router.refresh();
          }, { once: true });
          window.history.go(-addListHistoryDepth(addListStep));
        } else if (["addRestaurant", "addRestaurantFromGoogleMapsUrl", "attachRestaurantToList"].includes(action)) {
          if (fromAddSheet) router.replace(result.redirectTo, { scroll: false });
          else router.push(result.redirectTo, { scroll: false });
          refreshAfterNavigation(router);
        } else if (action === "deleteRestaurant") {
          router.replace(restaurantOriginHref(restaurantOrigin, activeListId), { scroll: false });
          refreshAfterNavigation(router);
        } else if (["createList", "deleteList"].includes(action)) {
          router.replace(result.redirectTo, { scroll: false });
          refreshAfterNavigation(router);
        } else if (result.redirectTo !== `${window.location.pathname}${window.location.search}`) {
          router.replace(result.redirectTo, { scroll: false });
          refreshAfterNavigation(router);
        } else {
          router.refresh();
        }
      } finally {
        if (submitter instanceof HTMLButtonElement) submitter.disabled = false;
      }
    },
    [activeListId, addListOpenedInApp, addListStep, markPendingEditRefresh, restaurantOrigin, router],
  );
}
