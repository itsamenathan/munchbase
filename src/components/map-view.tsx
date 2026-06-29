"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { Star, DollarSign } from "lucide-react";
import { formatShortDateTime } from "@/lib/datetime";
import type { RatingDefinition, Restaurant } from "@/lib/types";

const ICON_OPTIONS = { iconSize: [28, 28] as [number, number], iconAnchor: [14, 28] as [number, number], popupAnchor: [0, -26] as [number, number] };
const PIN_HTML = '<span aria-hidden="true"></span>';

const plainIcon = L.divIcon({ ...ICON_OPTIONS, className: "restaurant-marker", html: PIN_HTML });
const goBackIcon = L.divIcon({ ...ICON_OPTIONS, className: "restaurant-marker go-back", html: PIN_HTML });
const noGoIcon = L.divIcon({ ...ICON_OPTIONS, className: "restaurant-marker no-go", html: PIN_HTML });
const locationIcon = L.divIcon({ ...ICON_OPTIONS, className: "location-marker", html: '<span aria-hidden="true"></span>', iconAnchor: [14, 14] });

// Survives tab switches (unmount/remount) within the same session.
let savedMapState: { center: [number, number]; zoom: number } | null = null;

function markerIcon(goBackDefinitionId: number | null, ratings: Restaurant["ratings"]): L.DivIcon {
  if (goBackDefinitionId === null) return plainIcon;
  const value = ratings.find((r) => r.definitionId === goBackDefinitionId)?.value;
  return value === "true" ? goBackIcon : noGoIcon;
}

function MapStateTracker() {
  const map = useMap();
  useEffect(() => {
    const save = () => {
      const c = map.getCenter();
      savedMapState = { center: [c.lat, c.lng], zoom: map.getZoom() };
    };
    map.on("moveend", save);
    return () => { map.off("moveend", save); };
  }, [map]);
  return null;
}

function LocationMarker() {
  const map = useMap();
  const [position, setPosition] = useState<[number, number] | null>(null);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setPosition(coords);
        if (!savedMapState) map.setView(coords, 14);
      },
      () => {},
    );
  }, [map]);

  if (!position) return null;
  return (
    <Marker position={position} icon={locationIcon}>
      <Popup>You are here</Popup>
    </Marker>
  );
}

function RestaurantPopup({
  restaurant,
  globalRatingDefinitions,
  onSelect,
}: {
  restaurant: Restaurant;
  globalRatingDefinitions: RatingDefinition[];
  onSelect: () => void;
}) {
  const ratings = globalRatingDefinitions
    .filter((d) => d.active && d.presetKey !== "go_back")
    .flatMap((d) => {
      const value = restaurant.ratings.find((r) => r.definitionId === d.id)?.value;
      return value ? [{ definition: d, value }] : [];
    });

  return (
    <div className="map-popup">
      <button type="button" className="map-popup-title" onClick={onSelect}>
        {restaurant.name}
      </button>
      {ratings.length > 0 && (
        <div className="map-popup-ratings">
          {ratings.map(({ definition, value }) => {
            if (definition.presetKey === "stars") {
              const num = Number(value);
              return (
                <span key={definition.id} className="map-popup-stars" aria-label={`${num} stars`}>
                  {Array.from({ length: num }, (_, i) => (
                    <Star key={i} size={13} fill="currentColor" strokeWidth={1.5} />
                  ))}
                </span>
              );
            }
            if (definition.presetKey === "price") {
              return (
                <span key={definition.id} className="map-popup-badge" aria-label={`Price: ${value}`}>
                  {Array.from({ length: value.length }, (_, i) => <DollarSign key={i} size={12} strokeWidth={2} />)}
                </span>
              );
            }
            const displayValue = value === "true" ? "Yes" : value === "false" ? "No" : value;
            return (
              <span key={definition.id} className="map-popup-badge">{definition.name}: {displayValue}</span>
            );
          })}
        </div>
      )}
      <div className="map-popup-footer">
        <span>{restaurant.latestCheckIn ? formatShortDateTime(restaurant.latestCheckIn.visitedAt) : "No visits yet"}</span>
        <a href={googleMapsUrl(restaurant)} target="_blank" rel="noreferrer">Maps ↗</a>
      </div>
    </div>
  );
}

export default function MapView({
  restaurants,
  globalRatingDefinitions,
  goBackDefinitionId,
  onSelectRestaurant,
}: {
  restaurants: Restaurant[];
  globalRatingDefinitions: RatingDefinition[];
  goBackDefinitionId: number | null;
  onSelectRestaurant: (id: number) => void;
}) {
  const withCoords = restaurants.filter((r) => r.lat !== null && r.lon !== null);
  const defaultCenter: [number, number] = withCoords[0] ? [withCoords[0].lat!, withCoords[0].lon!] : [39.5, -98.35];
  const defaultZoom = withCoords[0] ? 12 : 4;

  const initialCenter = savedMapState?.center ?? defaultCenter;
  const initialZoom = savedMapState?.zoom ?? defaultZoom;

  return (
    <MapContainer center={initialCenter} zoom={initialZoom} className="map">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url={process.env.NEXT_PUBLIC_TILE_URL ?? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"}
      />
      <MapStateTracker />
      <LocationMarker />
      {withCoords.map((restaurant) => (
        <Marker
          key={restaurant.id}
          position={[restaurant.lat!, restaurant.lon!]}
          icon={markerIcon(goBackDefinitionId, restaurant.ratings)}
        >
          <Popup>
            <RestaurantPopup
              restaurant={restaurant}
              globalRatingDefinitions={globalRatingDefinitions}
              onSelect={() => onSelectRestaurant(restaurant.id)}
            />
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

function googleMapsUrl(restaurant: Restaurant) {
  const query = [restaurant.name, restaurant.address].filter(Boolean).join(" ");
  return restaurant.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
