"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { distanceMiles, NEARBY_RADIUS_MILES, type Coords } from "@/lib/distance";
import { parseRatingValues } from "@/lib/ratings";
import { compareRestaurantNames } from "@/lib/restaurant-sort";
import type { BottomTab } from "@/lib/routes";
import type { RatingDefinition, Restaurant } from "@/lib/types";

type Options = {
  restaurants: Restaurant[];
  definitions: RatingDefinition[];
  locationCoords: Coords | null;
  activeTab: BottomTab;
};

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Owns the Explore search and rating filter, plus the Nearby / More split.
 *
 * Lives above ExploreView because Map renders the same filtered set — searching
 * on Explore and switching to Map keeps the results.
 */
export function useRestaurantFilter({ restaurants: source, definitions, locationCoords, activeTab }: Options) {
  const [query, setQuery] = useState("");
  const [filterDefinition, setFilterDefinition] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Collapse the filter panel when the tab changes. Adjusting state during render
  // (rather than in an effect) avoids rendering the stale open panel for a frame.
  const [filtersTab, setFiltersTab] = useState(activeTab);
  if (filtersTab !== activeTab) {
    setFiltersTab(activeTab);
    setFiltersOpen(false);
  }

  useEffect(() => {
    if (!filtersOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFiltersOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [filtersOpen]);

  const selectedFilterDefinition = definitions.find((d) => String(d.id) === filterDefinition);

  const restaurants = useMemo(() => {
    const needle = normalize(query);
    const needleTokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean).map(normalize).filter(Boolean);
    return source.filter((r) => {
      const raw = [r.name, r.address, r.notes].filter(Boolean).join(" ");
      const haystack = normalize(raw);
      const haystackTokens = raw.toLowerCase().split(/\s+/).filter(Boolean).map(normalize).filter(Boolean);
      const textMatch = !needle ||
        haystack.includes(needle) ||
        needleTokens.every((nw) => haystackTokens.some((hw) => hw.includes(nw)));
      const ratingMatch =
        !filterDefinition ||
        !filterValue ||
        r.ratings.some(
          (rating) =>
            String(rating.definitionId) === filterDefinition &&
            // A `multi` value holds several labels, so match on containment.
            (selectedFilterDefinition
              ? parseRatingValues(selectedFilterDefinition, rating.value).includes(filterValue)
              : rating.value === filterValue),
        );
      return textMatch && ratingMatch;
    }).sort((a, b) => compareRestaurantNames(a.name, b.name));
  }, [source, filterDefinition, filterValue, query, selectedFilterDefinition]);

  const distances = useMemo(() => {
    const byId = new globalThis.Map<number, number>();
    if (!locationCoords) return byId;
    restaurants.forEach((restaurant) => {
      if (restaurant.lat !== null && restaurant.lon !== null) {
        byId.set(restaurant.id, distanceMiles(locationCoords, { lat: restaurant.lat, lon: restaurant.lon }));
      }
    });
    return byId;
  }, [locationCoords, restaurants]);

  const nearbyRestaurants = useMemo(
    () => restaurants
      .filter((restaurant) => (distances.get(restaurant.id) ?? Number.POSITIVE_INFINITY) <= NEARBY_RADIUS_MILES)
      .sort((a, b) =>
        (distances.get(a.id) ?? 0) - (distances.get(b.id) ?? 0) ||
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      ),
    [distances, restaurants],
  );

  const otherRestaurants = useMemo(() => {
    const nearbyIds = new Set(nearbyRestaurants.map((restaurant) => restaurant.id));
    return restaurants.filter((restaurant) => !nearbyIds.has(restaurant.id));
  }, [nearbyRestaurants, restaurants]);

  const clearRatingFilter = useCallback(() => {
    setFilterDefinition("");
    setFilterValue("");
  }, []);

  const clearAll = useCallback(() => {
    setQuery("");
    setFilterDefinition("");
    setFilterValue("");
  }, []);

  return {
    query,
    setQuery,
    filterDefinition,
    setFilterDefinition,
    filterValue,
    setFilterValue,
    filtersOpen,
    setFiltersOpen,
    selectedFilterDefinition,
    clearRatingFilter,
    clearAll,
    restaurants,
    distances,
    nearbyRestaurants,
    otherRestaurants,
  };
}

export type RestaurantFilter = ReturnType<typeof useRestaurantFilter>;
