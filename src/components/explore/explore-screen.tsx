"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Filter, Plus, Search, X } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { RatingBadge } from "@/components/restaurant/rating-badge";
import { formatCityState } from "@/lib/address";
import { readCachedLocation, writeCachedLocation } from "@/lib/location-cache";
import { addHref, restaurantHref } from "@/lib/routes";
import { compareRestaurantNames } from "@/lib/restaurant-sort";
import type { List, RatingDefinition, RestaurantSummary } from "@/lib/types";

const MapView = dynamic(() => import("@/components/map-view"), { ssr: false });
const NEARBY_RADIUS_MILES = 5;

function distanceMiles(from: { lat: number; lon: number }, to: { lat: number; lon: number }) {
  const radians = (degrees: number) => degrees * (Math.PI / 180);
  const latitudeDelta = radians(to.lat - from.lat);
  const longitudeDelta = radians(to.lon - from.lon);
  const fromLatitude = radians(from.lat);
  const toLatitude = radians(to.lat);
  const haversine = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function formatDistance(miles: number) {
  return miles < 0.1 ? "< 0.1 mi" : `${miles.toFixed(miles < 10 ? 1 : 0)} mi`;
}

export function ExploreScreen({
  mode,
  activeList,
  restaurants,
  globalRatingDefinitions,
  listRatingDefinitions,
}: {
  mode: "explore" | "map";
  activeList: List | null;
  restaurants: RestaurantSummary[];
  globalRatingDefinitions: RatingDefinition[];
  listRatingDefinitions: RatingDefinition[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filterDefinition, setFilterDefinition] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lon: number } | null>(null);
  const activeListId = activeList?.id ?? null;
  const definitions = useMemo(() => [...globalRatingDefinitions, ...listRatingDefinitions], [globalRatingDefinitions, listRatingDefinitions]);

  useEffect(() => {
    const cached = readCachedLocation();
    if (cached) setLocationCoords(cached);
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition((position) => {
      const coords = { lat: position.coords.latitude, lon: position.coords.longitude };
      writeCachedLocation(coords.lat, coords.lon);
      setLocationCoords(coords);
    }, () => {}, { maximumAge: 5 * 60 * 1000, timeout: 15000 });
  }, []);

  const filtered = useMemo(() => {
    const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
    const needle = normalize(query);
    return restaurants.filter((restaurant) => {
      const haystack = normalize([restaurant.name, restaurant.address, restaurant.notes].filter(Boolean).join(" "));
      const textMatch = !needle || haystack.includes(needle);
      const ratingMatch = !filterDefinition || !filterValue || restaurant.ratings.some((rating) => String(rating.definitionId) === filterDefinition && rating.value === filterValue);
      return textMatch && ratingMatch;
    }).sort((a, b) => compareRestaurantNames(a.name, b.name));
  }, [filterDefinition, filterValue, query, restaurants]);

  const distances = useMemo(() => new Map(filtered.flatMap((restaurant) =>
    locationCoords && restaurant.lat !== null && restaurant.lon !== null
      ? [[restaurant.id, distanceMiles(locationCoords, { lat: restaurant.lat, lon: restaurant.lon })] as const]
      : [],
  )), [filtered, locationCoords]);
  const nearby = filtered.filter((restaurant) => (distances.get(restaurant.id) ?? Infinity) <= NEARBY_RADIUS_MILES);
  const nearbyIds = new Set(nearby.map((restaurant) => restaurant.id));
  const other = filtered.filter((restaurant) => !nearbyIds.has(restaurant.id));
  const selectedDefinition = definitions.find((definition) => String(definition.id) === filterDefinition);

  return (
    <>
      <div className="toolbar">
        <label className="search-box"><span className="sr-only">Search restaurants</span><Search size={17} /><input type="search" aria-label="Search restaurants" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search restaurants, notes, tips" /></label>
        <button type="button" className={`filter-toggle ${filterDefinition ? "active" : ""}`} onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen}><Filter size={16} /><span>{filterDefinition ? "Filtered" : "Filter"}</span></button>
        <Link className="add-restaurant-trigger" href={addHref(activeListId)}><Plus size={17} /><span>Add</span></Link>
      </div>
      {filtersOpen ? (
        <section className="filter-panel" aria-label="Explore filters">
          <div className="filter-panel-head"><h3>Filter by ratings</h3><div className="filter-panel-actions"><button type="button" className="ghost-button icon-button" onClick={() => setFiltersOpen(false)} aria-label="Close filters"><X size={16} /></button></div></div>
          <label><span>Attribute</span><select value={filterDefinition} onChange={(event) => { setFilterDefinition(event.target.value); setFilterValue(""); }}><option value="">Any rating</option>{definitions.filter((definition) => definition.active).map((definition) => <option key={definition.id} value={definition.id}>{definition.name}</option>)}</select></label>
          {selectedDefinition ? <label><span>Value</span><select value={filterValue} onChange={(event) => setFilterValue(event.target.value)}><option value="">Choose value</option><RatingFilterOptions definition={selectedDefinition} /></select></label> : null}
        </section>
      ) : null}
      {mode === "map" ? (
        <MapView restaurants={filtered} globalRatingDefinitions={globalRatingDefinitions} goBackDefinitionId={globalRatingDefinitions.find((definition) => definition.presetKey === "go_back" && definition.active)?.id ?? null} onSelectRestaurant={(id) => router.push(restaurantHref(id, activeListId, { origin: "map" }), { scroll: false })} />
      ) : (
        <div className="content-grid restaurant-content-grid">
          <section className="results">
            <h3 className="results-heading">{activeList?.name ?? "All restaurants"}</h3>
            {!filtered.length ? <EmptyState icon={<ClipboardList size={32} />} title={query || filterDefinition ? "No restaurants match your search." : "No restaurants yet."} description={query || filterDefinition ? "Try adjusting your search or filters." : "Add your first restaurant to get started."} /> : (
              (locationCoords && nearby.length ? [
                { label: "Nearby", detail: `Within ${NEARBY_RADIUS_MILES} miles`, items: nearby, distance: true },
                ...(other.length ? [{ label: "More restaurants", detail: "A-Z", items: other, distance: false }] : []),
              ] : [{ label: "All restaurants", detail: "A-Z", items: filtered, distance: false }]).map((section) => (
                <div className="restaurant-section" key={section.label}>
                  <div className="restaurant-section-heading"><strong>{section.label}</strong><span>{section.detail}</span></div>
                  {section.items.map((restaurant) => (
                    <Link className="restaurant-row" href={restaurantHref(restaurant.id, activeListId, { origin: mode })} key={restaurant.id}>
                      <span><span className="restaurant-row-top"><strong>{restaurant.name}</strong></span><small>{formatCityState(restaurant.address) || restaurant.address}</small><span className="rating-icons">{definitions.filter((definition) => definition.active).map((definition) => { const value = restaurant.ratings.find((rating) => rating.definitionId === definition.id)?.value; return value ? <RatingBadge key={definition.id} definition={definition} value={value} /> : null; })}</span></span>
                      <span className="restaurant-row-meta">{section.distance ? <strong>{formatDistance(distances.get(restaurant.id) ?? 0)}</strong> : null}{restaurant.checkInCount ? <span>{restaurant.checkInCount} visit{restaurant.checkInCount === 1 ? "" : "s"}</span> : null}</span>
                    </Link>
                  ))}
                </div>
              ))
            )}
          </section>
        </div>
      )}
    </>
  );
}

function RatingFilterOptions({ definition }: { definition: RatingDefinition }) {
  if (definition.type === "boolean") return <><option value="true">Yes</option><option value="false">No</option></>;
  if (definition.type === "scale") return <>{Array.from({ length: (definition.max ?? 5) - (definition.min ?? 1) + 1 }, (_, index) => index + (definition.min ?? 1)).map((value) => <option key={value} value={value}>{value}</option>)}</>;
  return <>{definition.options.map((option) => <option key={option} value={option}>{option}</option>)}</>;
}
