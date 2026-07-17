"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  CalendarClock,
  ClipboardList,
  Filter,
  Map,
  LogOut,
  Monitor,
  Plus,
  Search,
  Shield,
  User,
  Utensils,
  X,
} from "lucide-react";
import { SidebarContent } from "@/components/layout/sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { AddRestaurantsPanel } from "@/components/search/add-restaurants";
import { AddRestaurantSheet } from "@/components/search/add-restaurant-sheet";
import { ListSettingsPanel } from "@/components/lists/list-settings";
import { AddListModal } from "@/components/lists/add-list-modal";
import { AdminDrawer } from "@/components/admin/admin-panel";
import { CheckInFeed } from "@/components/checkins/check-in-feed";
import { RestaurantDetail } from "@/components/restaurant/restaurant-detail";
import { RatingBadge } from "@/components/restaurant/rating-badge";
import { NetworkStatus } from "@/components/shared/network-status";
import { InstallPrompt } from "@/components/shared/install-prompt";
import { EmptyState } from "@/components/shared/empty-state";
import { useHaptics } from "@/hooks/use-haptics";
import { useTheme, type ThemeChoice } from "@/hooks/use-theme";
import { formatCityState } from "@/lib/address";
import { readCachedLocation, writeCachedLocation } from "@/lib/location-cache";
import { cacheAppState, cacheLists, cacheRestaurants } from "@/lib/offline-db";
import {
  addHref,
  addListHref,
  addListStep,
  listSettingsHref,
  restaurantHref,
  restaurantOrigin,
  restaurantOriginHref,
  tabHref,
  type BottomTab,
  type RestaurantOrigin,
} from "@/lib/routes";
import { submitMutation } from "@/lib/mutation-client";
import type { AppState, RatingDefinition } from "@/lib/types";

const MapView = dynamic(() => import("@/components/map-view"), { ssr: false });

type PlaceResult = {
  osmType: string;
  osmId: string;
  name: string;
  address: string;
  lat: string;
  lon: string;
  rawJson: string;
};

const NEARBY_RADIUS_MILES = 5;

function distanceMiles(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number },
) {
  const toRadians = (degrees: number) => degrees * (Math.PI / 180);
  const latitudeDelta = toRadians(to.lat - from.lat);
  const longitudeDelta = toRadians(to.lon - from.lon);
  const fromLatitude = toRadians(from.lat);
  const toLatitude = toRadians(to.lat);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function formatDistance(miles: number) {
  return miles < 0.1 ? "< 0.1 mi" : `${miles.toFixed(miles < 10 ? 1 : 0)} mi`;
}

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
  const [query, setQuery] = useState("");
  const [filterDefinition, setFilterDefinition] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([]);
  const [placeSearchStatus, setPlaceSearchStatus] = useState("");
  const [searchGlobal, setSearchGlobal] = useState(false);
  const [nearbyResults, setNearbyResults] = useState<PlaceResult[]>([]);
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const scrollPositionsRef = useRef(new globalThis.Map<string, number>());
  const pendingRootRestoreRef = useRef<string | null>(null);
  const restaurantOpenedInAppRef = useRef(false);
  const settingsOpenedInAppRef = useRef(false);
  const addOpenedInAppRef = useRef(false);
  const addListOpenedInAppRef = useRef(false);
  const adminOpenedInAppRef = useRef(false);
  const photoOpenedInAppRef = useRef(false);
  const editHasPreviewRef = useRef(false);
  const editOpenedFromPreviewRef = useRef(false);
  const pendingEditRefreshRef = useRef(false);
  const previousSelectedEntryRef = useRef<number | null>(null);
  const canWrite = true;

  const routeListId = Number(searchParams.get("list"));
  const settingsListMatch = pathname.match(/^\/lists\/(\d+)\/settings$/);
  const settingsListId = settingsListMatch ? Number(settingsListMatch[1]) : null;
  const activeListId = settingsListId ?? (Number.isInteger(routeListId) && routeListId > 0 ? routeListId : null);
  const activeList = activeListId ? (state.lists.find((list) => list.id === activeListId) ?? null) : null;
  const selectedEntryId = Number(pathname.match(/^\/restaurants\/(\d+)$/)?.[1] ?? "") || null;
  const initialEntryEdit = searchParams.get("edit") === "1";
  const settingsOpen = pathname === "/lists/settings" || /^\/lists\/\d+\/settings$/.test(pathname);
  const addOpen = pathname.startsWith("/add");
  const selectedEntryOrigin = restaurantOrigin(searchParams.get("from"));
  const adminOpen = state.user.role === "admin" && searchParams.get("overlay") === "admin";
  const addListOpen = pathname === "/lists" && searchParams.get("overlay") === "add-list";
  const activeAddListStep = addListStep(searchParams.get("step"));
  const activePhotoId = Number(searchParams.get("photo")) || null;
  const activeTab: BottomTab = selectedEntryId
    ? selectedEntryOrigin
    : pathname.startsWith("/check-ins")
      ? "checkins"
    : pathname.startsWith("/map")
      ? "map"
      : pathname.startsWith("/lists")
        ? "lists"
        : "explore";

  useEffect(() => {
    setFiltersOpen(false);
  }, [activeTab]);

  useEffect(() => {
    const previousId = previousSelectedEntryRef.current;
    if (selectedEntryId && previousId !== selectedEntryId) {
      window.scrollTo({ top: 0, left: 0 });
    } else if (!selectedEntryId && previousId) {
      const rootHref = tabHref(activeTab, activeListId);
      const top = scrollPositionsRef.current.get(rootHref);
      if (top !== undefined) window.requestAnimationFrame(() => window.scrollTo({ top, left: 0 }));
      restaurantOpenedInAppRef.current = false;
      editHasPreviewRef.current = false;
      photoOpenedInAppRef.current = false;
    }
    previousSelectedEntryRef.current = selectedEntryId;
  }, [activeListId, activeTab, selectedEntryId]);

  useEffect(() => {
    if (!settingsOpen) settingsOpenedInAppRef.current = false;
    if (!adminOpen) adminOpenedInAppRef.current = false;
    if (!addListOpen) addListOpenedInAppRef.current = false;
  }, [addListOpen, adminOpen, settingsOpen]);

  useEffect(() => {
    if (selectedEntryId || !pendingRootRestoreRef.current) return;
    const href = pendingRootRestoreRef.current;
    pendingRootRestoreRef.current = null;
    const top = scrollPositionsRef.current.get(href) ?? 0;
    window.requestAnimationFrame(() => window.scrollTo({ top, left: 0 }));
  }, [activeListId, activeTab, selectedEntryId]);

  useEffect(() => {
    // Write-through cache: keep the last successfully-loaded server state in
    // IndexedDB so a future offline session has something to fall back to.
    void cacheAppState("latest", state);
    void cacheRestaurants(state.allRestaurants);
    void cacheLists(state.lists);
  }, [state]);

  useEffect(() => {
    // Seed from cache immediately so location is available before GPS resolves.
    const cached = readCachedLocation();
    if (cached) setLocationCoords(cached);
    // Then refresh in the background on every app load — standard "find nearby" pattern.
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        writeCachedLocation(coords.lat, coords.lon);
        setLocationCoords(coords);
      },
      () => {},
      { maximumAge: 5 * 60 * 1000, timeout: 15000 },
    );
  }, []);

  useEffect(() => {
    if (!addOpen || !locationCoords) return;
    const { lat, lon } = locationCoords;
    fetch(`/api/search?nearby=1&lat=${lat}&lon=${lon}`)
      .then((r) => r.json())
      .then((data: { results?: PlaceResult[] }) => setNearbyResults(data.results ?? []))
      .catch(() => {});
  }, [addOpen, locationCoords]);

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

  useEffect(() => {
    if (!filtersOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFiltersOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [filtersOpen]);

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

  const rememberRootScroll = (origin: RestaurantOrigin) => {
    scrollPositionsRef.current.set(tabHref(origin, activeState.activeListId), window.scrollY);
  };

  const prepareRootNavigation = (tab: BottomTab, listId = activeState.activeListId) => {
    if (!selectedEntryId) {
      scrollPositionsRef.current.set(tabHref(activeTab, activeState.activeListId), window.scrollY);
    }
    pendingRootRestoreRef.current = tabHref(tab, listId);
  };

  const navigateRoot = (tab: BottomTab) => {
    prepareRootNavigation(tab);
    router.replace(tabHref(tab, activeState.activeListId), { scroll: false });
  };

  const openRestaurant = (id: number, origin: RestaurantOrigin, replace = false) => {
    rememberRootScroll(origin);
    restaurantOpenedInAppRef.current = true;
    const href = restaurantHref(id, activeState.activeListId, { origin });
    if (replace) router.replace(href, { scroll: false });
    else router.push(href, { scroll: false });
  };

  const selectEntry = (id: number | null) => {
    haptics.light();
    if (id !== null) {
      openRestaurant(id, "explore", selectedEntryId !== null);
    }
  };

  const openEntryFromMap = (id: number) => {
    openRestaurant(id, "map", selectedEntryId !== null);
  };

  const restaurants = useMemo(() => {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const needle = normalize(query);
    const needleTokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean).map(normalize).filter(Boolean);
    return activeState.restaurants.filter((r) => {
      const raw = [r.name, r.address, r.notes].filter(Boolean).join(" ");
      const haystack = normalize(raw);
      const haystackTokens = raw.toLowerCase().split(/\s+/).filter(Boolean).map(normalize).filter(Boolean);
      const textMatch = !needle ||
        haystack.includes(needle) ||
        needleTokens.every((nw) => haystackTokens.some((hw) => hw.includes(nw)));
      const ratingMatch =
        !filterDefinition ||
        !filterValue ||
        r.ratings.some((rating) => String(rating.definitionId) === filterDefinition && rating.value === filterValue);
      return textMatch && ratingMatch;
    }).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }, [activeState.restaurants, filterDefinition, filterValue, query]);

  const restaurantDistances = useMemo(() => {
    const distances = new globalThis.Map<number, number>();
    if (!locationCoords) return distances;
    restaurants.forEach((restaurant) => {
      if (restaurant.lat !== null && restaurant.lon !== null) {
        distances.set(
          restaurant.id,
          distanceMiles(locationCoords, { lat: restaurant.lat, lon: restaurant.lon }),
        );
      }
    });
    return distances;
  }, [locationCoords, restaurants]);

  const nearbyRestaurants = useMemo(
    () => restaurants
      .filter((restaurant) => (restaurantDistances.get(restaurant.id) ?? Number.POSITIVE_INFINITY) <= NEARBY_RADIUS_MILES)
      .sort((a, b) =>
        (restaurantDistances.get(a.id) ?? 0) - (restaurantDistances.get(b.id) ?? 0) ||
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      ),
    [restaurantDistances, restaurants],
  );

  const otherRestaurants = useMemo(() => {
    const nearbyIds = new Set(nearbyRestaurants.map((restaurant) => restaurant.id));
    return restaurants.filter((restaurant) => !nearbyIds.has(restaurant.id));
  }, [nearbyRestaurants, restaurants]);

  const selectedEntry =
    activeState.allRestaurants.find((r) => r.id === selectedEntryId) ?? null;
  const selectedFilterDefinition = activeDefinitions.find((d) => String(d.id) === filterDefinition);

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

  const previousAddOpenRef = useRef(addOpen);
  useEffect(() => {
    if (previousAddOpenRef.current && !addOpen) {
      setPlaceQuery("");
      setPlaceResults([]);
      setPlaceSearchStatus("");
      setSearchGlobal(false);
      addOpenedInAppRef.current = false;
    }
    previousAddOpenRef.current = addOpen;
  }, [addOpen]);

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
  });

  async function searchPlaces(e?: FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    if (placeQuery.trim().length < 3) {
      setPlaceSearchStatus("Type at least 3 characters.");
      return;
    }
    setPlaceSearchStatus("Searching...");
    const params = new URLSearchParams({ q: placeQuery });
    if (locationCoords) {
      params.set("lat", String(locationCoords.lat));
      params.set("lon", String(locationCoords.lon));
    }
    if (searchGlobal) {
      params.set("global", "1");
    }
    const response = await fetch(`/api/search?${params.toString()}`);
    const data = (await response.json()) as { results?: PlaceResult[]; error?: string };
    if (data.error) {
      setPlaceSearchStatus(data.error);
      setPlaceResults([]);
      return;
    }
    setPlaceResults(data.results ?? []);
    setPlaceSearchStatus(data.results?.length ? `${data.results.length} places found.` : "No places found.");
  }

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

  const openListSettings = (listId: number | null) => {
    settingsOpenedInAppRef.current = true;
    router.push(listSettingsHref(listId), { scroll: false });
  };

  const closeSettings = () => {
    if (settingsOpenedInAppRef.current) router.back();
    else router.replace(tabHref("lists", activeState.activeListId), { scroll: false });
  };

  const closeAdd = useCallback(() => {
    setPlaceQuery("");
    setPlaceResults([]);
    setPlaceSearchStatus("");
    setSearchGlobal(false);
    if (addOpenedInAppRef.current) router.back();
    else router.replace(tabHref("explore", activeState.activeListId), { scroll: false });
  }, [activeState.activeListId, router]);

  const openAdmin = () => {
    adminOpenedInAppRef.current = true;
    router.push(hrefWithParams({ overlay: "admin" }), { scroll: false });
    setUserMenuOpen(false);
  };

  const closeAdmin = () => {
    if (!adminOpen) return;
    if (adminOpenedInAppRef.current) router.back();
    else router.replace(hrefWithParams({ overlay: null }), { scroll: false });
  };

  const openAddList = () => {
    addListOpenedInAppRef.current = true;
    router.push(addListHref(activeState.activeListId, "details"), { scroll: false });
  };

  const closeAddList = () => {
    if (!addListOpen) return;
    if (addListOpenedInAppRef.current) {
      const depth = activeAddListStep === "restaurants" ? 3 : activeAddListStep === "fields" ? 2 : 1;
      window.history.go(-depth);
    } else {
      router.replace(tabHref("lists", activeState.activeListId), { scroll: false });
    }
  };

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

  const openPhoto = (photoId: number) => {
    photoOpenedInAppRef.current = true;
    router.push(hrefWithParams({ photo: String(photoId) }), { scroll: false });
  };

  const selectPhoto = (photoId: number) => {
    router.replace(hrefWithParams({ photo: String(photoId) }), { scroll: false });
  };

  const closePhoto = () => {
    if (!activePhotoId) return;
    if (photoOpenedInAppRef.current) router.back();
    else router.replace(hrefWithParams({ photo: null }), { scroll: false });
  };

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
        const depth = activeAddListStep === "restaurants" ? 3 : activeAddListStep === "fields" ? 2 : 1;
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
          showBrand={activeTab !== "lists"}
        />
      </aside>

      <section className="workbench">
        {mutationMessage ? (
          <p className="mutation-error" role="alert">
            {mutationMessage}
          </p>
        ) : null}
        <header className="topbar">
          <div className="topbar-title">
            <Link href={tabHref("explore", activeState.activeListId)} replace onClick={() => prepareRootNavigation("explore")} className="topbar-brand" aria-label="Munchbase home">
              <Utensils size={18} />
              <h2>Munchbase</h2>
            </Link>
          </div>
          <div className="top-actions">
            <div className="mode-toggle">
              <button className={activeTab === "explore" ? "active" : ""} onClick={() => navigateRoot("explore")}>
                <ClipboardList size={16} /> List
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
            <RestaurantDetail
              key={`${selectedEntry.id}:${initialEntryEdit ? "edit" : "view"}`}
              canWrite={canWrite}
              entry={selectedEntry}
              activeListId={activeState.activeListId}
              lists={activeState.lists}
              globalRatingDefinitions={activeState.globalRatingDefinitions}
              ratingDefinitions={activeState.ratingDefinitions}
              allRatingDefinitions={activeState.allRatingDefinitions}
              noteSections={activeState.noteSections}
              initialEdit={initialEntryEdit}
              onBack={backFromRestaurant}
              backLabel={selectedEntryOrigin === "map" ? "Map" : selectedEntryOrigin === "checkins" ? "Check-ins" : "Explore"}
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
            <div className="content-grid checkin-content-grid">
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
                  <RestaurantDetail
                    key={`${selectedEntry.id}:${initialEntryEdit ? "edit" : "view"}`}
                    canWrite={canWrite}
                    entry={selectedEntry}
                    activeListId={activeState.activeListId}
                    lists={activeState.lists}
                    globalRatingDefinitions={activeState.globalRatingDefinitions}
                    ratingDefinitions={activeState.ratingDefinitions}
                    allRatingDefinitions={activeState.allRatingDefinitions}
                    noteSections={activeState.noteSections}
                    initialEdit={initialEntryEdit}
                    onBack={backFromRestaurant}
                    backLabel="Check-ins"
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
            <>
            <div className="toolbar">
              <label className="search-box">
                <span className="sr-only">Search restaurants</span>
                <Search size={17} />
                <input
                  type="search"
                  aria-label="Search restaurants"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search restaurants, notes, tips"
                />
              </label>
              <button
                type="button"
                className={`filter-toggle ${filterDefinition ? "active" : ""}`}
                onClick={() => setFiltersOpen((open) => !open)}
                aria-label={filterDefinition ? "Open active Explore filters" : "Open Explore filters"}
                aria-expanded={filtersOpen}
                aria-controls="explore-filters"
              >
                <Filter size={16} />
                <span>{filterDefinition ? "Filtered" : "Filter"}</span>
              </button>
              <button
                type="button"
                className="add-restaurant-trigger"
                onClick={() => {
                  addOpenedInAppRef.current = true;
                  router.push(addHref(activeState.activeListId), { scroll: false });
                }}
                aria-label="Add restaurant"
                aria-expanded={addOpen}
                aria-controls="add-restaurant-sheet"
              >
                <Plus size={17} />
                <span>Add</span>
              </button>
            </div>
            {filtersOpen ? (
              <section className="filter-panel" id="explore-filters" aria-label="Explore filters">
                <div className="filter-panel-head">
                  <h3>Filter by ratings</h3>
                  <div className="filter-panel-actions">
                    {filterDefinition ? (
                      <button
                        type="button"
                        className="ghost-button compact-button"
                        onClick={() => { setFilterDefinition(""); setFilterValue(""); }}
                      >
                        Clear
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="ghost-button icon-button"
                      onClick={() => setFiltersOpen(false)}
                      aria-label="Close filters"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
                <label>
                  <span>Attribute</span>
                  <select
                    value={filterDefinition}
                    onChange={(e) => {
                      setFilterDefinition(e.target.value);
                      setFilterValue("");
                    }}
                  >
                    <option value="">Any rating</option>
                    {activeDefinitions.filter((d) => d.active).map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </label>
                {selectedFilterDefinition ? (
                  <label>
                    <span>Value</span>
                    <select value={filterValue} onChange={(e) => setFilterValue(e.target.value)}>
                      <option value="">Choose value</option>
                      <RatingFilterOptions definition={selectedFilterDefinition} />
                    </select>
                  </label>
                ) : null}
              </section>
            ) : filterDefinition && selectedFilterDefinition ? (
              <button
                type="button"
                className="active-filter-chip"
                onClick={() => setFiltersOpen(true)}
              >
                <Filter size={13} />
                {selectedFilterDefinition.name}
                {filterValue ? `: ${filterValue}` : ""}
              </button>
            ) : null}

            {activeTab === "map" ? (
          <MapView
            restaurants={restaurants}
            globalRatingDefinitions={activeState.globalRatingDefinitions}
            goBackDefinitionId={activeState.globalRatingDefinitions.find((d) => d.presetKey === "go_back" && d.active)?.id ?? null}
            onSelectRestaurant={openEntryFromMap}
          />
        ) : (
          <div className="content-grid">
            <section className="results">
              <h3 className="results-heading">{activeListName}</h3>
              {restaurants.length === 0 ? (
                <EmptyState
                  icon={<ClipboardList size={32} />}
                  title={query || filterDefinition ? "No restaurants match your search." : "No restaurants yet."}
                  description={query || filterDefinition ? "Try adjusting your search or filters." : "Add your first restaurant to get started."}
                  action={query || filterDefinition ? (
                    <button className="ghost-button" style={{ width: "auto" }} onClick={() => { setQuery(""); setFilterDefinition(""); setFilterValue(""); }}>
                      Clear filters
                    </button>
                  ) : undefined}
                />
              ) : (
                (locationCoords && nearbyRestaurants.length > 0
                  ? [
                      { label: "Nearby", detail: `Within ${NEARBY_RADIUS_MILES} miles`, restaurants: nearbyRestaurants, showDistance: true },
                      ...(otherRestaurants.length > 0
                        ? [{ label: "More restaurants", detail: "A–Z", restaurants: otherRestaurants, showDistance: false }]
                        : []),
                    ]
                  : [{
                      label: "All restaurants",
                      detail: locationCoords ? `None within ${NEARBY_RADIUS_MILES} miles · A–Z` : "A–Z",
                      restaurants,
                      showDistance: false,
                    }]
                ).map((section) => (
                  <div className="restaurant-section" key={section.label}>
                    <div className="restaurant-section-heading">
                      <strong>{section.label}</strong>
                      <span>{section.detail}</span>
                    </div>
                    {section.restaurants.map((rst) => {
                const globalRatingIcons = activeState.globalRatingDefinitions.filter((d) => d.active).map((d) => {
                  const rating = rst.ratings.find((r) => r.definitionId === d.id);
                  if (!rating?.value && d.presetKey !== "go_back") return null;
                  return <RatingBadge key={d.id} definition={d} value={rating?.value ?? ""} />;
                });
                const listRatingIcons = activeState.ratingDefinitions.filter((d) => d.active).map((d) => {
                  const rating = rst.ratings.find((r) => r.definitionId === d.id);
                  if (!rating?.value) return null;
                  return <RatingBadge key={d.id} definition={d} value={rating?.value ?? ""} />;
                });
                return (
                    <button
                      key={rst.id}
                      className={`restaurant-row ${selectedEntry?.id === rst.id ? "active" : ""}`}
                      onClick={() => selectEntry(rst.id)}
                    >
                      <span>
                        <span className="restaurant-row-top">
                          <strong>{rst.name}</strong>
                        </span>
                        <small>{formatCityState(rst.address) || rst.address}</small>
                        {globalRatingIcons.some((i) => i) ? <span className="rating-icons">{globalRatingIcons}</span> : null}
                        {listRatingIcons.some((i) => i) ? <span className="rating-icons">{listRatingIcons}</span> : null}
                      </span>
                      <span className="restaurant-row-meta">
                        {section.showDistance ? (
                          <strong>{formatDistance(restaurantDistances.get(rst.id) ?? 0)}</strong>
                        ) : null}
                        {rst.checkInCount ? (
                          <span>{`${rst.checkInCount} visit${rst.checkInCount === 1 ? "" : "s"}`}</span>
                        ) : null}
                      </span>
                    </button>
                );
                    })}
                  </div>
                ))
              )}
            </section>
            <section className="detail">
              {settingsOpen ? (
                <ListSettingsPanel state={activeState} onClose={closeSettings} />
              ) : selectedEntry ? (
                <RestaurantDetail
                  key={`${selectedEntry.id}:${initialEntryEdit ? "edit" : "view"}`}
                  canWrite={canWrite}
                  entry={selectedEntry}
                  activeListId={activeState.activeListId}
                  lists={activeState.lists}
                  globalRatingDefinitions={activeState.globalRatingDefinitions}
                  ratingDefinitions={activeState.ratingDefinitions}
                  allRatingDefinitions={activeState.allRatingDefinitions}
                  noteSections={activeState.noteSections}
                  initialEdit={initialEntryEdit}
                  onBack={backFromRestaurant}
                  backLabel={selectedEntryOrigin === "map" ? "Map" : selectedEntryOrigin === "checkins" ? "Check-ins" : "Explore"}
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
              )}
            </section>
          </div>
        )}
            </>
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
            placeQuery={placeQuery}
            setPlaceQuery={setPlaceQuery}
            placeResults={placeResults}
            nearbyResults={nearbyResults}
            placeSearchStatus={placeSearchStatus}
            searchPlaces={searchPlaces}
            searchGlobal={searchGlobal}
            setSearchGlobal={setSearchGlobal}
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
          placeQuery={placeQuery}
          setPlaceQuery={setPlaceQuery}
          placeResults={placeResults}
          nearbyResults={nearbyResults}
          placeSearchStatus={placeSearchStatus}
          searchPlaces={searchPlaces}
          searchGlobal={searchGlobal}
          setSearchGlobal={setSearchGlobal}
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

function ThemePicker({
  choice,
  onChange,
}: {
  choice: ThemeChoice;
  onChange: (choice: ThemeChoice) => void;
}) {
  const options: Array<{ value: ThemeChoice; label: string; swatches: string[] }> = [
    { value: "system", label: "Auto", swatches: ["#f8f8f2", "#bd93f9", "#282a36", "#ff79c6"] },
    { value: "light", label: "Light", swatches: ["#f8f8f2", "#e6e6dc", "#bd93f9"] },
    { value: "dark", label: "Dark", swatches: ["#1e2029", "#282a36", "#ff79c6"] },
    { value: "lavender", label: "Lavender", swatches: ["#f5f5ff", "#ededff", "#9fa1ff"] },
    { value: "lavender-dark", label: "Lavender Dark", swatches: ["#0d0b1e", "#151232", "#b5baff"] },
    { value: "rose", label: "Rose", swatches: ["#ffe5ec", "#ffc2d1", "#fb6f92"] },
    { value: "rose-dark", label: "Rose Dark", swatches: ["#190812", "#3a1020", "#fb6f92"] },
  ];

  return (
    <div className="theme-picker" role="group" aria-label="Theme">
      <span>Theme</span>
      <div className="theme-picker-options">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={choice === option.value ? "active" : ""}
            aria-pressed={choice === option.value}
            onClick={() => onChange(option.value)}
          >
            <span className="theme-swatch" aria-hidden="true">
              {option.swatches.map((color, i) => (
                <span key={i} style={{ background: color }} />
              ))}
            </span>
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function RatingFilterOptions({ definition }: { definition?: RatingDefinition }) {
  if (!definition) return null;
  if (definition.type === "boolean") {
    return (
      <>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </>
    );
  }
  if (definition.type === "choice") {
    return definition.options.map((o) => (<option key={o} value={o}>{o}</option>));
  }
  const options = [];
  for (let v = definition.min ?? 1; v <= (definition.max ?? 5); v += 1) {
    options.push(<option key={v} value={v}>{v}</option>);
  }
  return options;
}

