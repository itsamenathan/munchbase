"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { ClipboardList, Filter, Plus, Search, X } from "lucide-react";
import { RatingFilterOptions } from "@/components/explore/rating-filter-options";
import { RatingBadge } from "@/components/restaurant/rating-badge";
import { EmptyState } from "@/components/shared/empty-state";
import type { RestaurantFilter } from "@/hooks/use-restaurant-filter";
import { formatCityState } from "@/lib/address";
import { formatDistance, NEARBY_RADIUS_MILES, type Coords } from "@/lib/distance";
import type { AppState, RatingDefinition, Restaurant } from "@/lib/types";

const MapView = dynamic(() => import("@/components/map-view"), { ssr: false });

type ExploreState = AppState & {
  activeListId: number | null;
  restaurants: Restaurant[];
  ratingDefinitions: RatingDefinition[];
};

type Section = {
  label: string;
  detail: string;
  restaurants: Restaurant[];
  showDistance: boolean;
};

/**
 * Groups the filtered restaurants into a Nearby / More split when a location is
 * known and something is actually within range, and a single A–Z list otherwise.
 */
function buildSections(
  filter: RestaurantFilter,
  locationCoords: Coords | null,
): Section[] {
  if (locationCoords && filter.nearbyRestaurants.length > 0) {
    return [
      {
        label: "Nearby",
        detail: `Within ${NEARBY_RADIUS_MILES} miles`,
        restaurants: filter.nearbyRestaurants,
        showDistance: true,
      },
      ...(filter.otherRestaurants.length > 0
        ? [{ label: "More restaurants", detail: "A–Z", restaurants: filter.otherRestaurants, showDistance: false }]
        : []),
    ];
  }
  return [{
    label: "All restaurants",
    detail: locationCoords ? `None within ${NEARBY_RADIUS_MILES} miles · A–Z` : "A–Z",
    restaurants: filter.restaurants,
    showDistance: false,
  }];
}

export function ExploreView({
  state,
  filter,
  definitions,
  locationCoords,
  showMap,
  activeListName,
  selectedRestaurantId,
  pendingRestaurantIds,
  hasDetail,
  addOpen,
  onOpenAdd,
  onSelectRestaurant,
  onSelectFromMap,
  detail,
}: {
  state: ExploreState;
  filter: RestaurantFilter;
  definitions: RatingDefinition[];
  locationCoords: Coords | null;
  showMap: boolean;
  activeListName: string;
  selectedRestaurantId: number | null;
  pendingRestaurantIds: number[];
  hasDetail: boolean;
  addOpen: boolean;
  onOpenAdd: () => void;
  onSelectRestaurant: (id: number) => void;
  onSelectFromMap: (id: number) => void;
  /** Right-hand pane: List settings, Restaurant detail, or the empty state. */
  detail: ReactNode;
}) {
  const { query, filterDefinition, filterValue, filtersOpen, selectedFilterDefinition } = filter;
  const isFiltered = Boolean(query || filterDefinition);

  return (
    <>
      <div className="toolbar">
        <label className="search-box">
          <span className="sr-only">Search restaurants</span>
          <Search size={17} />
          <input
            type="search"
            aria-label="Search restaurants"
            value={query}
            onChange={(e) => filter.setQuery(e.target.value)}
            placeholder="Search restaurants, notes, tips"
          />
        </label>
        <button
          type="button"
          className={`filter-toggle ${filterDefinition ? "active" : ""}`}
          onClick={() => filter.setFiltersOpen((open) => !open)}
          aria-label={filterDefinition ? "Open active Explore filters" : "Open Explore filters"}
          aria-expanded={filtersOpen}
          aria-controls="explore-filters"
        >
          <Filter size={16} />
          <span>{filterDefinition ? "Filtered" : "Filter"}</span>
        </button>
        <button
          type="button"
          className="add-restaurant-trigger"
          onClick={onOpenAdd}
          aria-label="Add restaurant"
          aria-expanded={addOpen}
          aria-controls="add-restaurant-sheet"
        >
          <Plus size={17} />
          <span>Add</span>
        </button>
      </div>

      {filtersOpen ? (
        <section className="filter-panel" id="explore-filters" aria-label="Explore filters">
          <div className="filter-panel-head">
            <h3>Filter by ratings</h3>
            <div className="filter-panel-actions">
              {filterDefinition ? (
                <button type="button" className="ghost-button compact-button" onClick={filter.clearRatingFilter}>
                  Clear
                </button>
              ) : null}
              <button
                type="button"
                className="ghost-button icon-button"
                onClick={() => filter.setFiltersOpen(false)}
                aria-label="Close filters"
              >
                <X size={16} />
              </button>
            </div>
          </div>
          <label>
            <span>Attribute</span>
            <select
              value={filterDefinition}
              onChange={(e) => {
                filter.setFilterDefinition(e.target.value);
                filter.setFilterValue("");
              }}
            >
              <option value="">Any rating</option>
              {definitions.filter((d) => d.active).map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </label>
          {selectedFilterDefinition ? (
            <label>
              <span>Value</span>
              <select value={filterValue} onChange={(e) => filter.setFilterValue(e.target.value)}>
                <option value="">Choose value</option>
                <RatingFilterOptions definition={selectedFilterDefinition} />
              </select>
            </label>
          ) : null}
        </section>
      ) : filterDefinition && selectedFilterDefinition ? (
        <button type="button" className="active-filter-chip" onClick={() => filter.setFiltersOpen(true)}>
          <Filter size={13} />
          {selectedFilterDefinition.name}
          {filterValue ? `: ${filterValue}` : ""}
        </button>
      ) : null}

      {showMap ? (
        <MapView
          restaurants={filter.restaurants}
          globalRatingDefinitions={state.globalRatingDefinitions}
          goBackDefinitionId={state.globalRatingDefinitions.find((d) => d.presetKey === "go_back" && d.active)?.id ?? null}
          onSelectRestaurant={onSelectFromMap}
        />
      ) : (
        <div className={`content-grid restaurant-content-grid${hasDetail ? " has-detail" : ""}`}>
          <section className="results">
            <h3 className="results-heading">{activeListName}</h3>
            {filter.restaurants.length === 0 ? (
              <EmptyState
                icon={<ClipboardList size={32} />}
                title={isFiltered ? "No restaurants match your search." : "No restaurants yet."}
                description={isFiltered ? "Try adjusting your search or filters." : "Add your first restaurant to get started."}
                action={isFiltered ? (
                  <button className="ghost-button" style={{ width: "auto" }} onClick={filter.clearAll}>
                    Clear filters
                  </button>
                ) : undefined}
              />
            ) : (
              buildSections(filter, locationCoords).map((section) => (
                <div className="restaurant-section" key={section.label}>
                  <div className="restaurant-section-heading">
                    <strong>{section.label}</strong>
                    <span>{section.detail}</span>
                  </div>
                  {section.restaurants.map((restaurant) => (
                    <RestaurantRow
                      key={restaurant.id}
                      restaurant={restaurant}
                      state={state}
                      active={selectedRestaurantId === restaurant.id}
                      pending={pendingRestaurantIds.includes(restaurant.id)}
                      distance={section.showDistance ? filter.distances.get(restaurant.id) ?? 0 : null}
                      onSelect={onSelectRestaurant}
                    />
                  ))}
                </div>
              ))
            )}
          </section>
          <section className="detail">{detail}</section>
        </div>
      )}
    </>
  );
}

function RestaurantRow({
  restaurant,
  state,
  active,
  pending,
  distance,
  onSelect,
}: {
  restaurant: Restaurant;
  state: ExploreState;
  active: boolean;
  pending: boolean;
  /** Miles, or null when this section does not show distances. */
  distance: number | null;
  onSelect: (id: number) => void;
}) {
  // go_back renders even when unrated, so the row always shows the same badge slots.
  const globalRatingIcons = state.globalRatingDefinitions.filter((d) => d.active).map((d) => {
    const rating = restaurant.ratings.find((r) => r.definitionId === d.id);
    if (!rating?.value && d.presetKey !== "go_back") return null;
    return <RatingBadge key={d.id} definition={d} value={rating?.value ?? ""} />;
  });
  const listRatingIcons = state.ratingDefinitions.filter((d) => d.active).map((d) => {
    const rating = restaurant.ratings.find((r) => r.definitionId === d.id);
    if (!rating?.value) return null;
    return <RatingBadge key={d.id} definition={d} value={rating?.value ?? ""} />;
  });

  return (
    <button
      className={`restaurant-row ${active ? "active" : ""}`}
      onClick={() => onSelect(restaurant.id)}
    >
      <span>
        <span className="restaurant-row-top">
          <strong>{restaurant.name}</strong>
          {pending ? <span className="pending-change-badge">Pending</span> : null}
        </span>
        <small>{formatCityState(restaurant.address) || restaurant.address}</small>
        {globalRatingIcons.some((i) => i) ? <span className="rating-icons">{globalRatingIcons}</span> : null}
        {listRatingIcons.some((i) => i) ? <span className="rating-icons">{listRatingIcons}</span> : null}
      </span>
      <span className="restaurant-row-meta">
        {distance !== null ? <strong>{formatDistance(distance)}</strong> : null}
        {restaurant.checkInCount ? (
          <span>{`${restaurant.checkInCount} visit${restaurant.checkInCount === 1 ? "" : "s"}`}</span>
        ) : null}
      </span>
    </button>
  );
}
