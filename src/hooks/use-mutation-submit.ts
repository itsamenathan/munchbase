"use client";

import { useCallback, type FormEvent } from "react";
import type { AppMutationResult } from "@/hooks/use-app-mutation";
import { addListHistoryDepth, restaurantOriginHref, type AddListStep, type RestaurantOrigin } from "@/lib/routes";

type Options = {
  activeListId: number | null;
  restaurantOrigin: RestaurantOrigin;
  addListStep: AddListStep;
  /** True when the Add list wizard was opened in-app, so its history can be rewound. */
  addListOpenedInApp: () => boolean;
  /** Marks that leaving edit mode should trigger a refresh. */
  markPendingEditRefresh: () => void;
  submitMutation: (formData: FormData) => Promise<AppMutationResult>;
  navigate: {
    back: () => void;
    push: (href: string) => void;
    replace: (href: string) => void;
    refresh: () => void;
  };
};

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
  submitMutation,
  navigate,
}: Options) {
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
        const result = await submitMutation(new FormData(form));
        if (!result.ok) {
          if (result.code !== "offline") navigate.replace(result.redirectTo);
          return;
        }
        if (action === "updateEntryAndRatings") {
          // Leaving edit mode triggers the refresh; see markPendingEditRefresh.
          if (!result.queued) markPendingEditRefresh();
          navigate.back();
        } else if (action === "createList" && addListOpenedInApp()) {
          // Rewind past every wizard step, then redirect once the pop lands.
          window.addEventListener("popstate", () => {
            navigate.replace(result.redirectTo);
            navigate.refresh();
          }, { once: true });
          window.history.go(-addListHistoryDepth(addListStep));
        } else if (["addRestaurant", "addRestaurantFromGoogleMapsUrl", "attachRestaurantToList"].includes(action)) {
          if (fromAddSheet) navigate.replace(result.redirectTo);
          else navigate.push(result.redirectTo);
          if (!result.queued) navigate.refresh();
        } else if (action === "deleteRestaurant") {
          navigate.replace(restaurantOriginHref(restaurantOrigin, activeListId));
          if (!result.queued) navigate.refresh();
        } else if (["createList", "deleteList"].includes(action)) {
          navigate.replace(result.redirectTo);
          if (!result.queued) navigate.refresh();
        } else if (result.redirectTo !== `${window.location.pathname}${window.location.search}`) {
          navigate.replace(result.redirectTo);
          if (!result.queued) navigate.refresh();
        } else if (!result.queued) {
          navigate.refresh();
        }
      } finally {
        if (submitter instanceof HTMLButtonElement) submitter.disabled = false;
      }
    },
    [activeListId, addListOpenedInApp, addListStep, markPendingEditRefresh, navigate, restaurantOrigin, submitMutation],
  );
}
