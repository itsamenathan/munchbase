"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  CalendarClock,
  ChevronLeft,
  ClipboardList,
  Map,
  LogOut,
  Monitor,
  Search,
  Shield,
  User,
  Utensils,
} from "lucide-react";
import { SidebarContent } from "@/components/layout/sidebar";
import { ThemePicker } from "@/components/layout/theme-picker";
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
import { useOverlayRoute } from "@/hooks/use-overlay-route";
import { usePlaceSearch } from "@/hooks/use-place-search";
import { useRestaurantFilter } from "@/hooks/use-restaurant-filter";
import { useScrollRestoration } from "@/hooks/use-scroll-restoration";
import { useTheme } from "@/hooks/use-theme";
import { deriveAppRouteState } from "@/lib/app-route-state";
import { cacheAppState, cacheLists, cacheRestaurants, reportCacheFailure } from "@/lib/offline-db";
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
import { submitMutation } from "@/lib/mutation-client";
import type { AppState, RatingDefinition } from "@/lib/types";

export default function AppShell({
  state,
  children,
}: {
  state: AppState;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const haptics = useHaptics();
  const theme = useTheme();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const restaurantOpenedInAppRef = useRef(false);
  const addListOpenedInAppRef = useRef(false);
  const editHasPreviewRef = useRef(false);
  const editOpenedFromPreviewRef = useRef(false);
  const pendingEditRefreshRef = useRef(false);
  const canWrite = true;

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
    // Write-through cache: keep the last successfully-loaded server state in
    // IndexedDB so a future offline session has something to fall back to.
    void cacheAppState("latest", state).catch(reportCacheFailure);
    void cacheRestaurants(state.allRestaurants).catch(reportCacheFailure);
    void cacheLists(state.lists).catch(reportCacheFailure);
  }, [state]);

  useEffect(() => {
    if (!userMenuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setUserMenuOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [userMenuOpen]);

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

  const navigateRoot = (tab: BottomTab) => {
    prepareRootNavigation(tab);
    router.replace(tabHref(tab, activeState.activeListId), { scroll: false });
  };

  const openRestaurant = useCallback((id: number, origin: RestaurantOrigin, replace = false) => {
    rememberRootScroll(origin);
    restaurantOpenedInAppRef.current = true;
    const href = restaurantHref(id, activeState.activeListId, { origin });
    if (replace) router.replace(href, { scroll: false });
    else router.push(href, { scroll: false });
  }, [activeState.activeListId, rememberRootScroll, router]);

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
      router.refresh();
    }
  }, [initialEntryEdit, router]);

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
  });
  const openListSettings = (listId: number | null) => settingsRoute.open(listSettingsHref(listId));
  const closeSettings = settingsRoute.close;

  // Place-search state is reset by the addOpen transition effect below, which also
  // covers closing via the back button.
  const addRoute = useOverlayRoute(addOpen, {
    fallbackHref: tabHref("explore", activeState.activeListId),
  });
  const openAdd = () => addRoute.open(addHref(activeState.activeListId));
  const closeAdd = addRoute.close;

  const adminRoute = useOverlayRoute(adminOpen, {
    fallbackHref: hrefWithParams({ overlay: null }),
  });
  const openAdmin = () => {
    adminRoute.open(hrefWithParams({ overlay: "admin" }));
    setUserMenuOpen(false);
  };
  const closeAdmin = adminRoute.close;

  const photoRoute = useOverlayRoute(activePhotoId !== null, {
    fallbackHref: hrefWithParams({ photo: null }),
  });
  const openPhoto = (photoId: number) => photoRoute.open(hrefWithParams({ photo: String(photoId) }));
  const closePhoto = photoRoute.close;

  // The Add list wizard pushes one history entry per step, so closing rewinds by
  // the step depth rather than popping a single entry — not the single pop that
  // useOverlayRoute performs.
  const openAddList = () => {
    addListOpenedInAppRef.current = true;
    router.push(addListHref(activeState.activeListId, "details"), { scroll: false });
  };

  const closeAddList = useCallback(() => {
    if (!addListOpen) return;
    if (addListOpenedInAppRef.current) {
      window.history.go(-addListHistoryDepth(activeAddListStep));
    } else {
      router.replace(tabHref("lists", activeState.activeListId), { scroll: false });
    }
  }, [activeAddListStep, activeState.activeListId, addListOpen, router]);

  const setAddListStep = (step: typeof activeAddListStep) => {
    router.push(addListHref(activeState.activeListId, step), { scroll: false });
  };

  const backFromRestaurant = () => {
    if (initialEntryEdit) {
      router.back();
      return;
    }
    if (restaurantOpenedInAppRef.current || editHasPreviewRef.current) router.back();
    else router.replace(restaurantOriginHref(selectedEntryOrigin, activeState.activeListId), { scroll: false });
  };

  const setRestaurantEdit = (edit: boolean) => {
    if (!selectedEntryId) return;
    if (edit) {
      editOpenedFromPreviewRef.current = true;
      editHasPreviewRef.current = true;
      router.push(restaurantHref(selectedEntryId, activeState.activeListId, { origin: selectedEntryOrigin, edit: true }), { scroll: false });
    } else {
      router.back();
    }
  };

  const selectPhoto = (photoId: number) => {
    router.replace(hrefWithParams({ photo: String(photoId) }), { scroll: false });
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

  const handleMutationSubmit = async (event: FormEvent<HTMLElement>) => {
    if (event.defaultPrevented) return;
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || new URL(form.action, window.location.href).pathname !== "/mutate") return;
    event.preventDefault();
    const action = String(new FormData(form).get("__action") ?? "");
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
        pendingEditRefreshRef.current = true;
        router.back();
      } else if (action === "createList" && addListOpenedInAppRef.current) {
        const depth = addListHistoryDepth(activeAddListStep);
        window.addEventListener("popstate", () => router.replace(result.redirectTo, { scroll: false }), { once: true });
        window.history.go(-depth);
      } else if (["addRestaurant", "addRestaurantFromGoogleMapsUrl", "attachRestaurantToList"].includes(action)) {
        if (fromAddSheet) router.replace(result.redirectTo, { scroll: false });
        else router.push(result.redirectTo, { scroll: false });
      } else if (action === "deleteRestaurant") {
        router.replace(restaurantOriginHref(selectedEntryOrigin, activeState.activeListId), { scroll: false });
      } else if (["createList", "deleteList"].includes(action)) {
        router.replace(result.redirectTo, { scroll: false });
      } else if (result.redirectTo !== `${window.location.pathname}${window.location.search}`) {
        router.replace(result.redirectTo, { scroll: false });
      } else {
        router.refresh();
      }
    } finally {
      if (submitter instanceof HTMLButtonElement) submitter.disabled = false;
    }
  };

  return (
    <main className="app" onSubmit={handleMutationSubmit}>
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
        <header className={`topbar${selectedEntryId ? " restaurant-open" : ""}`}>
          <div className="topbar-title">
            <Link href={tabHref("explore", activeState.activeListId)} replace onClick={() => prepareRootNavigation("explore")} className="topbar-brand topbar-default-brand" aria-label="Munchbase home">
              <Utensils size={18} />
              <h2>Munchbase</h2>
            </Link>
            <h2 className="desktop-page-title">
              {activeTab === "explore" ? "Explore" : activeTab === "map" ? "Map" : activeTab === "checkins" ? "Check-ins" : "Lists"}
            </h2>
            {selectedEntryId ? (
              <button type="button" className="topbar-brand topbar-restaurant-back" onClick={backFromRestaurant}>
                <ChevronLeft size={18} />
                <h2>{initialEntryEdit ? "Restaurant" : selectedEntryOrigin === "map" ? "Map" : selectedEntryOrigin === "checkins" ? "Check-ins" : "Explore"}</h2>
              </button>
            ) : null}
          </div>
          <div className="top-actions">
            <div className="mode-toggle">
              <button className={activeTab === "explore" ? "active" : ""} onClick={() => navigateRoot("explore")}>
                <ClipboardList size={16} /> Explore
              </button>
              <button className={activeTab === "map" ? "active" : ""} onClick={() => navigateRoot("map")}>
                <Map size={16} /> Map
              </button>
              <button className={activeTab === "checkins" ? "active" : ""} onClick={() => navigateRoot("checkins")}>
                <CalendarClock size={16} /> Check-ins
              </button>
            </div>
            <div className="user-menu-wrap" ref={userMenuRef}>
              <button
                type="button"
                className="ghost-button icon-button user-menu-button"
                onClick={() => setUserMenuOpen((open) => !open)}
                aria-label="User menu"
                aria-expanded={userMenuOpen}
              >
                <User size={18} />
              </button>
              {userMenuOpen ? (
                <div className="user-menu" role="menu">
                  <div className="user-menu-head">
                    <strong>{activeState.user.name}</strong>
                    <span>{activeState.user.role}</span>
                  </div>
                  <ThemePicker choice={theme.choice} onChange={theme.setChoice} />
                  {activeState.user.role === "admin" ? (
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => {
                        openAdmin();
                      }}
                    >
                      <Shield size={16} /> Admin
                    </button>
                  ) : null}
                  <form action="/logout" method="post">
                    <button className="ghost-button">
                      <LogOut size={16} /> Sign out
                    </button>
                  </form>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        {settingsOpen ? (
          <section className="mobile-detail-view">
            <ListSettingsPanel state={activeState} onClose={closeSettings} />
          </section>
        ) : selectedEntry ? (
          <section className="mobile-detail-view">
            <RestaurantDetailPane
              restaurant={selectedEntry}
              state={activeState}
              canWrite={canWrite}
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
              <header className="lists-page-header">
                <div>
                  <p className="kicker">Your restaurant collections</p>
                  <h2>Lists</h2>
                  <p>Choose a list to explore it, or open its settings to customize attributes.</p>
                </div>
              </header>
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
                activeListName={activeListName}
                onOpenRestaurant={() => {
                  rememberRootScroll("checkins");
                  restaurantOpenedInAppRef.current = true;
                }}
              />
              <section className="detail">
                {selectedEntry ? (
                  <RestaurantDetailPane
                    restaurant={selectedEntry}
                    state={activeState}
                    canWrite={canWrite}
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
              hasDetail={Boolean(selectedEntry || settingsOpen)}
              addOpen={addOpen}
              onOpenAdd={openAdd}
              onSelectRestaurant={selectEntry}
              onSelectFromMap={openEntryFromMap}
              detail={
                settingsOpen ? (
                  <ListSettingsPanel state={activeState} onClose={closeSettings} />
                ) : selectedEntry ? (
                  <RestaurantDetailPane
                    restaurant={selectedEntry}
                    state={activeState}
                    canWrite={canWrite}
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

      {canWrite ? (
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
          onOpenRestaurant={(id) => router.replace(restaurantHref(id, activeState.activeListId, { origin: "explore" }), { scroll: false })}
        />
      ) : null}

      {adminOpen ? <AdminDrawer state={activeState} onClose={closeAdmin} /> : null}
      {addListOpen ? (
        <AddListModal
          state={activeState}
          step={activeAddListStep}
          onStepChange={setAddListStep}
          onBackStep={() => router.back()}
          onClose={closeAddList}
        />
      ) : null}
      <InstallPrompt />
      {children ? <span hidden>{children}</span> : null}
    </main>
  );
}
