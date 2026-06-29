"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { formatWallDateTime } from "@/lib/datetime";
import type { Restaurant } from "@/lib/types";

const ICON_OPTIONS = { iconSize: [28, 28] as [number, number], iconAnchor: [14, 28] as [number, number], popupAnchor: [0, -26] as [number, number] };
const PIN_HTML = '<span aria-hidden="true"></span>';

const plainIcon = L.divIcon({ ...ICON_OPTIONS, className: "restaurant-marker", html: PIN_HTML });
const goBackIcon = L.divIcon({ ...ICON_OPTIONS, className: "restaurant-marker go-back", html: PIN_HTML });
const noGoIcon = L.divIcon({ ...ICON_OPTIONS, className: "restaurant-marker no-go", html: PIN_HTML });
const locationIcon = L.divIcon({ ...ICON_OPTIONS, className: "location-marker", html: '<span aria-hidden="true"></span>', iconAnchor: [14, 14] });

function markerIcon(goBackDefinitionId: number | null, ratings: Restaurant["ratings"]): L.DivIcon {
  if (goBackDefinitionId === null) return plainIcon;
  const value = ratings.find((r) => r.definitionId === goBackDefinitionId)?.value;
  return value === "true" ? goBackIcon : noGoIcon;
}

function LocationMarker() {
  const [position, setPosition] = useState<[number, number] | null>(null);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setPosition([pos.coords.latitude, pos.coords.longitude]),
      () => {},
    );
  }, []);

  if (!position) return null;
  return (
    <Marker position={position} icon={locationIcon}>
      <Popup>You are here</Popup>
    </Marker>
  );
}

export default function MapView({
  restaurants,
  goBackDefinitionId,
  onSelectRestaurant,
}: {
  restaurants: Restaurant[];
  goBackDefinitionId: number | null;
  onSelectRestaurant: (id: number) => void;
}) {
  const withCoords = restaurants.filter((r) => r.lat !== null && r.lon !== null);
  const center = withCoords[0] ? [withCoords[0].lat!, withCoords[0].lon!] : [39.5, -98.35];
  return (
    <MapContainer center={center as [number, number]} zoom={withCoords[0] ? 12 : 4} className="map">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url={process.env.NEXT_PUBLIC_TILE_URL ?? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"}
      />
      <LocationMarker />
      {withCoords.map((restaurant) => (
        <Marker
          key={restaurant.id}
          position={[restaurant.lat!, restaurant.lon!]}
          icon={markerIcon(goBackDefinitionId, restaurant.ratings)}
        >
          <Popup>
            <button type="button" className="map-popup-title" onClick={() => onSelectRestaurant(restaurant.id)}>
              {restaurant.name}
            </button>
            <br />
            {restaurant.latestCheckIn ? `Last visit: ${formatWallDateTime(restaurant.latestCheckIn.visitedAt)}` : "No check-ins yet"}
            <br />
            <a href={googleMapsUrl(restaurant)} target="_blank" rel="noreferrer">
              Google Maps
            </a>
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
