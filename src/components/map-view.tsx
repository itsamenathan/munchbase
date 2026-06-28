"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { formatWallDateTime } from "@/lib/datetime";
import type { Restaurant } from "@/lib/types";

const ICON_OPTIONS = { iconSize: [28, 28] as [number, number], iconAnchor: [14, 28] as [number, number], popupAnchor: [0, -26] as [number, number] };

const UNDO2_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"/></svg>`;
const X_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="M6 6l12 12"/></svg>`;

const plainIcon = L.divIcon({ ...ICON_OPTIONS, className: "restaurant-marker", html: '<span aria-hidden="true"></span>' });

function goBackIcon(value: string | undefined): L.DivIcon {
  const yes = value === "true";
  return L.divIcon({
    ...ICON_OPTIONS,
    className: `restaurant-marker ${yes ? "go-back" : "no-go"}`,
    html: `<span aria-hidden="true"><span class="marker-icon">${yes ? UNDO2_SVG : X_SVG}</span></span>`,
  });
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
  const withCoords = restaurants.filter((restaurant) => restaurant.lat !== null && restaurant.lon !== null);
  const center = withCoords[0] ? [withCoords[0].lat!, withCoords[0].lon!] : [39.5, -98.35];
  return (
    <MapContainer center={center as [number, number]} zoom={withCoords[0] ? 12 : 4} className="map">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url={process.env.NEXT_PUBLIC_TILE_URL ?? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"}
      />
      {withCoords.map((restaurant) => {
        const goBackValue = goBackDefinitionId
          ? restaurant.ratings.find((r) => r.definitionId === goBackDefinitionId)?.value
          : undefined;
        const icon = goBackDefinitionId !== null ? goBackIcon(goBackValue) : plainIcon;
        return (
          <Marker key={restaurant.id} position={[restaurant.lat!, restaurant.lon!]} icon={icon}>
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
        );
      })}
    </MapContainer>
  );
}

function googleMapsUrl(restaurant: Restaurant) {
  const query = [restaurant.name, restaurant.address].filter(Boolean).join(" ");
  return restaurant.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
