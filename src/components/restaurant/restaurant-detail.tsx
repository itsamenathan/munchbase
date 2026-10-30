import { useRef, useState } from "react";
import { CalendarClock, Check, LayoutList, LocateFixed, MapPin, NotebookText, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { formatCityState } from "@/lib/address";
import { NOTE_SECTION_PRESETS, parseNotes } from "@/lib/note-sections";
import { NotePreview, NotesEditField } from "./notes";
import { RatingSummary, AttributePreview } from "./rating-display";
import { RatingInput } from "./rating-input";
import { CheckInCard, PastVisitForm, QuickCheckIn } from "./checkin";
import { RestaurantPhotos } from "./restaurant-photos";
import { RATING_ICON_MAP, RATING_PRESETS, type RatingDefinition, repeatedIcon } from "./rating-common";
import { useAppMutation } from "@/hooks/use-app-mutation";
import { useEditSession } from "@/hooks/use-edit-session";
import { ratingValuesFromForm, snapshotEditBase, type EditBase } from "@/lib/entry-edit";
import type { AppState, NoteSectionDefinition, RatingValue, Restaurant } from "@/lib/types";

const NOTE_PRESET_PLACEHOLDERS: Record<string, string> = Object.fromEntries(
  NOTE_SECTION_PRESETS.map((preset) => [preset.key, preset.placeholder]),
);

function googleMapsUrl(r: Restaurant) {
  const query = [r.name, r.address].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function yelpUrl(r: Restaurant) {
  return `https://www.yelp.com/search?find_desc=${encodeURIComponent(r.name)}&find_loc=${encodeURIComponent(r.address || [r.lat, r.lon].filter((v) => v !== null).join(","))}`;
}

function GoogleMapsIcon() {
  return (
    <svg viewBox="-55.5 0 367 367" width="22" height="22" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path fill="#34A853" d="M70.5853976 271.865254C81.1995596 285.391378 90.8598594 299.639537 99.4963338 314.50654C106.870174 328.489419 109.94381 337.97007 115.333495 354.817346C118.638014 364.124835 121.625069 366.902652 128.046515 366.902652C135.045169 366.902652 138.219816 362.176756 140.672953 354.867852C145.766819 338.95854 149.763988 326.815514 156.069992 315.343493C168.443902 293.193112 183.819296 273.510299 198.927732 254.592287C203.018698 249.238677 229.462067 218.047767 241.366994 193.437035C241.366994 193.437035 255.999233 166.402027 255.999233 128.645368C255.999233 93.3274168 241.569017 68.8321265 241.569017 68.8321265L200.024428 79.9578224L174.793197 146.408963L168.552129 155.57215L167.303915 157.231625L165.64444 159.309576L162.729537 162.628525L158.56642 166.791642L136.098575 185.09637L79.928962 217.528279L70.5853976 271.865254Z" />
      <path fill="#FBBC04" d="M12.6120081 188.891517C26.3207125 220.205084 52.7568668 247.730719 70.6431185 271.8869L165.64444 159.352866C165.64444 159.352866 152.260416 176.856717 127.981579 176.856717C100.939355 176.856717 79.0920095 155.2619 79.0920095 128.032084C79.0920095 109.359386 90.325932 96.5309245 90.325932 96.5309245L25.8373003 113.811107L12.6120081 188.891517Z" />
      <path fill="#4285F4" d="M166.705061 5.78651629C198.256727 15.959818 225.262874 37.3165365 241.597878 68.8104812L165.673301 159.28793C165.673301 159.28793 176.907223 146.228586 176.907223 127.671329C176.907223 99.8065834 153.443693 78.990998 128.09702 78.990998C104.128433 78.990998 90.3620076 96.4659886 90.3620076 96.4659886L90.3620076 39.4666386L166.705061 5.78651629Z" />
      <path fill="#1A73E8" d="M30.0148476 45.7654275C48.8607087 23.2182162 82.0213432 0 127.736265 0C149.915506 0 166.625695 5.82259183 166.625695 5.82259183L90.2898565 96.5164943L36.2054099 96.5164943L30.0148476 45.7654275Z" />
      <path fill="#EA4335" d="M12.6120081 188.891517C12.6120081 188.891517 0 164.194204 0 128.414485C0 94.5972757 13.145926 65.0369799 30.0148476 45.7654275L90.3331471 96.5237094L12.6120081 188.891517Z" />
    </svg>
  );
}

function YelpIcon() {
  return (
    <svg viewBox="0 0 32 32" width="22" height="22" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        fill="#D32323"
        d="M13.961 22.279c0.246-0.273 0.601-0.444 0.995-0.444 0.739 0 1.338 0.599 1.338 1.338 0 0.016 0 0.032-0.001 0.048l0-0.002-0.237 6.483c-0.027 0.719-0.616 1.293-1.34 1.293-0.077 0-0.153-0.006-0.226-0.019l0.008 0.001c-1.763-0.303-3.331-0.962-4.69-1.902l0.039 0.025c-0.351-0.245-0.578-0.647-0.578-1.102 0-0.346 0.131-0.661 0.346-0.898l-0.001 0.001 4.345-4.829zM12.853 20.434l-6.301 1.572c-0.097 0.025-0.208 0.039-0.322 0.039-0.687 0-1.253-0.517-1.332-1.183l-0.001-0.006c-0.046-0.389-0.073-0.839-0.073-1.295 0-1.324 0.223-2.597 0.635-3.781l-0.024 0.081c0.183-0.534 0.681-0.911 1.267-0.911 0.214 0 0.417 0.050 0.596 0.14l-0.008-0.004 5.833 2.848c0.45 0.221 0.754 0.677 0.754 1.203 0 0.623-0.427 1.147-1.004 1.294l-0.009 0.002zM13.924 15.223l-6.104-10.574c-0.112-0.191-0.178-0.421-0.178-0.667 0-0.529 0.307-0.987 0.752-1.204l0.008-0.003c1.918-0.938 4.153-1.568 6.511-1.761l0.067-0.004c0.031-0.003 0.067-0.004 0.104-0.004 0.738 0 1.337 0.599 1.337 1.337v12.209c0 0.739-0.599 1.338-1.338 1.338-0.493 0-0.923-0.266-1.155-0.663l-0.003-0.006zM19.918 20.681l6.176 2.007c0.541 0.18 0.925 0.682 0.925 1.274 0 0.209-0.048 0.407-0.134 0.584l0.003-0.008c-0.758 1.569-1.799 2.889-3.068 3.945l-0.019 0.015c-0.23 0.19-0.527 0.306-0.852 0.306-0.477 0-0.896-0.249-1.134-0.625l-0.003-0.006-3.449-5.51c-0.128-0.201-0.203-0.446-0.203-0.709 0-0.738 0.598-1.336 1.336-1.336 0.147 0 0.289 0.024 0.421 0.068l-0.009-0.003zM26.197 16.742l-6.242 1.791c-0.11 0.033-0.237 0.052-0.368 0.052-0.737 0-1.335-0.598-1.335-1.335 0-0.282 0.087-0.543 0.236-0.758l-0.003 0.004 3.63-5.383c0.244-0.358 0.65-0.59 1.111-0.59 0.339 0 0.649 0.126 0.885 0.334l-0.001-0.001c1.25 1.104 2.25 2.459 2.925 3.99l0.029 0.073c0.070 0.158 0.111 0.342 0.111 0.535 0 0.608-0.405 1.121-0.959 1.286l-0.009 0.002z"
      />
    </svg>
  );
}

export function RestaurantDetail({
  canWrite,
  online,
  pending,
  entry,
  activeListId,
  lists,
  globalRatingDefinitions,
  ratingDefinitions,
  allRatingDefinitions,
  noteSections,
  initialEdit,
  onEditChange,
  activePhotoId,
  onOpenPhoto,
  onSelectPhoto,
  onClosePhoto,
}: {
  canWrite: boolean;
  online: boolean;
  pending: boolean;
  entry: Restaurant;
  activeListId: number | null;
  lists: AppState["lists"];
  globalRatingDefinitions: RatingDefinition[];
  ratingDefinitions: RatingDefinition[];
  allRatingDefinitions: RatingDefinition[];
  noteSections: NoteSectionDefinition[];
  initialEdit: boolean;
  onEditChange: (edit: boolean) => void;
  activePhotoId: number | null;
  onOpenPhoto: (photoId: number) => void;
  onSelectPhoto: (photoId: number) => void;
  onClosePhoto: () => void;
}) {
  const [entryMode, setEntryMode] = useState<"edit" | "preview">(initialEdit && canWrite ? "edit" : "preview");
  const { conflict, setConflict, freshStart, setFreshStart } = useEditSession();
  // Values loaded when the Edit button was pressed. This component remounts as edit
  // mode opens, so they arrive through the edit session rather than local state.
  const fresh = canWrite && initialEdit && freshStart?.restaurantId === entry.id ? freshStart : null;
  const [noteValues, setNoteValues] = useState(() => parseNotes((fresh ?? entry).notes));
  // What the stored values were when editing began. A save sends these alongside
  // the changed fields so the server can tell if someone else changed them first.
  const [editBase, setEditBase] = useState<EditBase>(() => snapshotEditBase(fresh ?? entry));
  const [freshEdit, setFreshEdit] = useState<{ notes: string | null; ratings: RatingValue[] } | null>(
    () => (fresh ? { notes: fresh.notes, ratings: fresh.ratings } : null),
  );
  const [ratingsKey, setRatingsKey] = useState(0);
  const [openingEdit, setOpeningEdit] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  // Global ratings (go back, price, stars) are kept apart from the list-level ones.
  const editableRatingDefinitions = [...globalRatingDefinitions, ...allRatingDefinitions];
  const [pendingMembershipIds, setPendingMembershipIds] = useState(() => new Set<number>());
  const [locationStatus, setLocationStatus] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const { submit } = useAppMutation();
  const latInputRef = useRef<HTMLInputElement>(null);
  const lonInputRef = useRef<HTMLInputElement>(null);

  // Re-sync edit mode when the route flag or the server's copy of the notes changes.
  // Adjusting state during render (rather than in an effect) avoids rendering the
  // stale mode for a frame. On mount the keys match, so this is a no-op.
  const modeKey = `${initialEdit && canWrite}|${entry.notes ?? ""}`;
  const [syncedModeKey, setSyncedModeKey] = useState(modeKey);
  if (syncedModeKey !== modeKey) {
    setSyncedModeKey(modeKey);
    const nextMode = initialEdit && canWrite ? "edit" : "preview";
    setEntryMode(nextMode);
    if (nextMode === "preview") {
      setNoteValues(parseNotes(entry.notes));
      setFreshEdit(null);
    } else if (entryMode !== "edit") {
      // Arrived in edit mode from the route (not via the Edit button): start from what is loaded.
      setEditBase(snapshotEditBase(entry));
      setNoteValues(parseNotes(entry.notes));
    }
  }

  const toggleListMembership = async (listId: number, inList: boolean) => {
    setPendingMembershipIds((prev) => {
      const next = new Set(prev);
      next.add(listId);
      return next;
    });
    const formData = new FormData();
    formData.set("__action", inList ? "removeRestaurantFromList" : "attachRestaurantToList");
    formData.set("restaurantId", String(entry.id));
    formData.set("listId", String(listId));
    try {
      await submit(formData);
    } finally {
      setPendingMembershipIds((prev) => {
        const next = new Set(prev);
        next.delete(listId);
        return next;
      });
    }
  };

  const setEditMode = (edit: boolean) => {
    onEditChange(edit);
    setEntryMode(edit ? "edit" : "preview");
  };

  // Load the stored notes and ratings first, so editing starts from what is saved
  // now rather than from a screen that may have been open for a while.
  const openEdit = async () => {
    if (openingEdit) return;
    setOpeningEdit(true);
    let loaded: { notes: string | null; ratings: RatingValue[] } | null = null;
    if (online) {
      try {
        const response = await fetch(`/api/restaurants/${entry.id}/edit-state`, {
          cache: "no-store",
          signal: AbortSignal.timeout(2500),
        });
        if (response.ok) loaded = await response.json();
      } catch {
        // Offline or slow: edit what is loaded; the server still checks for conflicts on save.
      }
    }
    // Opening edit mode remounts this component, which then starts from these values.
    setFreshStart(loaded ? { restaurantId: entry.id, ...loaded } : null);
    setConflict(null);
    setOpeningEdit(false);
    setEditMode(true);
  };

  const resetEntryEdit = () => {
    setNoteValues(parseNotes(entry.notes));
    setFreshEdit(null);
    setFreshStart(null);
    setConflict(null);
    setEditMode(false);
  };

  const conflictFields = conflict && conflict.restaurantId === entry.id ? conflict.fields : [];

  // Their version becomes the starting point, so the next save replaces it with mine.
  const rebaseConflicts = () => {
    setEditBase((previous) => {
      const next: EditBase = { notes: { ...previous.notes }, ratings: { ...previous.ratings } };
      for (const field of conflictFields) {
        const id = Number(field.key.split(":")[1]);
        if (field.key.startsWith("note:")) next.notes[id] = field.current.trim();
        else next.ratings[id] = field.current;
      }
      return next;
    });
  };

  const keepMyChanges = () => {
    rebaseConflicts();
    setConflict(null);
  };

  const useTheirVersion = () => {
    const theirRatings: Record<number, string> = {};
    for (const field of conflictFields) {
      const id = Number(field.key.split(":")[1]);
      if (field.key.startsWith("note:")) setNoteValues((previous) => ({ ...previous, [id]: field.current }));
      else theirRatings[id] = field.current;
    }
    if (Object.keys(theirRatings).length && formRef.current) {
      // Rating inputs keep their own state, so rebuild them from what is selected now plus their values.
      const merged = { ...ratingValuesFromForm(new FormData(formRef.current), editableRatingDefinitions), ...theirRatings };
      setFreshEdit({
        notes: freshEdit?.notes ?? entry.notes,
        ratings: Object.entries(merged)
          .filter(([, value]) => value)
          .map(([definitionId, value]) => ({ definitionId: Number(definitionId), value })),
      });
      setRatingsKey((key) => key + 1);
    }
    rebaseConflicts();
    setConflict(null);
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus("Current location is not available in this browser.");
      return;
    }

    setLocating(true);
    setLocationStatus("Getting current location…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude.toFixed(6);
        const lon = position.coords.longitude.toFixed(6);
        if (latInputRef.current) latInputRef.current.value = lat;
        if (lonInputRef.current) lonInputRef.current.value = lon;
        setLocationStatus("Current location added. Save to update the restaurant.");
        setLocating(false);
      },
      () => {
        setLocationStatus("Could not get current location. Check location permissions and try again.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const globalSummaryDefinitions = globalRatingDefinitions.filter((d) => d.active);
  const formEntry = freshEdit ? { ...entry, notes: freshEdit.notes, ratings: freshEdit.ratings } : entry;

  const memberLists = lists
    .filter((list) => entry.memberships.some((membership) => membership.id === list.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  const ratingGroups = [
    { list: { id: 0, name: "Global ratings" }, definitions: globalRatingDefinitions },
    ...memberLists.map((list) => ({
      list,
      definitions: allRatingDefinitions
        .filter((d) => d.scope === "list" && d.listId === list.id)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id),
    })),
  ];
  const listRatingGroups = ratingGroups.filter((group) => group.list.id !== 0);
  const hasListRatings = listRatingGroups.some((group) => group.definitions.some((definition) =>
    definition.active && Boolean(entry.ratings.find((rating) => rating.definitionId === definition.id)?.value),
  ));

  return (
    <div className="detail-content">
      <header className="detail-head">
        <div className="detail-title-group">
          <h3>{entry.name}</h3>
          {entry.address ? (
            <span className="detail-location" title={entry.address}>
              <MapPin size={14} aria-hidden="true" />
              {formatCityState(entry.address) || entry.address}
            </span>
          ) : null}
          {pending ? <span className="pending-change-badge">Pending sync</span> : null}
        </div>
        {entryMode === "preview" ? (
          // Secondary: where to look the place up. Icon-only, beside the title.
          <div className="detail-links">
            <a href={entry.googleMapsUrl || googleMapsUrl(entry)} target="_blank" rel="noreferrer" className="detail-link" aria-label="Open in Google Maps" title="Google Maps">
              <GoogleMapsIcon />
            </a>
            <a href={entry.yelpUrl || yelpUrl(entry)} target="_blank" rel="noreferrer" className="detail-link" aria-label="Open in Yelp" title="Yelp">
              <YelpIcon />
            </a>
          </div>
        ) : null}
        {entryMode === "preview" ? <RatingSummary entry={entry} definitions={globalSummaryDefinitions} /> : null}
        {entryMode === "preview" && canWrite ? (
          // Primary: the two things people do here, as an equal pair.
          <div className="detail-primary-actions">
            <QuickCheckIn entry={entry} />
            <button type="button" className="detail-action" onClick={() => void openEdit()} disabled={openingEdit} aria-busy={openingEdit} aria-label="Edit notes and ratings">
              <Pencil size={18} aria-hidden="true" />
              <span>Edit</span>
            </button>
          </div>
        ) : null}
      </header>

      {canWrite && entryMode === "edit" ? (
        <>
          <form
            ref={formRef}
            action="/mutate" method="post"
            className="entry-edit-form"
          >
            <input type="hidden" name="__action" value="updateEntryAndRatings" />
            <input type="hidden" name="restaurantId" value={entry.id} />
            {noteSections.filter((s) => s.active).map((s) => (
              <input key={`base-note-${s.id}`} type="hidden" name={`base:note:${s.id}`} value={editBase.notes[s.id] ?? ""} readOnly />
            ))}
            {[...new Map(ratingGroups.flatMap((g) => g.definitions).filter((d) => d.active).map((d) => [d.id, d])).values()].map((d) => (
              <input key={`base-rating-${d.id}`} type="hidden" name={`base:rating:${d.id}`} value={editBase.ratings[d.id] ?? ""} readOnly />
            ))}
            {conflictFields.length ? (
              <div className="conflict-banner" role="alert">
                <strong>{conflict?.message}</strong>
                <p>These now hold someone else&apos;s version. Nothing was saved, and your edits are still here.</p>
                <ul>
                  {conflictFields.map((field) => (
                    <li key={field.key}><span>{field.label}</span>: {field.display}</li>
                  ))}
                </ul>
                <div className="conflict-actions">
                  <button type="button" onClick={keepMyChanges}>Keep my changes</button>
                  <button type="button" className="ghost-button" onClick={useTheirVersion}>Use their version</button>
                </div>
              </div>
            ) : null}
            <div className="entry-edit-grid">
              <section className="entry-edit-section">
                <h5><NotebookText size={16} /> Notes</h5>
                {noteSections.filter((s) => s.active).map((s) => (
                  <NotesEditField
                    key={s.id}
                    title={s.name}
                    name={`note:${s.id}`}
                    value={noteValues[s.id] ?? ""}
                    onChange={(v) => setNoteValues((prev) => ({ ...prev, [s.id]: v }))}
                    placeholder={NOTE_PRESET_PLACEHOLDERS[s.presetKey ?? ""] ?? "Add a note"}
                  />
                ))}
              </section>
              <section className="entry-edit-section">
                <h5><Star size={16} /> Ratings</h5>
                <RatingFields key={ratingsKey} entry={formEntry} groups={ratingGroups} />
              </section>
              <section className="entry-edit-section">
                <h5><LayoutList size={16} /> Lists</h5>
                {lists.length === 0 ? (
                  <p className="muted" style={{ margin: 0 }}>No lists yet.</p>
                ) : (
                  <div className="list-toggle-grid">
                    {lists.map((list) => {
                      const inList = entry.memberships.some((membership) => membership.id === list.id);
                      return (
                        <button
                          key={list.id}
                          type="button"
                          className={`list-toggle-btn${inList ? " active" : ""}`}
                          aria-pressed={inList}
                          onClick={() => toggleListMembership(list.id, inList)}
                          disabled={pendingMembershipIds.has(list.id)}
                        >
                          <span className="list-toggle-check" aria-hidden="true">
                            {inList ? <Check size={13} /> : <Plus size={13} />}
                          </span>
                          <span className="list-toggle-name">{list.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
            <div className="form-actions entry-edit-actions">
              <button type="button" className="ghost-button" onClick={resetEntryEdit}>Cancel</button>
              <button>Save changes</button>
            </div>
          </form>
          <details className="danger-zone">
            <summary>Name, location, and delete</summary>
            <form action="/mutate" method="post" className="stack-form">
              <input type="hidden" name="__action" value="updateRestaurantMetadata" />
              <input type="hidden" name="restaurantId" value={entry.id} />
              <p className="microcopy">Changing these fields can move this restaurant on the Map and affect search labels.</p>
              <input name="name" defaultValue={entry.name} required placeholder="Restaurant name" />
              <input name="address" defaultValue={entry.address ?? ""} placeholder="Address" />
              <div className="coordinate-row">
                <div className="split">
                  <input ref={latInputRef} name="lat" defaultValue={entry.lat ?? ""} inputMode="decimal" placeholder="Lat" />
                  <input ref={lonInputRef} name="lon" defaultValue={entry.lon ?? ""} inputMode="decimal" placeholder="Lon" />
                </div>
                <button
                  type="button"
                  className="ghost-button icon-button"
                  onClick={useCurrentLocation}
                  disabled={locating}
                  aria-label={locating ? "Getting current location" : "Use current location"}
                  title={locating ? "Getting location…" : "Use current location"}
                >
                  <LocateFixed size={16} />
                </button>
              </div>
              {locationStatus ? <p className="microcopy" aria-live="polite">{locationStatus}</p> : null}
              <button>Update details</button>
            </form>
            {online ? (
              <form
                action="/mutate"
                method="post"
                onSubmit={(e) => { if (!confirm(`Permanently delete ${entry.name}? All check-ins, ratings, and photos will be removed.`)) e.preventDefault(); }}
              >
                <input type="hidden" name="__action" value="deleteRestaurant" />
                <input type="hidden" name="restaurantId" value={entry.id} />
                {activeListId ? <input type="hidden" name="listId" value={activeListId} /> : null}
                <button className="danger-button">
                  <Trash2 size={16} /> Delete restaurant
                </button>
              </form>
            ) : <p className="microcopy">Deleting a Restaurant needs a connection.</p>}
          </details>
        </>
      ) : (
        <>
          <section className="detail-section-card notes-panel">
            <div className="section-head"><span className="detail-section-title"><NotebookText size={16} /><h4>Notes</h4></span></div>
            <NotePreview sections={noteSections} values={noteValues} />
          </section>
          {hasListRatings ? (
            <section className="detail-section-card notes-panel">
              <div className="section-head"><span className="detail-section-title"><Star size={16} /><h4>Ratings</h4></span></div>
              <AttributePreview entry={entry} groups={listRatingGroups} />
            </section>
          ) : null}
          <RestaurantPhotos
            canWrite={canWrite && online}
            entry={entry}
            activePhotoId={activePhotoId}
            onOpenPhoto={onOpenPhoto}
            onSelectPhoto={onSelectPhoto}
            onClosePhoto={onClosePhoto}
          />
          <section className="detail-section-card checkin-box">
            <div className="section-head checkin-section-head">
              <span className="detail-section-title"><CalendarClock size={16} /><h4>Check-ins</h4></span>
              {entry.checkInCount > 0 ? <span className="checkin-section-count">{entry.checkInCount} {entry.checkInCount === 1 ? "visit" : "visits"}</span> : null}
            </div>
            {canWrite ? (
              // "Check in" in the header is the everyday action; back-dating is secondary, so it stays closed by default.
              <PastVisitForm entry={entry} />
            ) : null}
            {entry.latestCheckIn ? (
              <div className="checkin-list">
                {entry.checkIns.map((c) => (
                  <CheckInCard
                    key={c.id}
                    // A Check-in made offline has a temporary negative id and no server row to edit or delete yet.
                    canWrite={canWrite && online && c.id > 0}
                    checkIn={c}
                    restaurantId={entry.id}
                  />
                ))}
              </div>
            ) : (
              <p className="checkin-empty">No visits logged yet.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}


function RatingFields({ entry, groups }: { entry: Restaurant; groups: Restaurant["ratingGroups"] }) {
  const activeGroups = groups
    .map((g) => ({ ...g, definitions: g.definitions.filter((d) => d.active) }))
    .filter((g) => g.definitions.length);
  if (!activeGroups.length) return <p className="muted">No rating fields enabled.</p>;
  return (
    <div className="rating-grid">
      {activeGroups.map((g) => (
        <section className={`rating-field-card ${g.list.id === 0 ? "rating-field-global" : ""}`} key={g.list.id}>
          <div className="rating-field-card-head">
            <span>{g.list.id === 0 ? "Global ratings" : g.list.name}</span>
            <small>{g.definitions.length} fields</small>
          </div>
          <div className="rating-field-list">
            {g.definitions.map((d) => {
              const value = entry.ratings.find((r) => r.definitionId === d.id)?.value ?? "";
              return (
                <div className="rating-field-row" key={d.id}>
                  <small>{d.name}</small>
                  <RatingInput definition={d} value={value} disabled={false} />
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
