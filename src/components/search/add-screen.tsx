"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AddRestaurantSheet } from "./add-restaurant-sheet";
import { AddRestaurantsPanel } from "./add-restaurants";
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

export function AddScreen({ activeList, restaurants, sheet = false, utility = false }: { activeList: List | null; restaurants: RestaurantPickerItem[]; sheet?: boolean; utility?: boolean }) {
  const router = useRouter();
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([]);
  const [nearbyResults, setNearbyResults] = useState<PlaceResult[]>([]);
  const [placeSearchStatus, setPlaceSearchStatus] = useState("");
  const [searchGlobal, setSearchGlobal] = useState(false);
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition((position) => setLocationCoords({ lat: position.coords.latitude, lon: position.coords.longitude }), () => {}, { maximumAge: 5 * 60 * 1000, timeout: 15000 });
  }, []);

  useEffect(() => {
    if (!locationCoords) return;
    fetch(`/api/search?nearby=1&lat=${locationCoords.lat}&lon=${locationCoords.lon}`)
      .then((response) => response.json())
      .then((data: { results?: PlaceResult[] }) => setNearbyResults(data.results ?? []))
      .catch(() => {});
  }, [locationCoords]);

  const searchPlaces = useCallback(async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
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
    const response = await fetch(`/api/search?${params}`);
    const data = await response.json() as { results?: PlaceResult[]; error?: string };
    setPlaceResults(data.results ?? []);
    setPlaceSearchStatus(data.error ?? (data.results?.length ? `${data.results.length} places found.` : "No places found."));
  }, [locationCoords, placeQuery, searchGlobal]);

  const props = {
    activeList,
    restaurants,
    canWrite: true,
    placeQuery,
    setPlaceQuery,
    placeResults,
    nearbyResults,
    placeSearchStatus,
    searchPlaces,
    searchGlobal,
    setSearchGlobal,
    onOpenRestaurant: (id: number) => {
      const href = restaurantHref(id, activeList?.id ?? null, { origin: "explore" });
      if (sheet) router.replace(href, { scroll: false });
      else router.push(href, { scroll: false });
    },
  };
  if (utility) return <div data-add-surface="utility"><AddRestaurantsPanel {...props} /></div>;
  if (sheet) return <div data-add-surface="panel"><AddRestaurantSheet {...props} activeListName={activeList?.name ?? "All restaurants"} onClose={() => router.back()} /><div className="add-panel-desktop"><header><p className="kicker">{activeList?.name ?? "All restaurants"}</p><h2>Add restaurant</h2></header><AddRestaurantsPanel {...props} /></div></div>;
  return <div className="standalone-tool-page" data-add-surface="page"><header><p className="kicker">{activeList?.name ?? "All restaurants"}</p><h2>Add restaurant</h2></header><AddRestaurantsPanel {...props} /></div>;
}
