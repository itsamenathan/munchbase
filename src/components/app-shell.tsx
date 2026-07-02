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
import { ListSettingsPanel } from "@/components/lists/list-settings";
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
import { readCachedLocation, writeCachedLocation } from "@/lib/location-cache";
import { cacheAppState, cacheLists, cacheRestaurants } from "@/lib/offline-db";
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
  const [searchGlobal, setSearchGlobal] = useState(false);
  const [nearbyResults, setNearbyResults] = useState<PlaceResult[]>([]);
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
    if (activeTab !== "add" || !locationCoords) return;
    const { lat, lon } = locationCoords;
    fetch(`/api/search?nearby=1&lat=${lat}&lon=${lon}`)
      .then((r) => r.json())
      .then((data: { results?: PlaceResult[] }) => setNearbyResults(data.results ?? []))
      .catch(() => {});
  }, [activeTab, locationCoords]);

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

  const openListSettings = (listId: number | null) => {
    router.push(listSettingsHref(listId), { scroll: false });
  };

  const closeSettings = () => {
    router.push(tabHref("list", activeState.activeListId), { scroll: false });
  };

  return (
    <main className="app">
      <NetworkStatus />
      <aside className="sidebar">
        <SidebarContent
          state={activeState}
          canWrite={canWrite}
          onOpenAddList={() => setAddListOpen(true)}
          onOpenListSettings={openListSettings}
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
            />
          </section>
        ) : null}

        <div className={settingsOpen || selectedEntry ? "mobile-hidden-when-detail" : undefined}>
          {activeTab === "lists" && !settingsOpen ? (
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
              />
            </section>
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
                restaurants.map((rst) => {
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
                      <span className="meta">{rst.checkInCount ? `${rst.checkInCount} visit${rst.checkInCount === 1 ? "" : "s"}` : ""}</span>
                    </button>
                );
              })
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
          />
        </aside>
      ) : null}

      <BottomNav
        activeTab={activeTab}
        activeListId={activeState.activeListId}
      />

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
    { value: "dark", label: "Midnight", swatches: ["#090c1b", "#111833", "#e0b83c"] },
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

