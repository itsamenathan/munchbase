"use client";

import { type FormEvent, type ReactNode } from "react";
import { MapPin, Plus, Search } from "lucide-react";
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
      <form action="/mutate" method="post" className="stack-form">
        <input type="hidden" name="__action" value="addRestaurant" />
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
  nearbyResults,
  placeSearchStatus,
  searchPlaces,
}: {
  state: AppState;
  canWrite: boolean;
  placeQuery: string;
  setPlaceQuery: (v: string) => void;
  placeResults: PlaceResult[];
  nearbyResults: PlaceResult[];
  placeSearchStatus: string;
  searchPlaces: (e?: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  if (!canWrite) return null;
  const isSearching = placeQuery.trim().length >= 2;
  const existingMatches = isSearching
    ? state.allRestaurants.filter((r) => {
        const needle = placeQuery.trim().toLowerCase();
        return [r.name, r.address].filter(Boolean).join(" ").toLowerCase().includes(needle);
      }).slice(0, 6)
    : [];

  // Nearby results that aren't already in Munchbase
  const newNearbyResults = nearbyResults.filter(
    (place) => !state.allRestaurants.some((r) => r.name.toLowerCase() === place.name.toLowerCase())
  );

  const hasResults = existingMatches.length > 0 || placeResults.length > 0 || (!isSearching && newNearbyResults.length > 0);
  const targetLabel = state.activeList ? state.activeList.name : "your restaurants";

  return (
    <section className="tool-panel add-restaurants-panel">
      {state.activeList ? <p className="kicker">{state.activeList.name}</p> : null}
      <form className="place-search" onSubmit={searchPlaces}>
        <input
          aria-label="Search for a restaurant to add"
          value={placeQuery}
          onChange={(e) => setPlaceQuery(e.target.value)}
          placeholder="Search for a restaurant"
        />
        <button type="submit" aria-label="Search places"><Search size={16} /></button>
      </form>
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
                <form action={state.activeListId && !alreadyInList ? "/mutate" : undefined} method="post" className="place-result" key={r.id}>
                  <input type="hidden" name="__action" value="attachRestaurantToList" />
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

      {!isSearching && newNearbyResults.length > 0 ? (
        <>
          <h4 className="add-section-label"><MapPin size={14} /> Nearby</h4>
          <div className="add-results-list">
            {newNearbyResults.map((place) => (
              <form action="/mutate" method="post" className="place-result" key={`${place.osmType}-${place.osmId}`}>
                <input type="hidden" name="__action" value="addRestaurant" />
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

      {placeResults.length > 0 ? (
        <>
          <h4 className="add-section-label"><MapPin size={14} /> Search results</h4>
          <div className="add-results-list">
            {placeResults.map((place) => (
              <form action="/mutate" method="post" className="place-result" key={`${place.osmType}-${place.osmId}`}>
                <input type="hidden" name="__action" value="addRestaurant" />
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
