"use client";

import { type FormEvent, type ReactNode } from "react";
import { Crosshair, MapPin, Plus, Search } from "lucide-react";
import { addRestaurant, attachRestaurantToList } from "@/app/actions";
import { restaurantHref } from "@/lib/routes";
import type { AppState } from "@/lib/types";

type PlaceResult = {
  osmType: string;
  osmId: string;
  name: string;
  address: string;
  lat: string;
  lon: string;
  rawJson: string;
};

export function ManualRestaurantForm({ listId }: { listId: number | null }) {
  return (
    <details className="manual-add">
      <summary>Add manually instead</summary>
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

export function AddRestaurantsPanel({
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
  setPlaceQuery: (v: string) => void;
  placeResults: PlaceResult[];
  placeSearchStatus: string;
  locationStatus: string;
  useCurrentLocation: boolean;
  setUseCurrentLocation: (v: boolean) => void;
  searchPlaces: (e?: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  if (!canWrite) return null;
  const existingMatches = placeQuery.trim().length >= 2
    ? state.allRestaurants.filter((r) => {
        const needle = placeQuery.trim().toLowerCase();
        return [r.name, r.address].filter(Boolean).join(" ").toLowerCase().includes(needle);
      }).slice(0, 6)
    : [];

  const hasResults = existingMatches.length > 0 || placeResults.length > 0;
  const targetLabel = state.activeList ? state.activeList.name : "your restaurants";

  return (
    <section className="tool-panel add-restaurants-panel">
      <form className="place-search" onSubmit={searchPlaces}>
        <input value={placeQuery} onChange={(e) => setPlaceQuery(e.target.value)} placeholder="Search for a restaurant" />
        <button type="submit"><Search size={16} /></button>
      </form>
      <label className="toggle-row">
        <input type="checkbox" checked={useCurrentLocation} onChange={(e) => setUseCurrentLocation(e.target.checked)} />
        <Crosshair size={16} />
        Search near me
      </label>
      {locationStatus ? <p className="microcopy">{locationStatus}</p> : null}
      {placeSearchStatus ? <p className="microcopy">{placeSearchStatus}</p> : null}

      {existingMatches.length > 0 ? (
        <>
          <h4 className="add-section-label">Already in Munchbase</h4>
          <div className="add-results-list">
            {existingMatches.map((r) => {
              const alreadyInList = state.activeListId
                ? r.memberships.some((m) => m.id === state.activeListId)
                : true;
              return (
                <form action={state.activeListId && !alreadyInList ? attachRestaurantToList : undefined} className="place-result" key={r.id}>
                  <input type="hidden" name="restaurantId" value={r.id} />
                  {state.activeListId ? <input type="hidden" name="listId" value={state.activeListId} /> : null}
                  <button type={state.activeListId && !alreadyInList ? "submit" : "button"} onClick={() => {
                    if (!state.activeListId || alreadyInList) window.location.href = restaurantHref(r.id, state.activeListId);
                  }}>
                    <strong>{r.name}</strong>
                    <small>{alreadyInList ? "View restaurant" : `Add to ${targetLabel}`}</small>
                  </button>
                </form>
              );
            })}
          </div>
        </>
      ) : null}

      {placeResults.length > 0 ? (
        <>
          <h4 className="add-section-label"><MapPin size={14} /> From OpenStreetMap</h4>
          <div className="add-results-list">
            {placeResults.map((place) => (
              <form action={addRestaurant} className="place-result" key={`${place.osmType}-${place.osmId}`}>
                {state.activeListId ? <input type="hidden" name="listId" value={state.activeListId} /> : null}
                {Object.entries(place).map(([k, v]) => (<input key={k} type="hidden" name={k} value={v} />))}
                <button>
                  <strong>{place.name}</strong>
                  <small>{place.address}</small>
                </button>
              </form>
            ))}
          </div>
        </>
      ) : null}

      {!hasResults && placeSearchStatus && !placeSearchStatus.includes("Searching") ? (
        <ManualRestaurantForm listId={state.activeListId} />
      ) : null}
      {!placeSearchStatus ? (
        <ManualRestaurantForm listId={state.activeListId} />
      ) : null}
    </section>
  );
}
