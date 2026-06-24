"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ClipboardList,
  Filter,
  Map,
  LogOut,
  Monitor,
  Search,
  Shield,
  User,
  Utensils,
  X,
} from "lucide-react";
import { SidebarContent } from "@/components/layout/sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { AddRestaurantsPanel } from "@/components/search/add-restaurants";
import { ListSettingsDrawer } from "@/components/lists/list-settings";
import { AddListModal } from "@/components/lists/add-list-modal";
import { AdminDrawer } from "@/components/admin/admin-panel";
import { RestaurantDetail } from "@/components/restaurant/restaurant-detail";
import { RatingBadge } from "@/components/restaurant/rating-badge";
import { NetworkStatus } from "@/components/shared/network-status";
import { InstallPrompt } from "@/components/shared/install-prompt";
import { EmptyState } from "@/components/shared/empty-state";
import { useHaptics } from "@/hooks/use-haptics";
import { useTheme, type ThemeChoice } from "@/hooks/use-theme";
import { formatCityState } from "@/lib/address";
import { listSettingsHref, restaurantHref, tabHref, type BottomTab } from "@/lib/routes";
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
  const [useCurrentLocation, setUseCurrentLocation] = useState(false);
  const [locationStatus, setLocationStatus] = useState("");
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [addListOpen, setAddListOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const canWrite = true;

  const routeListId = Number(searchParams.get("list"));
  const settingsListMatch = pathname.match(/^\/lists\/(\d+)\/settings$/);
  const settingsListId = settingsListMatch ? Number(settingsListMatch[1]) : null;
  const activeListId = settingsListId ?? (Number.isInteger(routeListId) && routeListId > 0 ? routeListId : null);
  const activeList = activeListId ? (state.lists.find((list) => list.id === activeListId) ?? null) : null;
  const selectedEntryId = Number(pathname.match(/^\/restaurants\/(\d+)$/)?.[1] ?? "") || null;
  const initialEntryEdit = searchParams.get("edit") === "1";
  const settingsOpen = pathname === "/lists/settings" || /^\/lists\/\d+\/settings$/.test(pathname);
  const activeTab: BottomTab = pathname.startsWith("/map")
    ? "map"
    : pathname.startsWith("/lists")
      ? "lists"
      : pathname.startsWith("/add")
        ? "add"
        : "list";

  useEffect(() => {
    if (selectedEntryId) {
      window.scrollTo({ top: 0, left: 0 });
    }
  }, [selectedEntryId]);

  useEffect(() => {
    if (!userMenuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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

  const selectEntry = (id: number | null) => {
    haptics.light();
    if (id !== null) {
      router.push(restaurantHref(id, activeState.activeListId, false));
    }
  };

  const openEntryFromMap = (id: number) => {
    router.push(restaurantHref(id, activeState.activeListId, false));
  };

  const restaurants = useMemo(() => {
    const needle = query.toLowerCase();
    return activeState.restaurants.filter((r) => {
      const haystack = [r.name, r.address, r.standingNotes, r.favoriteItems, r.orderingTips]
        .filter(Boolean).join(" ").toLowerCase();
      const textMatch = !needle || haystack.includes(needle);
      const ratingMatch =
        !filterDefinition ||
        !filterValue ||
        r.ratings.some((rating) => String(rating.definitionId) === filterDefinition && rating.value === filterValue);
      return textMatch && ratingMatch;
    });
  }, [activeState.restaurants, filterDefinition, filterValue, query]);

  const selectedEntry =
    activeState.allRestaurants.find((r) => r.id === selectedEntryId) ?? null;
  const selectedFilterDefinition = activeDefinitions.find((d) => String(d.id) === filterDefinition);

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
    setLocationStatus("");
    const params = new URLSearchParams({ q: placeQuery });
    if (useCurrentLocation) {
      const coords = locationCoords ?? (await requestCurrentLocation());
      if (coords) {
        params.set("lat", String(coords.lat));
        params.set("lon", String(coords.lon));
        params.set("radiusKm", "25");
        setLocationStatus("Searching within about 25 km of your current location.");
      } else {
        setLocationStatus("Location is unavailable, so searching everywhere instead.");
      }
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

  async function requestCurrentLocation() {
    const result = await getCurrentPosition();
    if (result.ok) {
      const coords = { lat: result.position.coords.latitude, lon: result.position.coords.longitude };
      setLocationCoords(coords);
      setLocationStatus("Location ready. Searches will prefer nearby results.");
      return coords;
    }
    setLocationCoords(null);
    setLocationStatus(result.reason);
    return null;
  }

  async function handleUseCurrentLocation(value: boolean) {
    setUseCurrentLocation(value);
    if (!value) {
      setLocationCoords(null);
      setLocationStatus("");
      return;
    }
    setLocationStatus("Requesting location...");
    await requestCurrentLocation();
  }

  const activeListName = activeState.activeList?.name ?? "All restaurants";
  const mutationMessage = searchParams.get("message");

  const openListSettings = (listId: number | null) => {
    router.push(listSettingsHref(listId), { scroll: false });
  };

  const closeSettings = () => {
    router.push("/lists", { scroll: false });
  };

  return (
    <main className="app">
      <NetworkStatus />
      <aside className="sidebar">
        <SidebarContent
          state={activeState}
          canWrite={canWrite}
          onOpenAddList={() => setAddListOpen(true)}
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
            <Link href={tabHref("list", activeState.activeListId)} className="topbar-brand" aria-label="Munchbase home">
              <Utensils size={18} />
              <h2>Munchbase</h2>
            </Link>
          </div>
          <div className="top-actions">
            <div className="mode-toggle">
              <button className={activeTab === "list" ? "active" : ""} onClick={() => router.push(tabHref("list", activeState.activeListId), { scroll: false })}>
                <ClipboardList size={16} /> List
              </button>
              <button className={activeTab === "map" ? "active" : ""} onClick={() => router.push(tabHref("map", activeState.activeListId), { scroll: false })}>
                <Map size={16} /> Map
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
                        setAdminOpen(true);
                        setUserMenuOpen(false);
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

        {selectedEntry ? (
          <section className="mobile-detail-view">
            <RestaurantDetail
              key={`${selectedEntry.id}:${initialEntryEdit ? "edit" : "view"}`}
              canWrite={canWrite}
              entry={selectedEntry}
              activeListId={activeState.activeListId}
              lists={activeState.lists}
              globalRatingDefinitions={activeState.globalRatingDefinitions}
              ratingDefinitions={activeState.ratingDefinitions}
              initialEdit={initialEntryEdit}
            />
          </section>
        ) : null}

        <div className={selectedEntry ? "mobile-hidden-when-detail" : undefined}>
          {activeTab === "lists" ? (
            <section className="mobile-lists-view">
              <SidebarContent
                state={activeState}
                canWrite={canWrite}
                onOpenAddList={() => setAddListOpen(true)}
                onOpenListSettings={openListSettings}
                showAccountActions={false}
                showListSettings
                showBrand={false}
              />
            </section>
          ) : activeTab === "add" ? (
            <section className="mobile-add-view">
              <header className="mobile-page-header">
                <p className="kicker">Add restaurant</p>
                <h3>{activeState.activeList ? `Add to ${activeState.activeList.name}` : "Add to your restaurants"}</h3>
              </header>
              <AddRestaurantsPanel
                state={activeState}
                canWrite={canWrite}
                placeQuery={placeQuery}
                setPlaceQuery={setPlaceQuery}
                placeResults={placeResults}
                placeSearchStatus={placeSearchStatus}
                locationStatus={locationStatus}
                useCurrentLocation={useCurrentLocation}
                setUseCurrentLocation={handleUseCurrentLocation}
                searchPlaces={searchPlaces}
              />
            </section>
          ) : (
            <>
            <div className="toolbar">
              <label className="search-box">
                <span className="sr-only">Search restaurants</span>
                <Search size={17} />
                <input
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
          <MapView restaurants={restaurants} onSelectRestaurant={openEntryFromMap} />
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
                restaurants.map((rst) => {
                const ratingIcons = activeDefinitions.filter((d) => d.active).map((d) => {
                  const rating = rst.ratings.find((r) => r.definitionId === d.id);
                  if (!rating || !rating.value) return null;
                  return <RatingBadge key={d.id} definition={d} value={rating.value} />;
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
                          <span className="rating-icons">{ratingIcons}</span>
                        </span>
                        <small>{formatCityState(rst.address) || rst.address}</small>
                      </span>
                      <span className="meta">{rst.checkInCount ? `${rst.checkInCount} visit${rst.checkInCount === 1 ? "" : "s"}` : ""}</span>
                    </button>
                );
              })
              )}
            </section>
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
                  initialEdit={initialEntryEdit}
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
            placeSearchStatus={placeSearchStatus}
            locationStatus={locationStatus}
            useCurrentLocation={useCurrentLocation}
              setUseCurrentLocation={handleUseCurrentLocation}
            searchPlaces={searchPlaces}
          />
        </aside>
      ) : null}

      <BottomNav
        activeTab={activeTab}
        activeListId={activeState.activeListId}
      />

      {settingsOpen ? <ListSettingsDrawer state={activeState} onClose={closeSettings} /> : null}
      {adminOpen ? <AdminDrawer state={activeState} onClose={() => setAdminOpen(false)} /> : null}
      {addListOpen ? <AddListModal state={activeState} onClose={() => setAddListOpen(false)} /> : null}
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
    { value: "system", label: "Auto", swatches: ["#fff8df", "#fffdf4", "#111833", "#090c1b"] },
    { value: "light", label: "Classic", swatches: ["#fff8df", "#fffdf4", "#0055da"] },
    { value: "dark", label: "Midnight", swatches: ["#090c1b", "#111833", "#ffd400"] },
    { value: "lavender", label: "Lavender", swatches: ["#f5f5ff", "#ededff", "#9fa1ff"] },
    { value: "lavender-dark", label: "Lavender Dark", swatches: ["#0d0b1e", "#151232", "#b5baff"] },
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

function getCurrentPosition(): Promise<
  | { ok: true; position: GeolocationPosition }
  | { ok: false; reason: string }
> {
  if (typeof window === "undefined" || typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve({ ok: false, reason: "This browser does not support location search." });
  }
  if (!window.isSecureContext) {
    return Promise.resolve({ ok: false, reason: "Browser location requires HTTPS or localhost." });
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ ok: true, position }),
      (error) => {
        const reason = error.code === error.PERMISSION_DENIED
          ? "Location permission was denied."
          : "Location unavailable.";
        resolve({ ok: false, reason });
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 1000 * 60 * 10 },
    );
  });
}
