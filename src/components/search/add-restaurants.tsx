"use client";

import { type FormEvent, type ReactNode, type Ref } from "react";
import { MapPin, Plus, Search } from "lucide-react";
import { restaurantHref } from "@/lib/routes";
import type { List, RestaurantPickerItem } from "@/lib/types";

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
      <summary>Manually Add</summary>
      <form action="/mutate" method="post" className="stack-form">
        <input type="hidden" name="__action" value="addRestaurant" />
        {listId ? <input type="hidden" name="listId" value={listId} /> : null}
        <input name="googleMapsUrl" type="url" inputMode="url" placeholder="Google Maps URL (optional)" />
        <p className="microcopy">Paste a Google Maps URL to fill details when possible, or enter the restaurant yourself.</p>
        <input name="name" placeholder="Restaurant name" />
        <input name="address" placeholder="Address" />
        <div className="split">
          <input name="lat" placeholder="Lat" inputMode="decimal" />
          <input name="lon" placeholder="Lon" inputMode="decimal" />
        </div>
        <button>Add restaurant</button>
      </form>
    </details>
  );
}

export type AddRestaurantsPanelProps = {
  activeList: List | null;
  restaurants: RestaurantPickerItem[];
  canWrite: boolean;
  placeQuery: string;
  setPlaceQuery: (v: string) => void;
  placeResults: PlaceResult[];
  nearbyResults: PlaceResult[];
  placeSearchStatus: string;
  searchPlaces: (e?: FormEvent<HTMLFormElement>) => Promise<void>;
  searchGlobal: boolean;
  setSearchGlobal: (v: boolean) => void;
  showListContext?: boolean;
  searchInputRef?: Ref<HTMLInputElement>;
  onOpenRestaurant?: (restaurantId: number) => void;
};

export function AddRestaurantsPanel({
  activeList,
  restaurants,
  canWrite,
  placeQuery,
  setPlaceQuery,
  placeResults,
  nearbyResults,
  placeSearchStatus,
  searchPlaces,
  searchGlobal,
  setSearchGlobal,
  showListContext = true,
  searchInputRef,
  onOpenRestaurant,
}: AddRestaurantsPanelProps) {
  if (!canWrite) return null;
  const isSearching = placeQuery.trim().length >= 2;
  const existingMatches = isSearching
    ? restaurants.filter((r) => {
        const needle = placeQuery.trim().toLowerCase();
        return [r.name, r.address].filter(Boolean).join(" ").toLowerCase().includes(needle);
      }).slice(0, 6)
    : [];

  // Nearby results that aren't already in Munchbase
  const newNearbyResults = nearbyResults.filter(
    (place) => !restaurants.some((r) => r.name.toLowerCase() === place.name.toLowerCase())
  );

  const hasResults = existingMatches.length > 0 || placeResults.length > 0 || (!isSearching && newNearbyResults.length > 0);
  const activeListId = activeList?.id ?? null;
  const targetLabel = activeList ? activeList.name : "your restaurants";

  return (
    <section className="tool-panel add-restaurants-panel">
      {showListContext && activeList ? <p className="kicker">{activeList.name}</p> : null}
      <form className="place-search" onSubmit={searchPlaces}>
        <input
          ref={searchInputRef}
          type="search"
          aria-label="Search for a restaurant to add"
          value={placeQuery}
          onChange={(e) => setPlaceQuery(e.target.value)}
          placeholder="Search for a restaurant"
        />
        <button type="submit" aria-label="Search places"><Search size={16} /></button>
      </form>
      <label className="place-search-scope">
        <input
          type="checkbox"
          checked={searchGlobal}
          onChange={(e) => setSearchGlobal(e.target.checked)}
        />
        Search everywhere
      </label>
      {placeSearchStatus ? <p className="microcopy">{placeSearchStatus}</p> : null}

      {existingMatches.length > 0 ? (
        <>
          <h4 className="add-section-label">Already in Munchbase</h4>
          <div className="add-results-list">
            {existingMatches.map((r) => {
              const alreadyInList = activeListId
                ? r.memberships.some((m) => m.id === activeListId)
                : true;
              return (
                <form action={activeListId && !alreadyInList ? "/mutate" : undefined} method="post" className="place-result" key={r.id}>
                  <input type="hidden" name="__action" value="attachRestaurantToList" />
                  <input type="hidden" name="restaurantId" value={r.id} />
                  <input type="hidden" name="openRestaurant" value="1" />
                  {activeListId ? <input type="hidden" name="listId" value={activeListId} /> : null}
                  <button type={activeListId && !alreadyInList ? "submit" : "button"} onClick={() => {
                    if (!activeListId || alreadyInList) {
                      if (onOpenRestaurant) onOpenRestaurant(r.id);
                      else window.location.href = restaurantHref(r.id, activeListId, { origin: "explore" });
                    }
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
                {activeListId ? <input type="hidden" name="listId" value={activeListId} /> : null}
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
                {activeListId ? <input type="hidden" name="listId" value={activeListId} /> : null}
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
        <ManualRestaurantForm listId={activeListId} />
      ) : null}
      {!placeSearchStatus ? (
        <ManualRestaurantForm listId={activeListId} />
      ) : null}
    </section>
  );
}
