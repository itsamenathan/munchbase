"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import {
  Award,
  Beer,
  CalendarClock,
  CheckCircle,
  ClipboardList,
  Cloud,
  Coffee,
  Crosshair,
  Crown,
  DollarSign,
  Filter,
  Flame,
  Frown,
  Gem,
  Heart,
  LogOut,
  Map,
  Meh,
  Menu,
  Moon,
  Pencil,
  Plus,
  Search,
  Settings,
  Shield,
  Smile,
  Star,
  Sun,
  Tag,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Undo2,
  Users,
  Utensils,
  Wine,
  X,
  XCircle,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  addRestaurant,
  createCheckIn,
  createList,
  createRatingDefinition,
  createUser,
  deleteCheckIn,
  logout,
  removeListMember,
  saveRatings,
  shareList,
  setRatingPresetEnabled,
  setUserActive,
  updateCheckIn,
  updateEntry,
  updateExternalLinks,
  updateListDetails,
  updateRatingFieldActive,
  updateSelfSignup,
} from "@/app/actions";
import { formatShortDateTime, localDateTimeInputValue } from "@/lib/datetime";
import { formatCityState } from "@/lib/address";
import { RATING_ICONS, RATING_PRESETS } from "@/lib/ratings";
import type { AppState, CheckIn, RatingDefinition, RestaurantEntry } from "@/lib/types";

const MapView = dynamic(() => import("./map-view"), { ssr: false });

const RATING_ICON_MAP: Record<string, ReactNode> = {
  star: <Star size={14} />,
  heart: <Heart size={14} />,
  "dollar-sign": <DollarSign size={14} />,
  "thumbs-up": <ThumbsUp size={14} />,
  "thumbs-down": <ThumbsDown size={14} />,
  "check-circle": <CheckCircle size={14} />,
  "x-circle": <XCircle size={14} />,
  flame: <Flame size={14} />,
  zap: <Zap size={14} />,
  award: <Award size={14} />,
  crown: <Crown size={14} />,
  gem: <Gem size={14} />,
  smile: <Smile size={14} />,
  meh: <Meh size={14} />,
  frown: <Frown size={14} />,
  coffee: <Coffee size={14} />,
  utensils: <Utensils size={14} />,
  wine: <Wine size={14} />,
  beer: <Beer size={14} />,
  moon: <Moon size={14} />,
  sun: <Sun size={14} />,
  cloud: <Cloud size={14} />,
  tag: <Tag size={14} />,
  "undo-2": <Undo2 size={14} />,
};

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
  initialEntryId,
  initialEntryEdit,
}: {
  state: AppState;
  initialEntryId: number | null;
  initialEntryEdit: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filterDefinition, setFilterDefinition] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const [mode, setMode] = useState<"list" | "map">("list");
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([]);
  const [placeSearchStatus, setPlaceSearchStatus] = useState("");
  const [useCurrentLocation, setUseCurrentLocation] = useState(true);
  const [locationStatus, setLocationStatus] = useState("");
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [listsOpen, setListsOpen] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(initialEntryId);
  const canWrite = state.activeList?.access === "owner" || state.activeList?.access === "write";

  const selectEntry = (id: number | null) => {
    setSelectedEntryId(id);
    if (id !== null) {
      const params = new URLSearchParams(window.location.search);
      params.set("entry", String(id));
      params.delete("edit");
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      router.push(newUrl, { scroll: false });
    }
  };

  const closeDetail = () => {
    setSelectedEntryId(null);
    const params = new URLSearchParams(window.location.search);
    params.delete("entry");
    params.delete("edit");
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    router.replace(newUrl, { scroll: false });
  };

  const openEntryFromMap = (id: number) => {
    selectEntry(id);
    setMode("list");
  };

  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      const entryId = params.get("entry");
      setSelectedEntryId(entryId ? Number(entryId) : null);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (!selectedEntryId || !window.matchMedia("(max-width: 760px)").matches) return;

    const scrollY = window.scrollY;
    const { body } = document;
    const previousStyle = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    };

    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";

    return () => {
      body.style.position = previousStyle.position;
      body.style.top = previousStyle.top;
      body.style.width = previousStyle.width;
      body.style.overflow = previousStyle.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [selectedEntryId]);

  const restaurants = useMemo(() => {
    const needle = query.toLowerCase();
    return state.restaurants.filter((restaurant) => {
      const haystack = [
        restaurant.name,
        restaurant.address,
        restaurant.standingNotes,
        restaurant.favoriteItems,
        restaurant.orderingTips,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const textMatch = !needle || haystack.includes(needle);
      const ratingMatch =
        !filterDefinition ||
        restaurant.ratings.some((rating) => String(rating.definitionId) === filterDefinition && rating.value === filterValue);
      return textMatch && ratingMatch;
    });
  }, [filterDefinition, filterValue, query, state.restaurants]);

  const selectedEntry =
    state.restaurants.find((restaurant) => restaurant.id === selectedEntryId) ?? null;

  async function searchPlaces(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
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

  useEffect(() => {
    if (!canWrite || !useCurrentLocation || locationCoords) return;
    void requestCurrentLocation();
  }, [canWrite, locationCoords, useCurrentLocation]);

  if (!state.activeList) {
    return (
      <main className="empty-app">
        <h1>Munchbase</h1>
        <p>Create your first restaurant list.</p>
        <CreateListForm />
      </main>
    );
  }

  return (
    <main className="app">
      <aside className="sidebar">
        <SidebarContent state={state} canWrite={canWrite} onCloseDrawer={() => setListsOpen(false)} />
      </aside>

      <section className="workbench">
        <header className="topbar">
          <div className="topbar-title">
            <button
              type="button"
              className="ghost-button icon-button hamburger-button"
              onClick={() => setListsOpen(true)}
              aria-label="Open lists menu"
            >
              <Menu size={20} />
            </button>
            <div>
              <h2>{state.activeList.name}</h2>
            </div>
          </div>
          <div className="top-actions">
            <div className="mode-toggle">
              <button className={mode === "list" ? "active" : ""} onClick={() => setMode("list")}>
                <ClipboardList size={16} /> List
              </button>
              <button className={mode === "map" ? "active" : ""} onClick={() => setMode("map")}>
                <Map size={16} /> Map
              </button>
            </div>
            {state.activeList.access === "owner" ? (
              <button className="ghost-button icon-button" onClick={() => setSettingsOpen(true)} aria-label="List settings">
                <Settings size={16} />
              </button>
            ) : null}
            {state.user.role === "admin" ? (
              <button className="ghost-button icon-button" onClick={() => setAdminOpen(true)} aria-label="Admin">
                <Shield size={16} />
              </button>
            ) : null}
          </div>
        </header>

        {canWrite ? (
          <details className="mobile-add-restaurants">
            <summary>
              <Plus size={16} />
              Add restaurant
            </summary>
            <AddRestaurantsPanel
              state={state}
              canWrite={canWrite}
              placeQuery={placeQuery}
              setPlaceQuery={setPlaceQuery}
              placeResults={placeResults}
              placeSearchStatus={placeSearchStatus}
              locationStatus={locationStatus}
              useCurrentLocation={useCurrentLocation}
              setUseCurrentLocation={setUseCurrentLocation}
              searchPlaces={searchPlaces}
            />
          </details>
        ) : null}

        <div className="toolbar">
          <label className="search-box">
            <Search size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search restaurants, notes, tips" />
          </label>
          <label>
            <Filter size={16} />
            <select value={filterDefinition} onChange={(event) => setFilterDefinition(event.target.value)}>
              <option value="">Any rating</option>
              {state.ratingDefinitions.filter((d) => d.active).map((definition) => (
                <option key={definition.id} value={definition.id}>
                  {definition.name}
                </option>
              ))}
            </select>
          </label>
          {filterDefinition ? (
            <select value={filterValue} onChange={(event) => setFilterValue(event.target.value)}>
              <RatingFilterOptions definition={state.ratingDefinitions.find((definition) => String(definition.id) === filterDefinition)} />
            </select>
          ) : null}
        </div>

        {mode === "map" ? (
          <MapView restaurants={restaurants} onSelectRestaurant={openEntryFromMap} />
        ) : (
          <div className="content-grid">
            <section className="results">
              <h3 className="results-heading">Restaurants</h3>
              {restaurants.map((restaurant) => {
                const ratingIcons = state.ratingDefinitions.filter((d) => d.active).map((definition) => {
                  const rating = restaurant.ratings.find((r) => r.definitionId === definition.id);
                  if (!rating || !rating.value) return null;
                  const presetIcon = definition.presetKey ? RATING_PRESETS.find((p) => p.key === definition.presetKey)?.icon : null;
                  const icon = (presetIcon ?? definition.icon) || "tag";
                  if (definition.presetKey === "price") {
                    return <span key={definition.id} className="rating-value price-value" title={`${definition.name}: ${rating.value}`}>{rating.value}</span>;
                  }
                  if (definition.presetKey === "stars") {
                    return <span key={definition.id} className="rating-value stars-value" title={`${definition.name}: ${rating.value}/5`}>{"\u2605".repeat(Number(rating.value))}</span>;
                  }
                  return (
                    <span key={definition.id} className="rating-icon" title={`${definition.name}: ${rating.value}`}>
                      {RATING_ICON_MAP[icon] ?? <Tag size={14} />}
                    </span>
                  );
                });
                return (
                  <button
                    key={restaurant.id}
                    className={`restaurant-row ${selectedEntry?.id === restaurant.id ? "active" : ""}`}
                    onClick={() => selectEntry(restaurant.id)}
                  >
                    <span>
                      <strong>{restaurant.name}</strong>
                      <span className="rating-icons">{ratingIcons}</span>
                      <small>{restaurant.address}</small>
                    </span>
                    <span className="meta">{restaurant.checkInCount} visits</span>
                  </button>
                );
              })}
            </section>
            <section className="detail">
              {selectedEntry ? (
                <RestaurantDetail
                  key={`${selectedEntry.id}:${initialEntryEdit ? "edit" : "view"}`}
                  canWrite={canWrite}
                  entry={selectedEntry}
                  listId={state.activeList.id}
                  ratingDefinitions={state.ratingDefinitions}
                  initialEdit={initialEntryEdit}
                />
              ) : (
                <p className="muted">Select a restaurant.</p>
              )}
            </section>
          </div>
        )}
      </section>

      {canWrite ? (
        <aside className="utility">
          <header className="utility-header">
            <p className="kicker">Add to this list</p>
            <h2>{state.activeList.name}</h2>
          </header>
          <AddRestaurantsPanel
            state={state}
            canWrite={canWrite}
            placeQuery={placeQuery}
            setPlaceQuery={setPlaceQuery}
            placeResults={placeResults}
            placeSearchStatus={placeSearchStatus}
            locationStatus={locationStatus}
            useCurrentLocation={useCurrentLocation}
            setUseCurrentLocation={setUseCurrentLocation}
            searchPlaces={searchPlaces}
          />
        </aside>
      ) : null}

      {settingsOpen ? <ListSettingsDrawer state={state} onClose={() => setSettingsOpen(false)} /> : null}
      {adminOpen ? <AdminDrawer state={state} onClose={() => setAdminOpen(false)} /> : null}

      {listsOpen ? (
        <MobileListsDrawer state={state} canWrite={canWrite} onClose={() => setListsOpen(false)} />
      ) : null}

      {selectedEntry ? (
        <MobileDetailSheet
          canWrite={canWrite}
          entry={selectedEntry}
          listId={state.activeList.id}
          ratingDefinitions={state.ratingDefinitions}
          initialEdit={initialEntryEdit}
          onClose={closeDetail}
        />
      ) : null}
    </main>
  );
}

function PanelTitle({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return (
    <div className="panel-title">
      <h3>
        {icon} {title}
      </h3>
      <p>{detail}</p>
    </div>
  );
}

function presetDescription(key: string) {
  if (key === "go_back") return "Yes/no decision for whether you would return.";
  if (key === "price") return "$ through $$$$ cost indicator.";
  if (key === "stars") return "1-5 overall score.";
  return "Preset rating field.";
}

function ListSettingsDrawer({ state, onClose }: { state: AppState; onClose: () => void }) {
  if (!state.activeList) return null;
  const memberIds = new Set(state.listMembers.map((member) => member.id));
  const shareableUsers = state.users.filter((user) => user.active && !memberIds.has(user.id));
  return (
    <div className="drawer-backdrop">
      <aside className="settings-drawer" aria-label="List settings">
        <header className="drawer-head">
          <div>
            <p className="kicker">List settings</p>
            <h2>{state.activeList.name}</h2>
          </div>
          <button className="ghost-button icon-button" onClick={onClose} aria-label="Close list settings">
            <X size={18} />
          </button>
        </header>

        <section className="settings-section">
          <PanelTitle icon={<Users size={17} />} title="Members" detail="Share this list with existing active users." />
          <div className="member-list">
            {state.listMembers.map((member) => (
              <form action={member.access === "owner" ? undefined : shareList} className="member-row" key={member.id}>
                <input type="hidden" name="listId" value={state.activeList!.id} />
                <input type="hidden" name="userId" value={member.id} />
                <div>
                  <strong>{member.name}</strong>
                  <small>
                    {member.email} {member.active ? "" : " inactive"}
                  </small>
                </div>
                {member.access === "owner" ? (
                  <span className="pill">Owner</span>
                ) : (
                  <>
                    <select name="access" defaultValue={member.access}>
                      <option value="write">Read-write</option>
                      <option value="read">Read only</option>
                    </select>
                    <button>Update</button>
                    <button className="danger-button" formAction={removeListMember}>
                      Remove
                    </button>
                  </>
                )}
              </form>
            ))}
          </div>
          <form action={shareList} className="stack-form">
            <input type="hidden" name="listId" value={state.activeList.id} />
            <select name="userId" required defaultValue="">
              <option value="" disabled>
                Add existing user
              </option>
              {shareableUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} - {user.email}
                </option>
              ))}
            </select>
            <select name="access" defaultValue="write">
              <option value="write">Read-write</option>
              <option value="read">Read only</option>
            </select>
            <button>Share list</button>
          </form>
          {!shareableUsers.length ? <p className="microcopy">No other active users are available. Add users from Admin.</p> : null}
        </section>

        <section className="settings-section">
          <PanelTitle icon={<Star size={17} />} title="Rating presets" detail="Enable common rating fields for this list." />
          <div className="preset-grid">
            {RATING_PRESETS.map((preset) => {
              const enabled = state.ratingDefinitions.some((definition) => definition.presetKey === preset.key);
              return (
                <form action={setRatingPresetEnabled} className={`preset-card ${enabled ? "enabled" : ""}`} key={preset.key}>
                  <input type="hidden" name="listId" value={state.activeList!.id} />
                  <input type="hidden" name="presetKey" value={preset.key} />
                  <input type="hidden" name="enabled" value={enabled ? "0" : "1"} />
                  <div>
                    <strong>{preset.name}</strong>
                    <small>{presetDescription(preset.key)}</small>
                  </div>
                  <button>{enabled ? "Disable" : "Enable"}</button>
                </form>
              );
            })}
          </div>
        </section>

        <section className="settings-section">
          <PanelTitle icon={<Star size={17} />} title="Custom fields" detail="Add a custom list-specific rating only when the presets do not cover it." />
          <div className="preset-grid">
            {state.ratingDefinitions
              .filter((definition) => !definition.presetKey)
              .map((definition) => (
                <form action={updateRatingFieldActive} className={`preset-card ${definition.active ? "enabled" : ""}`} key={definition.id}>
                  <input type="hidden" name="listId" value={state.activeList!.id} />
                  <input type="hidden" name="definitionId" value={definition.id} />
                  <input type="hidden" name="active" value={definition.active ? "0" : "1"} />
                  <div>
                    <strong>{definition.name}</strong>
                    <small>{definition.type}{definition.type === "choice" ? `: ${definition.options.join(", ")}` : definition.type === "scale" ? ` (${definition.min}–${definition.max})` : ""}</small>
                  </div>
                  <button>{definition.active ? "Disable" : "Enable"}</button>
                </form>
              ))}
          </div>
          <details className="manual-add">
            <summary>Add new field</summary>
            <AddCustomFieldForm listId={state.activeList.id} />
          </details>
        </section>

        <section className="settings-section">
          <PanelTitle icon={<Settings size={17} />} title="List details" detail="Rename this list or update its description." />
          <form action={updateListDetails} className="stack-form">
            <input type="hidden" name="listId" value={state.activeList.id} />
            <input name="name" defaultValue={state.activeList.name} required />
            <textarea name="description" defaultValue={state.activeList.description ?? ""} placeholder="Description" />
            <button>Save list details</button>
          </form>
        </section>
      </aside>
    </div>
  );
}

function AdminDrawer({ state, onClose }: { state: AppState; onClose: () => void }) {
  return (
    <div className="drawer-backdrop">
      <aside className="settings-drawer" aria-label="Admin settings">
        <header className="drawer-head">
          <div>
            <p className="kicker">Admin</p>
            <h2>Users and signup</h2>
          </div>
          <button className="ghost-button icon-button" onClick={onClose} aria-label="Close admin settings">
            <X size={18} />
          </button>
        </header>

        <section className="settings-section">
          <PanelTitle icon={<Shield size={17} />} title="Self-signup" detail="When enabled, anyone who can reach this site can create an account." />
          <form action={updateSelfSignup} className="inline-form">
            <select name="selfSignupEnabled" defaultValue={state.appSettings.selfSignupEnabled ? "1" : "0"}>
              <option value="0">Disabled</option>
              <option value="1">Enabled</option>
            </select>
            <button>Save</button>
          </form>
        </section>

        <section className="settings-section">
          <PanelTitle icon={<Users size={17} />} title="Create user" detail="Create an account directly, then share lists with that user from list settings." />
          <form action={createUser} className="stack-form">
            <input name="name" placeholder="Name" required />
            <input name="email" type="email" placeholder="Email" required />
            <input name="password" type="password" placeholder="Temporary password, 8+ chars" minLength={8} required />
            <select name="role" defaultValue="user">
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            <button>Create user</button>
          </form>
        </section>

        <section className="settings-section">
          <PanelTitle icon={<Users size={17} />} title="Existing users" detail="Deactivate users instead of deleting history." />
          <div className="member-list">
            {state.users.map((user) => (
              <form action={setUserActive} className="member-row" key={user.id}>
                <input type="hidden" name="userId" value={user.id} />
                <input type="hidden" name="active" value={user.active ? "0" : "1"} />
                <div>
                  <strong>{user.name}</strong>
                  <small>
                    {user.email} - {user.role}
                  </small>
                </div>
                <span className="pill">{user.active ? "Active" : "Inactive"}</span>
                {user.id === state.user.id ? null : (
                  <button className={user.active ? "danger-button" : ""}>{user.active ? "Deactivate" : "Reactivate"}</button>
                )}
              </form>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

function CreateListForm() {
  return (
    <form action={createList} className="stack-form">
      <input name="name" placeholder="New list name" required />
      <input name="description" placeholder="Description" />
      <button>Create list</button>
    </form>
  );
}

function ManualRestaurantForm({ listId }: { listId: number }) {
  return (
    <details className="manual-add">
      <summary>Manual add</summary>
      <form action={addRestaurant} className="stack-form">
        <input type="hidden" name="listId" value={listId} />
        <input name="name" placeholder="Restaurant name" required />
        <input name="address" placeholder="Address" />
        <div className="split">
          <input name="lat" placeholder="Lat" />
          <input name="lon" placeholder="Lon" />
        </div>
        <button>Add manually</button>
      </form>
    </details>
  );
}

function AddCustomFieldForm({ listId }: { listId: number }) {
  const [fieldType, setFieldType] = useState("choice");
  const [fieldIcon, setFieldIcon] = useState("tag");
  return (
    <form action={createRatingDefinition} className="stack-form">
      <input type="hidden" name="listId" value={listId} />
      <input name="name" placeholder="Rating name" required />
      <select name="type" value={fieldType} onChange={(event) => setFieldType(event.target.value)}>
        <option value="choice">Choice</option>
        <option value="scale">Scale</option>
        <option value="boolean">Yes / no</option>
      </select>
      <div className="icon-picker-row">
        <select name="icon" value={fieldIcon} onChange={(event) => setFieldIcon(event.target.value)}>
          {RATING_ICONS.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <span className="icon-preview">{RATING_ICON_MAP[fieldIcon] ?? <Tag size={14} />}</span>
      </div>
      {fieldType === "choice" ? (
        <input name="options" placeholder="Choice options, comma separated" />
      ) : null}
      {fieldType === "scale" ? (
        <div className="split">
          <input name="min" type="number" placeholder="Min" defaultValue={1} />
          <input name="max" type="number" placeholder="Max" defaultValue={5} />
        </div>
      ) : null}
      <button>Add custom field</button>
    </form>
  );
}

function SidebarContent({
  state,
  canWrite,
  onCloseDrawer,
}: {
  state: AppState;
  canWrite: boolean;
  onCloseDrawer?: () => void;
}) {
  return (
    <>
      <div className="brand">
        <Utensils size={24} />
        <div>
          <h1>Munchbase</h1>
          <p>{state.user.name}</p>
        </div>
      </div>
      <nav className="list-nav">
        {state.lists.map((list) => (
          <a
            key={list.id}
            className={list.id === state.activeList?.id ? "active" : ""}
            href={`/?list=${list.id}`}
            onClick={onCloseDrawer}
          >
            {list.name}
            <span>{list.access}</span>
          </a>
        ))}
      </nav>
      <CreateListForm />
      <form action={logout}>
        <button className="ghost-button">
          <LogOut size={16} /> Sign out
        </button>
      </form>
    </>
  );
}

function AddRestaurantsPanel({
  state,
  canWrite,
  placeQuery,
  setPlaceQuery,
  placeResults,
  placeSearchStatus,
  locationStatus,
  useCurrentLocation,
  setUseCurrentLocation,
  searchPlaces,
}: {
  state: AppState;
  canWrite: boolean;
  placeQuery: string;
  setPlaceQuery: (value: string) => void;
  placeResults: PlaceResult[];
  placeSearchStatus: string;
  locationStatus: string;
  useCurrentLocation: boolean;
  setUseCurrentLocation: (value: boolean) => void;
  searchPlaces: (event?: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  if (!canWrite || !state.activeList) return null;
  return (
    <section className="tool-panel add-restaurants-panel">
      <PanelTitle icon={<Plus size={17} />} title="Add restaurants" detail={`Adds places only to ${state.activeList.name}.`} />
      <form className="place-search" onSubmit={searchPlaces}>
        <input value={placeQuery} onChange={(event) => setPlaceQuery(event.target.value)} placeholder="Search OpenStreetMap" />
        <button type="submit">Search</button>
      </form>
      <label className="toggle-row">
        <input
          type="checkbox"
          checked={useCurrentLocation}
          onChange={(event) => setUseCurrentLocation(event.target.checked)}
        />
        <Crosshair size={16} />
        Search near me
      </label>
      {locationStatus ? <p className="microcopy">{locationStatus}</p> : null}
      {placeSearchStatus ? <p className="microcopy">{placeSearchStatus}</p> : null}
      <ManualRestaurantForm listId={state.activeList.id} />
      {placeResults.map((place) => (
        <form action={addRestaurant} className="place-result" key={`${place.osmType}-${place.osmId}`}>
          <input type="hidden" name="listId" value={state.activeList!.id} />
          {Object.entries(place).map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ))}
          <button>
            <strong>{place.name}</strong>
            <small>{place.address}</small>
          </button>
        </form>
      ))}
    </section>
  );
}

function MobileListsDrawer({
  state,
  canWrite,
  onClose,
}: {
  state: AppState;
  canWrite: boolean;
  onClose: () => void;
}) {
  return (
    <div className="drawer-backdrop lists-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(event) => event.stopPropagation()} aria-label="Lists menu">
        <header className="drawer-head">
          <div>
            <p className="kicker">Menu</p>
            <h2>{state.activeList?.name}</h2>
          </div>
          <button className="ghost-button icon-button" onClick={onClose} aria-label="Close menu">
            <X size={18} />
          </button>
        </header>

        <div className="drawer-section">
          <SidebarContent state={state} canWrite={canWrite} onCloseDrawer={onClose} />
        </div>
      </aside>
    </div>
  );
}

function MobileDetailSheet({
  canWrite,
  entry,
  listId,
  ratingDefinitions,
  initialEdit,
  onClose,
}: {
  canWrite: boolean;
  entry: RestaurantEntry;
  listId: number;
  ratingDefinitions: RatingDefinition[];
  initialEdit: boolean;
  onClose: () => void;
}) {
  return (
    <div className="detail-sheet">
      <div className="detail-sheet-head">
        <button type="button" className="ghost-button back-button" onClick={onClose}>
          ← Back to list
        </button>
      </div>
      <div className="detail-sheet-body">
        <RestaurantDetail
          key={`${entry.id}:${initialEdit ? "edit" : "view"}`}
          canWrite={canWrite}
          entry={entry}
          listId={listId}
          ratingDefinitions={ratingDefinitions}
          initialEdit={initialEdit}
        />
      </div>
    </div>
  );
}

function CheckInCard({
  canWrite,
  checkIn,
  listId,
}: {
  canWrite: boolean;
  checkIn: CheckIn;
  listId: number;
}) {
  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const [visitedAt, setVisitedAt] = useState(checkIn.visitedAt);

  const reset = () => {
    setVisitedAt(checkIn.visitedAt);
    setMode("preview");
  };

  if (mode === "edit") {
    return (
      <form
        action={async (formData) => {
          await updateCheckIn(formData);
          setMode("preview");
        }}
        className="checkin-card checkin-card-editing"
      >
        <input type="hidden" name="listId" value={listId} />
        <input type="hidden" name="checkInId" value={checkIn.id} />
        <div className="checkin-meta">
          <strong>{checkIn.authorName}</strong>
          <DateTimeField value={visitedAt} onChange={setVisitedAt} />
        </div>
        <div className="checkin-actions">
          <button>Save</button>
          <button type="button" className="ghost-button" onClick={reset}>
            Cancel
          </button>
          <button formAction={deleteCheckIn} className="danger-button icon-only" aria-label="Delete check-in">
            <Trash2 size={16} />
          </button>
        </div>
      </form>
    );
  }

  return (
    <article className="checkin-card">
      <div className="checkin-meta">
        <strong>{checkIn.authorName}</strong>
        <span className="checkin-date">
          <CalendarClock size={14} />
          {formatShortDateTime(checkIn.visitedAt)}
        </span>
        {canWrite ? (
          <div className="checkin-actions">
            <button type="button" className="ghost-button icon-button" onClick={() => setMode("edit")} aria-label="Edit check-in">
              <Pencil size={16} />
            </button>
            <form action={deleteCheckIn} className="inline-form">
              <input type="hidden" name="listId" value={listId} />
              <input type="hidden" name="checkInId" value={checkIn.id} />
              <button className="ghost-button icon-only" aria-label="Delete check-in">
                <Trash2 size={16} />
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function RestaurantDetail({
  canWrite,
  entry,
  listId,
  ratingDefinitions,
  initialEdit,
}: {
  canWrite: boolean;
  entry: RestaurantEntry;
  listId: number;
  ratingDefinitions: RatingDefinition[];
  initialEdit: boolean;
}) {
  const [entryMode, setEntryMode] = useState<"edit" | "preview">(initialEdit && canWrite ? "edit" : "preview");
  const [standingNotes, setStandingNotes] = useState(entry.standingNotes ?? "");
  const [favoriteItems, setFavoriteItems] = useState(entry.favoriteItems ?? "");
  const [orderingTips, setOrderingTips] = useState(entry.orderingTips ?? "");
  const resetEntryEdit = () => {
    setStandingNotes(entry.standingNotes ?? "");
    setFavoriteItems(entry.favoriteItems ?? "");
    setOrderingTips(entry.orderingTips ?? "");
    setEntryMode("preview");
  };
  const activeRatingDefinitions = ratingDefinitions.filter((definition) => definition.active);
  return (
    <>
      <div className="detail-head">
        <div className="detail-title-group">
          <h3>{entry.name}</h3>
          <span className="detail-location">{formatCityState(entry.address)}</span>
          <RatingSummary entry={entry} definitions={activeRatingDefinitions} />
        </div>
        <div className="link-row">
          {canWrite && entryMode === "preview" ? (
            <button type="button" className="ghost-button icon-button" onClick={() => setEntryMode("edit")} aria-label="Edit notes and ratings">
              <Pencil size={16} />
            </button>
          ) : null}
          <a href={entry.googleMapsUrl || googleMapsUrl(entry)} target="_blank" rel="noreferrer" className="icon-link" aria-label="Open in Google Maps">
            <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
              <path d="M19.527 4.799c1.212 2.608.937 5.678-.405 8.173-1.101 2.047-2.744 3.74-4.098 5.614-.619.858-1.244 1.75-1.669 2.727-.141.325-.263.658-.383.992-.121.333-.224.673-.34 1.008-.109.314-.236.684-.627.687h-.007c-.466-.001-.579-.53-.695-.887-.284-.874-.581-1.713-1.019-2.525-.51-.944-1.145-1.817-1.79-2.671L19.527 4.799zM8.545 7.705l-3.959 4.707c.724 1.54 1.821 2.863 2.871 4.18.247.31.494.622.737.936l4.984-5.925-.029.01c-1.741.601-3.691-.291-4.392-1.987a3.377 3.377 0 0 1-.209-.716c-.063-.437-.077-.761-.004-1.198l.001-.007zM5.492 3.149l-.003.004c-1.947 2.466-2.281 5.88-1.117 8.77l4.785-5.689-.058-.05-3.607-3.035zM14.661.436l-3.838 4.563a.295.295 0 0 1 .027-.01c1.6-.551 3.403.15 4.22 1.626.176.319.323.683.377 1.045.068.446.085.773.012 1.22l-.003.016 3.836-4.561A8.382 8.382 0 0 0 14.67.439l-.009-.003zM9.466 5.868L14.162.285l-.047-.012A8.31 8.31 0 0 0 11.986 0a8.439 8.439 0 0 0-6.169 2.766l-.016.018 3.665 3.084z" fill="#34A853"/>
            </svg>
          </a>
          <a href={entry.yelpUrl || yelpUrl(entry)} target="_blank" rel="noreferrer" className="icon-link" aria-label="Open in Yelp">
            <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
              <path d="m7.6885 15.1415-3.6715.8483c-.3769.0871-.755.183-1.1452.155-.2611-.0188-.5122-.0414-.7606-.213a1.179 1.179 0 0 1-.331-.3594c-.3486-.5519-.3656-1.3661-.3697-2.0004a6.2874 6.2874 0 0 1 .3314-2.0642 1.857 1.857 0 0 1 .1073-.2474 2.3426 2.3426 0 0 1 .1255-.2165 2.4572 2.4572 0 0 1 .1563-.1975 1.1736 1.1736 0 0 1 .399-.2831 1.082 1.082 0 0 1 .4592-.0837c.2355.0016.5139.052.91.1734.0555.0191.1237.0382.1856.0572.3277.1013.7048.2404 1.1499.3987.6863.2404 1.3663.487 2.0463.7397l1.2117.4423c.2217.0807.4363.18.6412.297.174.0984.3273.2298.4512.387a1.217 1.217 0 0 1 .192.4309 1.2205 1.2205 0 0 1-.872 1.4522c-.0468.0151-.0852.0239-.1085.0293l-1.105.2553-.0031-.001zM18.8208 7.565a1.8506 1.8506 0 0 0-.2042-.1754 2.4082 2.4082 0 0 0-.2077-.1394 2.3607 2.3607 0 0 0-.2269-.109 1.1705 1.1705 0 0 0-.482-.0796 1.0862 1.0862 0 0 0-.4498.1263c-.2107.1048-.4388.2732-.742.5551-.042.0417-.0947.0886-.142.133-.2502.2351-.5286.5252-.8599.863a114.6363 114.6363 0 0 0-1.5166 1.5629l-.8962.9293a4.1897 4.1897 0 0 0-.4466.5483 1.541 1.541 0 0 0-.2364.5459 1.2199 1.2199 0 0 0 .0107.4518l.0046.02a1.218 1.218 0 0 0 1.4184.923 1.162 1.162 0 0 0 .1105-.0213l4.7781-1.104c.3766-.087.7587-.1667 1.097-.3631.2269-.1316.4428-.262.5909-.5252a1.1793 1.1793 0 0 0 .1405-.4683c.0733-.6512-.2668-1.3908-.5403-1.963a6.2792 6.2792 0 0 0-1.2001-1.7103zM8.9703.0754a8.6724 8.6724 0 0 0-.83.1564c-.2754.066-.548.1383-.8146.2236-.868.2844-2.0884.8063-2.295 1.8065-.1165.5655.1595 1.1439.3737 1.66.2595.6254.614 1.1889.9373 1.7777.8543 1.5545 1.7245 3.0993 2.5922 4.6457.259.4617.5416 1.0464 1.043 1.2856a1.058 1.058 0 0 0 .1013.0383c.2248.0851.4699.1016.7041.0471a4.3015 4.3015 0 0 0 .0418-.0097 1.2136 1.2136 0 0 0 .5658-.3397 1.1033 1.1033 0 0 0 .079-.0822c.3463-.435.3454-1.0833.3764-1.6134.1042-1.771.2139-3.5423.3009-5.3142.0332-.6712.1055-1.3333.0655-2.0096-.0328-.5579-.0368-1.1984-.3891-1.6563-.6218-.8073-1.9476-.741-2.8523-.6158zm2.084 15.9505a1.1053 1.1053 0 0 0-1.2306-.4145 1.1398 1.1398 0 0 0-.1526.0633 1.4806 1.4806 0 0 0-.2171.1354c-.1992.1475-.3668.3392-.5196.5315-.0386.049-.074.1143-.12.1562l-.7686 1.0573a113.9168 113.9168 0 0 0-1.2913 1.789c-.278.3895-.5184.7184-.7083 1.0094-.036.0547-.0734.116-.1075.1647-.2277.3522-.3566.6092-.4228.8381a1.0945 1.0945 0 0 0-.046.4721c.0211.1655.0768.3246.1635.467.046.0715.0957.1406.1487.207a2.334 2.334 0 0 0 .1754.1825 1.843 1.843 0 0 0 .2108.1732c.5304.369 1.1112.6342 1.722.8391a6.0958 6.0958 0 0 0 1.5716.3004c.091.0046.1821.0025.2728-.006a2.3878 2.3878 0 0 0 .2506-.0351 2.3862 2.3862 0 0 0 .2447-.071 1.1927 1.1927 0 0 0 .4175-.2658c.1127-.113.1994-.249.2541-.3989.0889-.2214.1473-.5026.1857-.92.0034-.0593.0118-.1305.0177-.1958.0304-.3463.0443-.7531.0666-1.2315.0375-.7357.067-1.4681.0903-2.2026 0 0 .0495-1.3053.0494-1.306.0113-.3008.002-.6342-.0814-.9336a1.396 1.396 0 0 0-.1756-.4054z" fill="#d32323"/>
            </svg>
          </a>
        </div>
      </div>
      {canWrite && entryMode === "edit" ? (
        <form
          action={async (formData) => {
            await updateEntry(formData);
            await saveRatings(formData);
            setEntryMode("preview");
          }}
          className="entry-edit-form"
        >
          <input type="hidden" name="listId" value={listId} />
          <input type="hidden" name="entryId" value={entry.id} />
          <div className="section-head">
            <h4>Edit notes and ratings</h4>
          </div>
          <div className="entry-edit-grid">
            <section className="entry-edit-section">
              <h5>Notes</h5>
              <NotesEditField
                title="Order"
                name="standingNotes"
                value={standingNotes}
                onChange={setStandingNotes}
                placeholder="What to order"
              />
              <NotesEditField
                title="Skip"
                name="favoriteItems"
                value={favoriteItems}
                onChange={setFavoriteItems}
                placeholder="What to avoid"
              />
              <NotesEditField
                title="People"
                name="orderingTips"
                value={orderingTips}
                onChange={setOrderingTips}
                placeholder="Who likes this place or what group it fits"
              />
            </section>
            <section className="entry-edit-section">
              <h5>Ratings</h5>
              <div className="rating-grid">
                {activeRatingDefinitions.map((definition) => {
                  const value = entry.ratings.find((rating) => rating.definitionId === definition.id)?.value ?? "";
                  return (
                    <div className="rating-field" key={definition.id}>
                      <span>{definition.name}</span>
                      <RatingInput definition={definition} value={value} disabled={false} />
                    </div>
                  );
                })}
                {!activeRatingDefinitions.length ? <p className="muted">No rating fields enabled.</p> : null}
              </div>
            </section>
          </div>
          <div className="form-actions">
            <button>Save entry</button>
            <button type="button" className="ghost-button" onClick={resetEntryEdit}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <section className="notes-panel">
          <div className="section-head">
            <h4>Notes</h4>
          </div>
          <NotePreview standingNotes={standingNotes} favoriteItems={favoriteItems} orderingTips={orderingTips} />
        </section>
      )}
      {canWrite ? (
        <details className="external-links-panel">
          <summary>Advanced external links</summary>
          <p className="microcopy">
            Google Maps is {entry.googleMapsUrl ? "using a custom link" : "generated from name and address"}. Yelp is{" "}
            {entry.yelpUrl ? "using a custom link" : "generated from name and address"}.
          </p>
          <form action={updateExternalLinks} className="stack-form">
            <input type="hidden" name="listId" value={listId} />
            <input type="hidden" name="entryId" value={entry.id} />
            <label>
              Google Maps custom URL
              <input name="googleMapsUrl" placeholder={googleMapsUrl(entry)} defaultValue={entry.googleMapsUrl ?? ""} />
            </label>
            <label>
              Yelp custom URL
              <input name="yelpUrl" placeholder={yelpUrl(entry)} defaultValue={entry.yelpUrl ?? ""} />
            </label>
            <button>Save external links</button>
          </form>
        </details>
      ) : null}
      <section className="checkin-box">
        <h4>Check-ins</h4>
        {entry.latestCheckIn ? (
          <div className="checkin-list">
            {entry.checkIns.map((checkIn) => (
              <CheckInCard key={checkIn.id} canWrite={canWrite} checkIn={checkIn} listId={listId} />
            ))}
          </div>
        ) : (
          <p className="muted">No check-ins yet.</p>
        )}
        {canWrite ? (
          <form action={createCheckIn} className="checkin-new">
            <input type="hidden" name="listId" value={listId} />
            <input type="hidden" name="entryId" value={entry.id} />
            <label className="datetime-field">
              <span>
                <CalendarClock size={14} />
                Visit time
              </span>
              <input name="visitedAt" type="datetime-local" defaultValue={localDateTimeInputValue()} />
            </label>
            <button>Check in</button>
          </form>
        ) : null}
      </section>
    </>
  );
}

function DateTimeField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="datetime-field compact">
      <span>
        <CalendarClock size={14} />
        Visit time
      </span>
      <input
        name="visitedAt"
        type="datetime-local"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function NotesEditField({
  title,
  name,
  value,
  onChange,
  placeholder,
}: {
  title: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="notes-edit-field">
      <span>{title}</span>
      <textarea name={name} placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function RatingSummary({ entry, definitions }: { entry: RestaurantEntry; definitions: RatingDefinition[] }) {
  const badges = definitions
    .map((definition) => {
      const value = entry.ratings.find((rating) => rating.definitionId === definition.id)?.value ?? "";
      if (!value) return null;
      return <RatingBadge key={definition.id} definition={definition} value={value} />;
    })
    .filter(Boolean);

  if (!badges.length) return <span className="rating-summary empty">No ratings yet</span>;
  return <div className="rating-summary">{badges}</div>;
}

function RatingBadge({ definition, value }: { definition: RatingDefinition; value: string }) {
  if (definition.presetKey === "go_back") {
    const label = `Go back: ${value === "true" ? "yes" : "no"}`;
    return (
      <span className={`entry-rating-badge icon-badge ${value === "true" ? "positive" : "negative"}`} aria-label={label} title={label}>
        <Undo2 size={14} />
      </span>
    );
  }
  if (definition.presetKey === "price") {
    return (
      <span className="entry-rating-badge price icon-badge" aria-label={`Price: ${value.length} dollar signs`} title={`Price: ${value}`}>
        {repeatedIcon(DollarSign, value.length, 13)}
      </span>
    );
  }
  if (definition.presetKey === "stars") {
    return (
      <span className="entry-rating-badge stars icon-badge" aria-label={`${value} stars`} title={`${value} stars`}>
        {repeatedIcon(Star, Number(value), 13, true)}
      </span>
    );
  }

  const presetIcon = definition.presetKey ? RATING_PRESETS.find((preset) => preset.key === definition.presetKey)?.icon : null;
  const icon = (presetIcon ?? definition.icon) || "tag";
  const displayValue = value === "true" ? "Yes" : value === "false" ? "No" : value;
  return (
    <span className="entry-rating-badge">
      {RATING_ICON_MAP[icon] ?? <Tag size={14} />}
      {definition.name}: {displayValue}
    </span>
  );
}

function NotePreview({
  standingNotes,
  favoriteItems,
  orderingTips,
}: {
  standingNotes: string;
  favoriteItems: string;
  orderingTips: string;
}) {
  const sections = [
    ["Order", standingNotes],
    ["Skip", favoriteItems],
    ["People", orderingTips],
  ] as const;
  const hasNotes = sections.some(([, value]) => value.trim());
  if (!hasNotes) return <p className="muted">No notes yet.</p>;
  return (
    <div className="markdown-sections">
      {sections.map(([title, value]) =>
        value.trim() ? (
          <section key={title} className="markdown-section">
            <h5>{title}</h5>
            <ReactMarkdown>{value}</ReactMarkdown>
          </section>
        ) : null,
      )}
    </div>
  );
}

function RatingInput({ definition, value, disabled }: { definition: RatingDefinition; value: string; disabled: boolean }) {
  const fieldName = `rating:${definition.id}`;
  if (definition.presetKey === "price") {
    return (
      <RatingScaleInput
        name={fieldName}
        value={value}
        disabled={disabled}
        options={definition.options.map((option) => ({ value: option, ariaLabel: `Price: ${option.length} dollar signs` }))}
        Icon={DollarSign}
      />
    );
  }
  if (definition.presetKey === "stars") {
    const min = definition.min ?? 1;
    const max = definition.max ?? 5;
    return (
      <RatingScaleInput
        name={fieldName}
        value={value}
        disabled={disabled}
        options={Array.from({ length: max - min + 1 }, (_, index) => {
          const rating = String(min + index);
          return { value: rating, ariaLabel: `${rating} stars` };
        })}
        Icon={Star}
        filled
      />
    );
  }

  const labelledOptions = ratingOptions(definition);
  if (labelledOptions.length) {
    return (
      <div className={`rating-choice-group ${disabled ? "disabled" : ""}`} role="radiogroup" aria-label={definition.name}>
        <RatingRadio name={fieldName} value="" checked={value === ""} disabled={disabled} label="Unset" />
        {labelledOptions.map((option) => (
          <RatingRadio
            key={option.value}
            name={fieldName}
            value={option.value}
            checked={value === option.value}
            disabled={disabled}
            label={option.label}
            ariaLabel={option.ariaLabel}
            title={option.ariaLabel}
          />
        ))}
      </div>
    );
  }

  if (definition.type === "boolean") {
    return (
      <select name={fieldName} defaultValue={value} disabled={disabled}>
        <option value="">Unset</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  }
  if (definition.type === "choice") {
    return (
      <select name={fieldName} defaultValue={value} disabled={disabled}>
        <option value="">Unset</option>
        {definition.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }
  return <input name={fieldName} type="number" min={definition.min ?? undefined} max={definition.max ?? undefined} defaultValue={value} disabled={disabled} />;
}

function RatingScaleInput({
  name,
  value,
  disabled,
  options,
  Icon,
  filled = false,
}: {
  name: string;
  value: string;
  disabled: boolean;
  options: Array<{ value: string; ariaLabel: string }>;
  Icon: LucideIcon;
  filled?: boolean;
}) {
  const [selected, setSelected] = useState(value);
  const selectedIndex = options.findIndex((option) => option.value === selected);

  return (
    <div className={`rating-scale ${disabled ? "disabled" : ""}`} role="radiogroup" aria-label={name}>
      <label className="rating-scale-clear" title="Unset">
        <input
          type="radio"
          name={name}
          value=""
          checked={selected === ""}
          disabled={disabled}
          onChange={() => setSelected("")}
          aria-label="Unset"
        />
        <span>Unset</span>
      </label>
      <div className="rating-scale-icons">
        {options.map((option, index) => {
          const active = selectedIndex >= index;
          return (
            <label className={`rating-scale-icon ${active ? "active" : ""}`} key={option.value} title={option.ariaLabel}>
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected === option.value}
                disabled={disabled}
                onChange={() => setSelected(option.value)}
                aria-label={option.ariaLabel}
              />
              <span>
                <Icon size={17} fill={filled && active ? "currentColor" : "none"} />
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function RatingRadio({
  name,
  value,
  checked,
  disabled,
  label,
  ariaLabel,
  title,
}: {
  name: string;
  value: string;
  checked: boolean;
  disabled: boolean;
  label: ReactNode;
  ariaLabel?: string;
  title?: string;
}) {
  const fallbackLabel = typeof label === "string" ? label : value || "Rating option";
  return (
    <label className="rating-choice" title={title}>
      <input type="radio" name={name} value={value} defaultChecked={checked} disabled={disabled} aria-label={ariaLabel ?? fallbackLabel} />
      <span>{label}</span>
    </label>
  );
}

function ratingOptions(definition: RatingDefinition) {
  if (definition.presetKey === "go_back") {
    return [
      { value: "true", label: <CheckCircle size={16} />, ariaLabel: "Go back: yes" },
      { value: "false", label: <XCircle size={16} />, ariaLabel: "Go back: no" },
    ];
  }
  if (definition.type === "boolean") {
    return [
      { value: "true", label: "Yes", ariaLabel: `${definition.name}: yes` },
      { value: "false", label: "No", ariaLabel: `${definition.name}: no` },
    ];
  }
  if (definition.type === "choice" && definition.options.length <= 5) {
    return definition.options.map((option) => ({ value: option, label: option, ariaLabel: `${definition.name}: ${option}` }));
  }
  return [];
}

function repeatedIcon(Icon: LucideIcon, count: number, size: number, filled = false) {
  return (
    <span className="rating-icon-stack">
      {Array.from({ length: count }, (_, index) => (
        <Icon key={index} size={size} fill={filled ? "currentColor" : "none"} />
      ))}
    </span>
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
    return definition.options.map((option) => (
      <option key={option} value={option}>
        {option}
      </option>
    ));
  }
  const options = [];
  for (let value = definition.min ?? 1; value <= (definition.max ?? 5); value += 1) {
    options.push(
      <option key={value} value={value}>
        {value}
      </option>,
    );
  }
  return options;
}

function googleMapsUrl(restaurant: RestaurantEntry) {
  const query = [restaurant.name, restaurant.address].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function yelpUrl(restaurant: RestaurantEntry) {
  return `https://www.yelp.com/search?find_desc=${encodeURIComponent(restaurant.name)}&find_loc=${encodeURIComponent(
    restaurant.address || [restaurant.lat, restaurant.lon].filter((value) => value !== null).join(","),
  )}`;
}

function getCurrentPosition(): Promise<
  | { ok: true; position: GeolocationPosition }
  | { ok: false; reason: string }
> {
  if (typeof window === "undefined" || typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve({ ok: false, reason: "This browser does not support location search. Searching everywhere." });
  }
  if (!window.isSecureContext) {
    return Promise.resolve({
      ok: false,
      reason: "Browser location requires HTTPS or localhost. Searching everywhere.",
    });
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ ok: true, position }),
      (error) => {
        const reason =
          error.code === error.PERMISSION_DENIED
            ? "Location permission was denied. Searching everywhere."
            : "Location unavailable. Searching everywhere.";
        resolve({ ok: false, reason });
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 1000 * 60 * 10 },
    );
  });
}
