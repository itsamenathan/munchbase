"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { Coords } from "@/lib/distance";
import { readCachedLocation, writeCachedLocation } from "@/lib/location-cache";
import type { PlaceSearchResult } from "@/lib/photon";

type Options = {
  /** Whether the Add flow is open — gates the nearby lookup. */
  nearbyEnabled: boolean;
};

/**
 * Owns the Place search half of the Add flow: the user's location, the nearby
 * lookup, and the query/results/status triple.
 *
 * `panelProps` matches the shared prop surface of AddRestaurantsPanel and
 * AddRestaurantSheet, so callers can spread it into either.
 */
export function usePlaceSearch({ nearbyEnabled }: Options) {
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeResults, setPlaceResults] = useState<PlaceSearchResult[]>([]);
  const [placeSearchStatus, setPlaceSearchStatus] = useState("");
  const [searchGlobal, setSearchGlobal] = useState(false);
  const [nearbyResults, setNearbyResults] = useState<PlaceSearchResult[]>([]);
  const [locationCoords, setLocationCoords] = useState<Coords | null>(null);

  useEffect(() => {
    // Seed from cache immediately so location is available before GPS resolves.
    // This has to run in an effect, not a lazy useState initializer: localStorage
    // is unavailable during SSR, so seeding at render would mismatch on hydration.
    const cached = readCachedLocation();
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    if (!nearbyEnabled || !locationCoords) return;
    const { lat, lon } = locationCoords;
    fetch(`/api/search?nearby=1&lat=${lat}&lon=${lon}`)
      .then((r) => r.json())
      .then((data: { results?: PlaceSearchResult[] }) => setNearbyResults(data.results ?? []))
      .catch(() => {});
  }, [nearbyEnabled, locationCoords]);

  const reset = useCallback(() => {
    setPlaceQuery("");
    setPlaceResults([]);
    setPlaceSearchStatus("");
    setSearchGlobal(false);
  }, []);

  // Clear the previous session's query and results whenever the Add flow closes,
  // including via the back button.
  const previousEnabledRef = useRef(nearbyEnabled);
  useEffect(() => {
    if (previousEnabledRef.current && !nearbyEnabled) reset();
    previousEnabledRef.current = nearbyEnabled;
  }, [nearbyEnabled, reset]);

  const searchPlaces = useCallback(
    async (e?: FormEvent<HTMLFormElement>) => {
      e?.preventDefault();
      // Dismiss the mobile keyboard so results are visible.
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
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
      if (searchGlobal) params.set("global", "1");
      const response = await fetch(`/api/search?${params.toString()}`);
      const data = (await response.json()) as { results?: PlaceSearchResult[]; error?: string };
      if (data.error) {
        setPlaceSearchStatus(data.error);
        setPlaceResults([]);
        return;
      }
      setPlaceResults(data.results ?? []);
      setPlaceSearchStatus(data.results?.length ? `${data.results.length} places found.` : "No places found.");
    },
    [locationCoords, placeQuery, searchGlobal],
  );

  return {
    locationCoords,
    panelProps: {
      placeQuery,
      setPlaceQuery,
      placeResults,
      nearbyResults,
      placeSearchStatus,
      searchPlaces,
      searchGlobal,
      setSearchGlobal,
    },
  };
}
