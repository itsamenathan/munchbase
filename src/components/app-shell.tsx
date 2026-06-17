"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
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
  attachRestaurantToList,
  createCheckIn,
  createList,
  createRatingDefinition,
  createUser,
  deleteCheckIn,
  logout,
  removeRestaurantFromList,
  saveRatings,
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
import type { AppState, CheckIn, RatingDefinition, Restaurant } from "@/lib/types";

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

type CustomFieldDraft = {
  id: string;
  name: string;
  type: RatingDefinition["type"];
  icon: string;
  options: string;
  min: string;
  max: string;
};

function emptyCustomFieldDraft(): CustomFieldDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: "",
    type: "choice",
    icon: "tag",
    options: "",
    min: "1",
    max: "5",
  };
}

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
  const [addListOpen, setAddListOpen] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(initialEntryId);
  const canWrite = true;
  const activeDefinitions = useMemo(
    () => [...state.globalRatingDefinitions, ...state.ratingDefinitions],
    [state.globalRatingDefinitions, state.ratingDefinitions],
  );

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

  return (
    <main className="app">
      <aside className="sidebar">
        <SidebarContent state={state} canWrite={canWrite} onCloseDrawer={() => setListsOpen(false)} onOpenAddList={() => setAddListOpen(true)} />
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
              <h2>{state.activeList?.name ?? "All restaurants"}</h2>
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
            <button className="ghost-button icon-button" onClick={() => setSettingsOpen(true)} aria-label={state.activeList ? "List settings" : "Global attributes"}>
              <Settings size={16} />
            </button>
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
              {activeDefinitions.filter((d) => d.active).map((definition) => (
                <option key={definition.id} value={definition.id}>
                  {definition.name}
                </option>
              ))}
            </select>
          </label>
          {filterDefinition ? (
            <select value={filterValue} onChange={(event) => setFilterValue(event.target.value)}>
              <RatingFilterOptions definition={activeDefinitions.find((definition) => String(definition.id) === filterDefinition)} />
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
                const ratingIcons = activeDefinitions.filter((d) => d.active).map((definition) => {
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
                  activeListId={state.activeListId}
                  lists={state.lists}
                  globalRatingDefinitions={state.globalRatingDefinitions}
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
            <p className="kicker">Add restaurant</p>
            <h2>{state.activeList?.name ?? "All restaurants"}</h2>
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
      {addListOpen ? <AddListModal state={state} onClose={() => setAddListOpen(false)} /> : null}

      {listsOpen ? (
        <MobileListsDrawer state={state} canWrite={canWrite} onClose={() => setListsOpen(false)} onOpenAddList={() => setAddListOpen(true)} />
      ) : null}

      {selectedEntry ? (
        <MobileDetailSheet
          canWrite={canWrite}
          entry={selectedEntry}
          activeListId={state.activeListId}
          lists={state.lists}
          globalRatingDefinitions={state.globalRatingDefinitions}
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
  const isGlobal = !state.activeList;
  const definitions = isGlobal ? state.globalRatingDefinitions : state.ratingDefinitions;
  return (
    <div className="drawer-backdrop">
      <aside className="settings-drawer" aria-label={isGlobal ? "Global attributes" : "List settings"}>
        <header className="drawer-head">
          <div>
            <p className="kicker">{isGlobal ? "Global attributes" : "List settings"}</p>
            <h2>{state.activeList?.name ?? "All restaurants"}</h2>
          </div>
          <button className="ghost-button icon-button" onClick={onClose} aria-label="Close list settings">
            <X size={18} />
          </button>
        </header>

        {isGlobal ? (
          <>
            <section className="settings-section">
              <PanelTitle icon={<Star size={17} />} title="Built-ins" detail="Common attributes shown for every restaurant." />
              <div className="preset-grid">
                {RATING_PRESETS.map((preset) => {
                  const definition = state.globalRatingDefinitions.find((item) => item.presetKey === preset.key);
                  const enabled = definition?.active ?? false;
                  return (
                    <form action={setRatingPresetEnabled} className={`preset-card ${enabled ? "enabled" : ""}`} key={preset.key}>
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
              <PanelTitle icon={<Tag size={17} />} title="Custom globals" detail="User-defined attributes shown for every restaurant." />
              <AttributeCards definitions={definitions.filter((definition) => !definition.presetKey)} />
              <details className="manual-add">
                <summary>Add global attribute</summary>
                <AddCustomFieldForm scope="global" />
              </details>
            </section>
          </>
        ) : null}

        {!isGlobal && state.activeList ? (
          <>
            <section className="settings-section">
              <PanelTitle icon={<Star size={17} />} title="Custom fields" detail="Add list-specific attributes for restaurants in this list." />
              <AttributeCards definitions={definitions} />
              <details className="manual-add">
                <summary>Add new field</summary>
                <AddCustomFieldForm scope="list" listId={state.activeList.id} />
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
          </>
        ) : null}
      </aside>
    </div>
  );
}

function AttributeCards({ definitions }: { definitions: RatingDefinition[] }) {
  return (
    <div className="preset-grid">
      {definitions.map((definition) => (
        <form action={updateRatingFieldActive} className={`preset-card ${definition.active ? "enabled" : ""}`} key={definition.id}>
          <input type="hidden" name="definitionId" value={definition.id} />
          <input type="hidden" name="active" value={definition.active ? "0" : "1"} />
          <div>
            <strong>{definition.name}</strong>
            <small>{fieldDescription(definition)}</small>
          </div>
          <button>{definition.active ? "Disable" : "Enable"}</button>
        </form>
      ))}
      {!definitions.length ? <p className="muted">No custom attributes yet.</p> : null}
    </div>
  );
}

function fieldDescription(definition: RatingDefinition) {
  if (definition.type === "choice") return `choice: ${definition.options.join(", ")}`;
  if (definition.type === "scale") return `scale (${definition.min}-${definition.max})`;
  return "yes / no";
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
          <PanelTitle icon={<Users size={17} />} title="Create user" detail="Create an account directly. Active users can edit all restaurant data." />
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

function AddListModal({
  state,
  onClose,
}: {
  state: AppState;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"details" | "fields" | "restaurants">("details");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<CustomFieldDraft[]>([emptyCustomFieldDraft()]);
  const [restaurantQuery, setRestaurantQuery] = useState("");
  const [selectedRestaurantIds, setSelectedRestaurantIds] = useState<number[]>([]);
  const serializedFields = JSON.stringify(
    fields
      .filter((field) => field.name.trim())
      .map(({ name, type, icon, options, min, max }) => ({ name, type, icon, options, min, max })),
  );
  const serializedRestaurantIds = JSON.stringify(selectedRestaurantIds);
  const filteredRestaurants = state.allRestaurants.filter((restaurant) => {
    const needle = restaurantQuery.trim().toLowerCase();
    if (!needle) return true;
    return [restaurant.name, restaurant.address].filter(Boolean).join(" ").toLowerCase().includes(needle);
  });
  const updateField = (id: string, patch: Partial<CustomFieldDraft>) => {
    setFields((current) => current.map((field) => (field.id === id ? { ...field, ...patch } : field)));
  };
  const toggleRestaurant = (restaurantId: number) => {
    setSelectedRestaurantIds((current) =>
      current.includes(restaurantId) ? current.filter((id) => id !== restaurantId) : [...current, restaurantId],
    );
  };
  return (
    <div className="drawer-backdrop add-list-backdrop" onClick={onClose}>
      <section className="add-list-modal" onClick={(event) => event.stopPropagation()} aria-label="Add list">
        <header className="drawer-head">
          <div>
            <p className="kicker">Add list</p>
            <h2>{step === "details" ? "List details" : step === "fields" ? "Custom attributes" : "Restaurants"}</h2>
          </div>
          <button className="ghost-button icon-button" onClick={onClose} aria-label="Close add list">
            <X size={18} />
          </button>
        </header>
        <form
          action={createList}
          className="add-list-form"
          onSubmit={(event) => {
            if (step !== "restaurants") {
              event.preventDefault();
              if (step === "details" && name.trim()) setStep("fields");
              if (step === "fields") setStep("restaurants");
            }
          }}
        >
          <input type="hidden" name="name" value={name} />
          <input type="hidden" name="description" value={description} />
          <input type="hidden" name="customFieldsJson" value={serializedFields} />
          <input type="hidden" name="restaurantIdsJson" value={serializedRestaurantIds} />
          <div className="add-list-steps" aria-label="Add list steps">
            <span className={step === "details" ? "active" : ""}>Details</span>
            <span className={step === "fields" ? "active" : ""}>Attributes</span>
            <span className={step === "restaurants" ? "active" : ""}>Restaurants</span>
          </div>
          {step === "details" ? (
            <section className="stack-form">
              <input placeholder="List name" required value={name} onChange={(event) => setName(event.target.value)} />
              <input placeholder="Description" value={description} onChange={(event) => setDescription(event.target.value)} />
            </section>
          ) : null}
          {step === "fields" ? (
            <section className="stack-form">
              <div className="wizard-field-list">
                {fields.map((field) => (
                  <div className="wizard-field-card" key={field.id}>
                    <CustomFieldControls field={field} onChange={(patch) => updateField(field.id, patch)} />
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => setFields((current) => current.filter((item) => item.id !== field.id))}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" className="ghost-button" onClick={() => setFields((current) => [...current, emptyCustomFieldDraft()])}>
                <Plus size={16} /> Add attribute
              </button>
            </section>
          ) : null}
          {step === "restaurants" ? (
            <section className="stack-form">
              <label className="search-box add-list-search">
                <Search size={17} />
                <input value={restaurantQuery} onChange={(event) => setRestaurantQuery(event.target.value)} placeholder="Search existing restaurants" />
              </label>
              <div className="restaurant-picker-list">
                {filteredRestaurants.map((restaurant) => {
                  const checked = selectedRestaurantIds.includes(restaurant.id);
                  return (
                    <label className={`restaurant-picker-row ${checked ? "selected" : ""}`} key={restaurant.id}>
                      <input type="checkbox" checked={checked} onChange={() => toggleRestaurant(restaurant.id)} />
                      <span>
                        <strong>{restaurant.name}</strong>
                        <small>{restaurant.address}</small>
                      </span>
                    </label>
                  );
                })}
                {!filteredRestaurants.length ? <p className="muted">No existing restaurants match.</p> : null}
              </div>
            </section>
          ) : null}
          <footer className="form-actions add-list-actions">
            <button
              type="button"
              className="ghost-button"
              onClick={() => setStep(step === "restaurants" ? "fields" : "details")}
              disabled={step === "details"}
            >
              Back
            </button>
            {step === "restaurants" ? (
              <button disabled={!name.trim()}>Create list</button>
            ) : (
              <button
                type="button"
                onClick={() => setStep(step === "details" ? "fields" : "restaurants")}
                disabled={step === "details" && !name.trim()}
              >
                Next
              </button>
            )}
          </footer>
        </form>
      </section>
    </div>
  );
}

function ManualRestaurantForm({ listId }: { listId: number | null }) {
  return (
    <details className="manual-add">
      <summary>Manual add</summary>
      <form action={addRestaurant} className="stack-form">
        {listId ? <input type="hidden" name="listId" value={listId} /> : null}
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

function AddCustomFieldForm({ scope, listId }: { scope: "global" | "list"; listId?: number }) {
  const [field, setField] = useState<CustomFieldDraft>(emptyCustomFieldDraft());
  return (
    <form action={createRatingDefinition} className="stack-form">
      <input type="hidden" name="scope" value={scope} />
      {listId ? <input type="hidden" name="listId" value={listId} /> : null}
      <CustomFieldControls field={field} onChange={(patch) => setField((current) => ({ ...current, ...patch }))} includeNames />
      <button>Add custom field</button>
    </form>
  );
}

function CustomFieldControls({
  field,
  onChange,
  includeNames = false,
}: {
  field: CustomFieldDraft;
  onChange: (patch: Partial<CustomFieldDraft>) => void;
  includeNames?: boolean;
}) {
  return (
    <>
      <input
        name={includeNames ? "name" : undefined}
        placeholder="Attribute name"
        required={includeNames}
        value={field.name}
        onChange={(event) => onChange({ name: event.target.value })}
      />
      <select
        name={includeNames ? "type" : undefined}
        value={field.type}
        onChange={(event) => onChange({ type: event.target.value as RatingDefinition["type"] })}
      >
        <option value="choice">Choice</option>
        <option value="scale">Scale</option>
        <option value="boolean">Yes / no</option>
      </select>
      <div className="icon-picker-row">
        <select name={includeNames ? "icon" : undefined} value={field.icon} onChange={(event) => onChange({ icon: event.target.value })}>
          {RATING_ICONS.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <span className="icon-preview">{RATING_ICON_MAP[field.icon] ?? <Tag size={14} />}</span>
      </div>
      {field.type === "choice" ? (
        <input
          name={includeNames ? "options" : undefined}
          placeholder="Choice options, comma separated"
          value={field.options}
          onChange={(event) => onChange({ options: event.target.value })}
        />
      ) : null}
      {field.type === "scale" ? (
        <div className="split">
          <input
            name={includeNames ? "min" : undefined}
            type="number"
            placeholder="Min"
            value={field.min}
            onChange={(event) => onChange({ min: event.target.value })}
          />
          <input
            name={includeNames ? "max" : undefined}
            type="number"
            placeholder="Max"
            value={field.max}
            onChange={(event) => onChange({ max: event.target.value })}
          />
        </div>
      ) : null}
    </>
  );
}

function SidebarContent({
  state,
  canWrite,
  onCloseDrawer,
  onOpenAddList,
}: {
  state: AppState;
  canWrite: boolean;
  onCloseDrawer?: () => void;
  onOpenAddList: () => void;
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
        <Link
          className={state.activeListId === null ? "active" : ""}
          href="/"
          onClick={onCloseDrawer}
        >
          All restaurants
          <span>{state.allRestaurants.length}</span>
        </Link>
        {state.lists.map((list) => (
          <a
            key={list.id}
            className={list.id === state.activeListId ? "active" : ""}
            href={`/?list=${list.id}`}
            onClick={onCloseDrawer}
          >
            {list.name}
            <span>{state.allRestaurants.filter((restaurant) => restaurant.memberships.some((membership) => membership.id === list.id)).length}</span>
          </a>
        ))}
      </nav>
      <button
        type="button"
        className="ghost-button add-list-button"
        onClick={() => {
          onOpenAddList();
          onCloseDrawer?.();
        }}
      >
        <Plus size={16} /> Add List
      </button>
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
  if (!canWrite) return null;
  const existingMatches = placeQuery.trim().length >= 2
    ? state.allRestaurants.filter((restaurant) => {
        const needle = placeQuery.trim().toLowerCase();
        return [restaurant.name, restaurant.address].filter(Boolean).join(" ").toLowerCase().includes(needle);
      }).slice(0, 6)
    : [];
  return (
    <section className="tool-panel add-restaurants-panel">
      <PanelTitle icon={<Plus size={17} />} title="Add restaurants" detail={state.activeList ? `Adds places to ${state.activeList.name}.` : "Adds global restaurants."} />
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
      <ManualRestaurantForm listId={state.activeListId} />
      {existingMatches.length ? (
        <div className="member-list">
          {existingMatches.map((restaurant) => {
            const alreadyInList = state.activeListId
              ? restaurant.memberships.some((membership) => membership.id === state.activeListId)
              : true;
            return (
              <form action={state.activeListId && !alreadyInList ? attachRestaurantToList : undefined} className="place-result" key={restaurant.id}>
                <input type="hidden" name="restaurantId" value={restaurant.id} />
                {state.activeListId ? <input type="hidden" name="listId" value={state.activeListId} /> : null}
                <button type={state.activeListId && !alreadyInList ? "submit" : "button"} onClick={() => {
                  if (!state.activeListId || alreadyInList) window.location.href = `/?${state.activeListId ? `list=${state.activeListId}&` : ""}entry=${restaurant.id}`;
                }}>
                  <strong>{restaurant.name}</strong>
                  <small>{alreadyInList ? "Open existing restaurant" : "Add existing restaurant to this list"}</small>
                </button>
              </form>
            );
          })}
        </div>
      ) : null}
      {placeResults.map((place) => (
        <form action={addRestaurant} className="place-result" key={`${place.osmType}-${place.osmId}`}>
          {state.activeListId ? <input type="hidden" name="listId" value={state.activeListId} /> : null}
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
  onOpenAddList,
}: {
  state: AppState;
  canWrite: boolean;
  onClose: () => void;
  onOpenAddList: () => void;
}) {
  return (
    <div className="drawer-backdrop lists-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(event) => event.stopPropagation()} aria-label="Lists menu">
        <header className="drawer-head">
          <div>
            <p className="kicker">Menu</p>
            <h2>{state.activeList?.name ?? "All restaurants"}</h2>
          </div>
          <button className="ghost-button icon-button" onClick={onClose} aria-label="Close menu">
            <X size={18} />
          </button>
        </header>

        <div className="drawer-section">
          <SidebarContent state={state} canWrite={canWrite} onCloseDrawer={onClose} onOpenAddList={onOpenAddList} />
        </div>
      </aside>
    </div>
  );
}

function MobileDetailSheet({
  canWrite,
  entry,
  activeListId,
  lists,
  globalRatingDefinitions,
  ratingDefinitions,
  initialEdit,
  onClose,
}: {
  canWrite: boolean;
  entry: Restaurant;
  activeListId: number | null;
  lists: AppState["lists"];
  globalRatingDefinitions: RatingDefinition[];
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
          activeListId={activeListId}
          lists={lists}
          globalRatingDefinitions={globalRatingDefinitions}
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
}: {
  canWrite: boolean;
  checkIn: CheckIn;
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
  activeListId,
  lists,
  globalRatingDefinitions,
  ratingDefinitions,
  initialEdit,
}: {
  canWrite: boolean;
  entry: Restaurant;
  activeListId: number | null;
  lists: AppState["lists"];
  globalRatingDefinitions: RatingDefinition[];
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
  const activeRatingDefinitions = [
    ...globalRatingDefinitions,
    ...(activeListId ? ratingDefinitions : entry.ratingGroups.flatMap((group) => group.definitions)),
  ].filter((definition) => definition.active);
  const ratingGroups = [
    { list: { id: 0, name: "Global attributes" }, definitions: globalRatingDefinitions },
    ...entry.ratingGroups,
  ];
  const availableLists = lists.filter((list) => !entry.memberships.some((membership) => membership.id === list.id));
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
          <input type="hidden" name="restaurantId" value={entry.id} />
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
              <RatingFields entry={entry} groups={ratingGroups} />
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
        <>
          <section className="notes-panel">
            <div className="section-head">
              <h4>Notes</h4>
            </div>
            <NotePreview standingNotes={standingNotes} favoriteItems={favoriteItems} orderingTips={orderingTips} />
          </section>
          <section className="notes-panel">
            <div className="section-head">
              <h4>Attributes</h4>
            </div>
            <AttributePreview entry={entry} groups={ratingGroups} />
          </section>
        </>
      )}
      {canWrite ? (
        <section className="settings-section">
          <PanelTitle icon={<ClipboardList size={17} />} title="Lists" detail="Restaurant memberships." />
          <div className="member-list">
            {entry.memberships.map((membership) => (
              <form action={removeRestaurantFromList} className="member-row list-membership-row" key={membership.id}>
                <input type="hidden" name="restaurantId" value={entry.id} />
                <input type="hidden" name="listId" value={membership.id} />
                <strong>{membership.name}</strong>
                <button className="ghost-button icon-button compact-icon-button" aria-label={`Remove ${membership.name} from this restaurant`}>
                  <Trash2 size={15} />
                </button>
              </form>
            ))}
          </div>
          {availableLists.length ? (
            <form action={attachRestaurantToList} className="inline-form">
              <input type="hidden" name="restaurantId" value={entry.id} />
              <select name="listId" defaultValue="">
                <option value="" disabled>Add to list</option>
                {availableLists.map((list) => (
                  <option key={list.id} value={list.id}>{list.name}</option>
                ))}
              </select>
              <button>Add</button>
            </form>
          ) : null}
        </section>
      ) : null}
      {canWrite ? (
        <details className="external-links-panel">
          <summary>Advanced external links</summary>
          <p className="microcopy">
            Google Maps is {entry.googleMapsUrl ? "using a custom link" : "generated from name and address"}. Yelp is{" "}
            {entry.yelpUrl ? "using a custom link" : "generated from name and address"}.
          </p>
          <form action={updateExternalLinks} className="stack-form">
            <input type="hidden" name="restaurantId" value={entry.id} />
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
              <CheckInCard key={checkIn.id} canWrite={canWrite} checkIn={checkIn} />
            ))}
          </div>
        ) : (
          <p className="muted">No check-ins yet.</p>
        )}
        {canWrite ? (
          <form action={createCheckIn} className="checkin-new">
            <input type="hidden" name="restaurantId" value={entry.id} />
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

function RatingFields({ entry, groups }: { entry: Restaurant; groups: Restaurant["ratingGroups"] }) {
  const activeGroups = groups
    .map((group) => ({ ...group, definitions: group.definitions.filter((definition) => definition.active) }))
    .filter((group) => group.definitions.length);
  if (!activeGroups.length) return <p className="muted">No rating fields enabled.</p>;
  return (
    <div className="rating-grid">
      {activeGroups.map((group) => (
        <div className={`rating-field ${group.list.id === 0 ? "rating-field-global" : ""}`} key={group.list.id}>
          {group.list.id === 0 ? null : <span>{group.list.name}</span>}
          {group.definitions.map((definition) => {
            const value = entry.ratings.find((rating) => rating.definitionId === definition.id)?.value ?? "";
            return (
              <label key={definition.id}>
                <small>{definition.name}</small>
                <RatingInput definition={definition} value={value} disabled={false} />
              </label>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function AttributePreview({ entry, groups }: { entry: Restaurant; groups: Restaurant["ratingGroups"] }) {
  const activeGroups = groups
    .map((group) => ({ ...group, definitions: group.definitions.filter((definition) => definition.active) }))
    .filter((group) => group.definitions.length);
  if (!activeGroups.length) return <p className="muted">No attributes enabled.</p>;
  return (
    <div className="markdown-sections">
      {activeGroups.map((group) => (
        <section key={group.list.id} className="markdown-section">
          <h5>{group.list.name}</h5>
          <div className="rating-summary">
            {group.definitions.map((definition) => {
              const value = entry.ratings.find((rating) => rating.definitionId === definition.id)?.value ?? "";
              return value ? (
                <RatingBadge key={definition.id} definition={definition} value={value} />
              ) : (
                <span key={definition.id} className="entry-rating-badge">
                  {RATING_ICON_MAP[(definition.presetKey ? RATING_PRESETS.find((preset) => preset.key === definition.presetKey)?.icon : definition.icon) || "tag"] ?? <Tag size={14} />}
                  {definition.name}: Unset
                </span>
              );
            })}
          </div>
        </section>
      ))}
    </div>
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

function RatingSummary({ entry, definitions }: { entry: Restaurant; definitions: RatingDefinition[] }) {
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
    const label = "Go back";
    return (
      <span className="entry-rating-badge icon-badge positive" aria-label={label} title={label}>
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
  if (definition.presetKey === "go_back") {
    return <GoBackInput name={fieldName} value={value} disabled={disabled} />;
  }
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
    return <RatingChoiceInput name={fieldName} value={value} disabled={disabled} options={labelledOptions} label={definition.name} />;
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
        <option value=""></option>
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
      <input type="hidden" name={name} value="" disabled={disabled || selected !== ""} />
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
                onClick={(event) => {
                  if (selected === option.value) {
                    event.preventDefault();
                    setSelected("");
                  }
                }}
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

function GoBackInput({ name, value, disabled }: { name: string; value: string; disabled: boolean }) {
  const [checked, setChecked] = useState(value === "true");
  return (
    <div className={`rating-choice-group ${disabled ? "disabled" : ""}`} role="group" aria-label="Go Back">
      <input type="hidden" name={name} value="" disabled={disabled || checked} />
      <label className="rating-choice" title="Go back">
        <input
          type="checkbox"
          name={name}
          value="true"
          checked={checked}
          disabled={disabled}
          aria-label="Go back"
          onChange={(event) => setChecked(event.target.checked)}
        />
        <span>
          <CheckCircle size={16} />
        </span>
      </label>
    </div>
  );
}

function RatingChoiceInput({
  name,
  value,
  disabled,
  options,
  label,
}: {
  name: string;
  value: string;
  disabled: boolean;
  options: Array<{ value: string; label: ReactNode; ariaLabel: string }>;
  label: string;
}) {
  const [selected, setSelected] = useState(value);
  return (
    <div className={`rating-choice-group ${disabled ? "disabled" : ""}`} role="radiogroup" aria-label={label}>
      <input type="hidden" name={name} value="" disabled={disabled || selected !== ""} />
      {options.map((option) => (
        <RatingRadio
          key={option.value}
          name={name}
          value={option.value}
          checked={selected === option.value}
          disabled={disabled}
          label={option.label}
          ariaLabel={option.ariaLabel}
          title={option.ariaLabel}
          onSelect={(nextValue) => setSelected(selected === nextValue ? "" : nextValue)}
        />
      ))}
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
  onSelect,
}: {
  name: string;
  value: string;
  checked: boolean;
  disabled: boolean;
  label: ReactNode;
  ariaLabel?: string;
  title?: string;
  onSelect: (value: string) => void;
}) {
  const fallbackLabel = typeof label === "string" ? label : value || "Rating option";
  return (
    <label className="rating-choice" title={title}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel ?? fallbackLabel}
        onClick={(event) => {
          if (checked) event.preventDefault();
          onSelect(value);
        }}
        onChange={() => onSelect(value)}
      />
      <span>{label}</span>
    </label>
  );
}

function ratingOptions(definition: RatingDefinition) {
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

function googleMapsUrl(restaurant: Restaurant) {
  const query = [restaurant.name, restaurant.address].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function yelpUrl(restaurant: Restaurant) {
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
