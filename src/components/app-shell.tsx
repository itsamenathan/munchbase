"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import {
  CalendarClock,
  Search,
} from "lucide-react";
import { SidebarContent } from "@/components/layout/sidebar";
import { Topbar, type TopbarBack } from "@/components/layout/topbar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { AddRestaurantsPanel } from "@/components/search/add-restaurants";
import { AddRestaurantSheet } from "@/components/search/add-restaurant-sheet";
import { ListSettingsPanel } from "@/components/lists/list-settings";
import { AddListModal } from "@/components/lists/add-list-modal";
import { AdminDrawer } from "@/components/admin/admin-panel";
import { CheckInFeed } from "@/components/checkins/check-in-feed";
import { ExploreView } from "@/components/explore/explore-view";
import { RestaurantDetailPane } from "@/components/restaurant/restaurant-detail-pane";
import { NetworkStatus } from "@/components/shared/network-status";
import { InstallPrompt } from "@/components/shared/install-prompt";
import { EmptyState } from "@/components/shared/empty-state";
import { useHaptics } from "@/hooks/use-haptics";
import { AppMutationProvider, type AppMutationResult } from "@/hooks/use-app-mutation";
import { EditSessionProvider, type EditConflictState, type FreshEditStart } from "@/hooks/use-edit-session";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { useOverlayRoute } from "@/hooks/use-overlay-route";
import { useMediaQuery } from "@/hooks/use-media-query";
import { ToastProvider } from "@/hooks/use-toast";
import { useMutationSubmit } from "@/hooks/use-mutation-submit";
import { useRefreshOnReturn } from "@/hooks/use-refresh-on-return";
import { usePlaceSearch } from "@/hooks/use-place-search";
import { useRestaurantFilter } from "@/hooks/use-restaurant-filter";
import { useScrollRestoration } from "@/hooks/use-scroll-restoration";
import { useTheme } from "@/hooks/use-theme";
import { deriveAppRouteState } from "@/lib/app-route-state";
import { cacheAppStateSnapshot, reportCacheFailure, type SerializedFormData } from "@/lib/offline-db";
import {
  applyOfflineMutation,
  serializeMutationFormData,
  supportsOfflineMutation,
  UnsupportedOfflineMutationError,
} from "@/lib/offline-mutations";
import { submitMutationData } from "@/lib/mutation-client";
import {
  addHref,
  addListHistoryDepth,
  addListHref,
  listSettingsHref,
  restaurantHref,
  restaurantOriginHref,
  tabHref,
  type BottomTab,
  type RestaurantOrigin,
} from "@/lib/routes";
import { compareRestaurantNames } from "@/lib/restaurant-sort";
import type { AppState, RatingDefinition } from "@/lib/types";

const ORIGIN_LABEL: Record<RestaurantOrigin, string> = {
  explore: "Explore",
  map: "Map",
  checkins: "Check-ins",
};

function offlineMutationFailure(message: string, redirectTo: string): AppMutationResult {
  return { ok: false, code: "offline", message, redirectTo, queued: false };
}

export default function AppShell({
  state: initialState,
  children,
  offlineShell = false,
}: {
  state: AppState;
  children?: React.ReactNode;
  offlineShell?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const {
    online,
    pendingRestaurantIds,
    queuedCount,
    queueMutation,
    createMutationId,
    reportBlocked,
    markOriginUnavailable,
  } = useNetworkStatus();
  const [state, setState] = useState(initialState);
  const stateRef = useRef(initialState);
  const serverStateRef = useRef(initialState);
  const haptics = useHaptics();
  const theme = useTheme();
  const restaurantOpenedInAppRef = useRef(false);
  const addListOpenedInAppRef = useRef(false);
  const editHasPreviewRef = useRef(false);
  const editOpenedFromPreviewRef = useRef(false);
  const pendingEditRefreshRef = useRef(false);
  const canWrite = true;

  useEffect(() => {
    if (serverStateRef.current === initialState) return;
    serverStateRef.current = initialState;
    stateRef.current = initialState;
    setState(initialState);
  }, [initialState]);

  useEffect(() => {
    if (offlineShell || !searchParams.has("__offlineReconnect")) return;
    const returnTo = searchParams.get("__offlineReturnTo");
    if (returnTo?.startsWith("/") && !returnTo.startsWith("//") && !returnTo.startsWith("/offline")) {
      window.location.replace(returnTo);
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("__offlineReconnect");
    url.searchParams.delete("__offlineReturnTo");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, [offlineShell, searchParams]);

  const {
    activeListId,
    selectedRestaurantId: selectedEntryId,
    restaurantOrigin: selectedEntryOrigin,
    restaurantEditing: initialEntryEdit,
    activeTab,
    settingsOpen,
    addOpen,
    addListOpen,
    addListStep: activeAddListStep,
    adminOpen,
    activePhotoId,
  } = deriveAppRouteState(pathname, searchParams, state.user.role);
  const activeList = activeListId ? (state.lists.find((list) => list.id === activeListId) ?? null) : null;

  const { locationCoords, panelProps: placeSearchProps } = usePlaceSearch({ nearbyEnabled: addOpen });

  const { rememberRoot: rememberRootScroll, prepareNavigation: prepareRootNavigation } =
    useScrollRestoration({
      activeTab,
      activeListId,
      selectedRestaurantId: selectedEntryId,
      onLeaveRestaurant: () => {
        restaurantOpenedInAppRef.current = false;
        editHasPreviewRef.current = false;
      },
    });

  useEffect(() => {
    if (!addListOpen) addListOpenedInAppRef.current = false;
  }, [addListOpen]);

  useEffect(() => {
    void cacheAppStateSnapshot(state).catch(reportCacheFailure);
  }, [state]);

  const navigate = useMemo(() => {
    const local = (href: string, replace: boolean) => {
      const method = replace ? "replaceState" : "pushState";
      window.history[method](window.history.state, "", href);
      window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
    };
    return {
      push: (href: string) => online ? router.push(href, { scroll: false }) : local(href, false),
      replace: (href: string) => online ? router.replace(href, { scroll: false }) : local(href, true),
      back: () => window.history.back(),
      refresh: () => { if (online) router.refresh(); },
    };
  }, [online, router]);

  const activeState = useMemo(() => {
    const activeListRestaurants = activeListId
      ? state.allRestaurants.filter((restaurant) => restaurant.memberships.some((membership) => membership.id === activeListId))
      : state.allRestaurants;
    return {
      ...state,
      activeList,
      activeListId: activeList?.id ?? null,
      restaurants: activeListRestaurants,
      allRestaurants: state.allRestaurants,
      ratingDefinitions: activeList
        ? state.allRatingDefinitions.filter((definition) => definition.listId === activeList.id)
        : [],
    };
  }, [activeList, activeListId, state]);

  const activeDefinitions = useMemo(
    () => [...activeState.globalRatingDefinitions, ...activeState.ratingDefinitions],
    [activeState.globalRatingDefinitions, activeState.ratingDefinitions],
  );

  // Matches the 760px breakpoint in layout.css. Phones show a Restaurant or List settings in place of the list;
  // wider screens show it beside the list. Only the one that is visible is rendered.
  const isSplitLayout = useMediaQuery("(min-width: 760px)");

  // Not while changes are waiting to sync (a refresh would replace them with the server's older copy) or while editing.
  useRefreshOnReturn(navigate.refresh, online && queuedCount === 0 && !initialEntryEdit);

  const navigateRoot = (tab: BottomTab) => {
    prepareRootNavigation(tab);
    navigate.replace(tabHref(tab, activeState.activeListId));
  };

  const openRestaurant = useCallback((id: number, origin: RestaurantOrigin, replace = false) => {
    rememberRootScroll(origin);
    restaurantOpenedInAppRef.current = true;
    const href = restaurantHref(id, activeState.activeListId, { origin });
    if (replace) navigate.replace(href);
    else navigate.push(href);
  }, [activeState.activeListId, navigate, rememberRootScroll]);

  const selectEntry = useCallback((id: number | null) => {
    haptics.light();
    if (id !== null) {
      openRestaurant(id, "explore", selectedEntryId !== null);
    }
  }, [haptics, openRestaurant, selectedEntryId]);

  const openEntryFromMap = (id: number) => {
    openRestaurant(id, "map", selectedEntryId !== null);
  };

  const filter = useRestaurantFilter({
    restaurants: activeState.restaurants,
    definitions: activeDefinitions,
    locationCoords,
    activeTab,
  });

  const selectedEntry =
    activeState.allRestaurants.find((r) => r.id === selectedEntryId) ?? null;

  useEffect(() => {
    if (!selectedEntryId || !initialEntryEdit) return;
    if (editOpenedFromPreviewRef.current) {
      editOpenedFromPreviewRef.current = false;
      editHasPreviewRef.current = true;
      return;
    }
    const previewHref = restaurantHref(selectedEntryId, activeState.activeListId, { origin: selectedEntryOrigin });
    const editHref = restaurantHref(selectedEntryId, activeState.activeListId, { origin: selectedEntryOrigin, edit: true });
    const currentState = window.history.state;
    window.history.replaceState(currentState, "", previewHref);
    window.history.pushState(currentState, "", editHref);
    editHasPreviewRef.current = true;
  }, [activeState.activeListId, initialEntryEdit, selectedEntryId, selectedEntryOrigin]);

  useEffect(() => {
    if (!initialEntryEdit && pendingEditRefreshRef.current) {
      pendingEditRefreshRef.current = false;
      navigate.refresh();
    }
  }, [initialEntryEdit, navigate]);

  const activeListName = activeState.activeList?.name ?? "All restaurants";
  const mutationMessage = searchParams.get("message");

  const hrefWithParams = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) params.delete(key); else params.set(key, value);
    }
    const queryString = params.toString();
    return `${pathname}${queryString ? `?${queryString}` : ""}`;
  }, [pathname, searchParams]);

  const settingsRoute = useOverlayRoute(settingsOpen, {
    fallbackHref: tabHref("lists", activeState.activeListId),
    navigation: navigate,
  });
  const openListSettings = (listId: number | null) => {
    if (!online) {
      reportBlocked("List settings need a connection.");
      return;
    }
    settingsRoute.open(listSettingsHref(listId));
  };
  const closeSettings = settingsRoute.close;

  // Place-search state is reset by the addOpen transition effect below, which also
  // covers closing via the back button.
  const addRoute = useOverlayRoute(addOpen, {
    fallbackHref: tabHref("explore", activeState.activeListId),
    navigation: navigate,
  });
  const openAdd = () => {
    if (!online) {
      reportBlocked("Adding a Restaurant needs a connection.");
      return;
    }
    addRoute.open(addHref(activeState.activeListId));
  };
  const closeAdd = addRoute.close;

  const adminRoute = useOverlayRoute(adminOpen, {
    fallbackHref: hrefWithParams({ overlay: null }),
    navigation: navigate,
  });
  const openAdmin = () => {
    if (!online) {
      reportBlocked("Admin needs a connection.");
      return;
    }
    adminRoute.open(hrefWithParams({ overlay: "admin" }));
  };
  const closeAdmin = adminRoute.close;

  const photoRoute = useOverlayRoute(activePhotoId !== null, {
    fallbackHref: hrefWithParams({ photo: null }),
    navigation: navigate,
  });
  const openPhoto = (photoId: number) => photoRoute.open(hrefWithParams({ photo: String(photoId) }));
  const closePhoto = photoRoute.close;

  // The Add list wizard pushes one history entry per step, so closing rewinds by
  // the step depth rather than popping a single entry — not the single pop that
  // useOverlayRoute performs.
  const openAddList = () => {
    addListOpenedInAppRef.current = true;
    if (!online) {
      reportBlocked("Adding Lists needs a connection.");
      return;
    }
    navigate.push(addListHref(activeState.activeListId, "details"));
  };

  const closeAddList = useCallback(() => {
    if (!addListOpen) return;
    if (addListOpenedInAppRef.current) {
      window.history.go(-addListHistoryDepth(activeAddListStep));
    } else {
      navigate.replace(tabHref("lists", activeState.activeListId));
    }
  }, [activeAddListStep, activeState.activeListId, addListOpen, navigate]);

  const setAddListStep = (step: typeof activeAddListStep) => {
    navigate.push(addListHref(activeState.activeListId, step));
  };

  const backFromRestaurant = () => {
    if (initialEntryEdit) {
      navigate.back();
      return;
    }
    if (restaurantOpenedInAppRef.current || editHasPreviewRef.current) navigate.back();
    else navigate.replace(restaurantOriginHref(selectedEntryOrigin, activeState.activeListId));
  };

  const setRestaurantEdit = (edit: boolean) => {
    if (!selectedEntryId) return;
    if (edit) {
      editOpenedFromPreviewRef.current = true;
      editHasPreviewRef.current = true;
      navigate.push(restaurantHref(selectedEntryId, activeState.activeListId, { origin: selectedEntryOrigin, edit: true }));
    } else {
      navigate.back();
    }
  };

  // While editing, back returns to the Restaurant preview rather than the origin tab.
  const topbarBack: TopbarBack | null = settingsOpen
    ? { label: "Lists", onClick: closeSettings }
    : selectedEntryId !== null
      ? { label: initialEntryEdit ? "Restaurant" : ORIGIN_LABEL[selectedEntryOrigin], onClick: backFromRestaurant }
      : null;

  const switcherLists = useMemo(() => state.lists.map((list) => ({
    id: list.id,
    name: list.name,
    count: state.allRestaurants.filter((r) => r.memberships.some((m) => m.id === list.id)).length,
  })), [state.allRestaurants, state.lists]);

  const selectPhoto = (photoId: number) => {
    navigate.replace(hrefWithParams({ photo: String(photoId) }));
  };

  // Declared after the close handlers so they are initialized when this effect's
  // dependency array is evaluated during render.
  useEffect(() => {
    if (!adminOpen && !addListOpen && !activePhotoId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (activePhotoId) closePhoto();
      else if (adminOpen) closeAdmin();
      else closeAddList();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [activePhotoId, addListOpen, adminOpen, closeAddList, closeAdmin, closePhoto]);

  const addListOpenedInApp = useCallback(() => addListOpenedInAppRef.current, []);
  const markPendingEditRefresh = useCallback(() => {
    pendingEditRefreshRef.current = true;
  }, []);

  const submitAppMutation = useCallback(async (formData: FormData): Promise<AppMutationResult> => {
    const action = String(formData.get("__action") ?? "");
    const redirectTo = `${window.location.pathname}${window.location.search}`;
    const requestMutationId = createMutationId();
    if (supportsOfflineMutation(action)) formData.set("__mutationId", requestMutationId);
    let payload: SerializedFormData;
    try {
      payload = serializeMutationFormData(formData);
    } catch (error) {
      const message = error instanceof Error ? error.message : "This change needs a connection.";
      reportBlocked(message);
      return offlineMutationFailure(message, redirectTo);
    }

    const queue = async () => {
      if (!supportsOfflineMutation(action)) throw new UnsupportedOfflineMutationError();
      const nextState = applyOfflineMutation(stateRef.current, action, payload, requestMutationId);
      await queueMutation(action, payload, nextState, requestMutationId);
      stateRef.current = nextState;
      setState(nextState);
      return { ok: true, redirectTo, queued: true } satisfies AppMutationResult;
    };

    if (!online) {
      try {
        return await queue();
      } catch (error) {
        const message = error instanceof Error ? error.message : "This change could not be saved offline.";
        reportBlocked(message);
        return offlineMutationFailure(message, redirectTo);
      }
    }

    try {
      const result = await submitMutationData(formData);
      if (result.ok && supportsOfflineMutation(action)) {
        try {
          const nextState = applyOfflineMutation(stateRef.current, action, payload, requestMutationId);
          stateRef.current = nextState;
          setState(nextState);
        } catch (error) {
          reportCacheFailure(error);
        }
      }
      return { ...result, queued: false };
    } catch (error) {
      if (supportsOfflineMutation(action)) {
        try {
          markOriginUnavailable();
          return await queue();
        } catch (queueError) {
          const message = queueError instanceof Error ? queueError.message : "This change could not be saved offline.";
          reportBlocked(message);
          return offlineMutationFailure(message, redirectTo);
        }
      }
      const message = error instanceof Error ? error.message : "This change needs a connection.";
      reportBlocked(message);
      return offlineMutationFailure(message, redirectTo);
    }
  }, [createMutationId, markOriginUnavailable, online, queueMutation, reportBlocked]);

  // Global ratings (go back, price, stars) are kept apart from the list-level ones.
  const ratingDefinitionsForEdit = useMemo(
    () => [...activeState.globalRatingDefinitions, ...activeState.allRatingDefinitions],
    [activeState.globalRatingDefinitions, activeState.allRatingDefinitions],
  );
  const [editConflict, setEditConflict] = useState<EditConflictState | null>(null);
  const [freshEditStart, setFreshEditStart] = useState<FreshEditStart | null>(null);
  const editSessionValue = useMemo(
    () => ({ conflict: editConflict, setConflict: setEditConflict, freshStart: freshEditStart, setFreshStart: setFreshEditStart }),
    [editConflict, freshEditStart],
  );
  // The submit handler clears the conflict once an edit is saved; that also ends the edit session.
  const handleEditConflict = useCallback((conflict: EditConflictState | null) => {
    setEditConflict(conflict);
    if (conflict === null) setFreshEditStart(null);
  }, []);

  const handleMutationSubmit = useMutationSubmit({
    activeListId: activeState.activeListId,
    restaurantOrigin: selectedEntryOrigin,
    addListStep: activeAddListStep,
    addListOpenedInApp,
    markPendingEditRefresh,
    submitMutation: submitAppMutation,
    ratingDefinitions: ratingDefinitionsForEdit,
    onEditConflict: handleEditConflict,
    navigate,
  });

  const handleOfflineLinkClick = useCallback((event: MouseEvent<HTMLElement>) => {
    if (online || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest("a");
    if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
    const url = new URL(anchor.href, window.location.href);
    if (url.origin !== window.location.origin) return;
    event.preventDefault();
    if (url.pathname === "/add" || url.pathname.includes("/settings")) {
      reportBlocked("That screen needs a connection.");
      return;
    }
    navigate.push(`${url.pathname}${url.search}${url.hash}`);
  }, [navigate, online, reportBlocked]);

  return (
    <AppMutationProvider submit={submitAppMutation}>
    <EditSessionProvider value={editSessionValue}>
    <ToastProvider>
    <main
      className={`app${selectedEntry && initialEntryEdit ? " is-editing" : ""}${settingsOpen || selectedEntry ? " has-detail" : ""}`}
      onSubmit={handleMutationSubmit} onClickCapture={handleOfflineLinkClick}>
      <NetworkStatus />
      <aside className="sidebar">
        <SidebarContent
          state={activeState}
          canWrite={canWrite}
          onOpenAddList={openAddList}
          onOpenListSettings={openListSettings}
          onNavigateToExplore={(listId) => prepareRootNavigation("explore", listId)}
          showListSettings
        />
      </aside>

      <section className="workbench">
        {mutationMessage ? (
          <p className="mutation-error" role="alert">
            {mutationMessage}
          </p>
        ) : null}
        <Topbar
          user={activeState.user}
          activeTab={activeTab}
          activeListId={activeState.activeListId}
          activeListName={activeListName}
          lists={switcherLists}
          totalCount={activeState.allRestaurants.length}
          back={topbarBack}
          theme={theme}
          onNavigateRoot={navigateRoot}
          onSelectList={(listId) => prepareRootNavigation(activeTab, listId)}
          onOpenAdmin={openAdmin}
        />

        {isSplitLayout ? null : settingsOpen ? (
          <section className="mobile-detail-view">
            <ListSettingsPanel state={activeState} onClose={closeSettings} />
          </section>
        ) : selectedEntry ? (
          <section className="mobile-detail-view">
            <RestaurantDetailPane
              restaurant={selectedEntry}
              state={activeState}
              canWrite={canWrite}
              online={online}
              pending={pendingRestaurantIds.includes(selectedEntry.id)}
              editing={initialEntryEdit}
              onEditChange={setRestaurantEdit}
              activePhotoId={activePhotoId}
              onOpenPhoto={openPhoto}
              onSelectPhoto={selectPhoto}
              onClosePhoto={closePhoto}
            />
          </section>
        ) : null}

        <div className={settingsOpen || selectedEntry ? "mobile-hidden-when-detail" : undefined}>
          {activeTab === "lists" && !settingsOpen ? (
            <section className="mobile-lists-view">
              <SidebarContent
                state={activeState}
                canWrite={canWrite}
                onOpenAddList={openAddList}
                onOpenListSettings={openListSettings}
                showAccountActions={false}
                showListSettings
                showBrand={false}
                onNavigateToExplore={(listId) => prepareRootNavigation("explore", listId)}
              />
            </section>
          ) : activeTab === "checkins" ? (
            <div className={`content-grid checkin-content-grid${selectedEntry ? " has-selection" : ""}`}>
              <CheckInFeed
                restaurants={activeState.restaurants}
                activeListId={activeState.activeListId}
                onOpenRestaurant={() => {
                  rememberRootScroll("checkins");
                  restaurantOpenedInAppRef.current = true;
                }}
              />
              <section className="detail">
                {!isSplitLayout ? null : selectedEntry ? (
                  <RestaurantDetailPane
                    restaurant={selectedEntry}
                    state={activeState}
                    canWrite={canWrite}
                    online={online}
                    pending={pendingRestaurantIds.includes(selectedEntry.id)}
                    editing={initialEntryEdit}
                    onEditChange={setRestaurantEdit}
                    activePhotoId={activePhotoId}
                    onOpenPhoto={openPhoto}
                    onSelectPhoto={selectPhoto}
                    onClosePhoto={closePhoto}
                  />
                ) : (
                  <EmptyState
                    icon={<CalendarClock size={28} />}
                    title="Select a check-in"
                    description="Pick a visit to see its Restaurant details."
                  />
                )}
              </section>
            </div>
          ) : (
            <ExploreView
              state={activeState}
              filter={filter}
              definitions={activeDefinitions}
              locationCoords={locationCoords}
              showMap={activeTab === "map"}
              activeListName={activeListName}
              selectedRestaurantId={selectedEntry?.id ?? null}
              pendingRestaurantIds={pendingRestaurantIds}
              hasDetail={Boolean(selectedEntry || settingsOpen)}
              addOpen={addOpen}
              onOpenAdd={openAdd}
              onSelectRestaurant={selectEntry}
              onSelectFromMap={openEntryFromMap}
              detail={
                !isSplitLayout ? null : settingsOpen ? (
                  <ListSettingsPanel state={activeState} onClose={closeSettings} />
                ) : selectedEntry ? (
                  <RestaurantDetailPane
                    restaurant={selectedEntry}
                    state={activeState}
                    canWrite={canWrite}
                    online={online}
                    pending={pendingRestaurantIds.includes(selectedEntry.id)}
                    editing={initialEntryEdit}
                    onEditChange={setRestaurantEdit}
                    activePhotoId={activePhotoId}
                    onOpenPhoto={openPhoto}
                    onSelectPhoto={selectPhoto}
                    onClosePhoto={closePhoto}
                  />
                ) : (
                  <EmptyState
                    icon={<Search size={28} />}
                    title="Select a restaurant"
                    description="Pick one from the list to see details, notes, and ratings."
                  />
                )
              }
            />
          )}
        </div>
      </section>

      {canWrite && online ? (
        <aside className="utility">
          <header className="utility-header">
            <p className="kicker">Add restaurant</p>
            <h2>{activeState.activeList?.name ?? "All restaurants"}</h2>
          </header>
          <AddRestaurantsPanel
            state={activeState}
            canWrite={canWrite}
            {...placeSearchProps}
            onOpenRestaurant={(id) => openRestaurant(id, "explore")}
          />
        </aside>
      ) : null}

      <BottomNav
        activeTab={activeTab}
        activeListId={activeState.activeListId}
        onNavigate={(tab) => prepareRootNavigation(tab)}
      />

      {addOpen ? (
        <AddRestaurantSheet
          activeListName={activeListName}
          onClose={closeAdd}
          state={activeState}
          canWrite={canWrite}
          {...placeSearchProps}
          onOpenRestaurant={(id) => navigate.replace(restaurantHref(id, activeState.activeListId, { origin: "explore" }))}
        />
      ) : null}

      {adminOpen ? <AdminDrawer state={activeState} onClose={closeAdmin} /> : null}
      {addListOpen ? (
        <AddListModal
          state={activeState}
          step={activeAddListStep}
          onStepChange={setAddListStep}
          onBackStep={navigate.back}
          onClose={closeAddList}
        />
      ) : null}
      <InstallPrompt />
      {children ? <span hidden>{children}</span> : null}
    </main>
    </ToastProvider>
    </EditSessionProvider>
    </AppMutationProvider>
  );
}
