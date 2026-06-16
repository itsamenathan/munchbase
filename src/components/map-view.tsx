"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { formatWallDateTime } from "@/lib/datetime";
import type { RestaurantEntry } from "@/lib/types";

const restaurantIcon = L.divIcon({
  className: "restaurant-marker",
  html: '<span aria-hidden="true"></span>',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -26],
});

export default function MapView({ restaurants }: { restaurants: RestaurantEntry[] }) {
  const withCoords = restaurants.filter((restaurant) => restaurant.lat !== null && restaurant.lon !== null);
  const center = withCoords[0] ? [withCoords[0].lat!, withCoords[0].lon!] : [39.5, -98.35];
  return (
    <MapContainer center={center as [number, number]} zoom={withCoords[0] ? 12 : 4} className="map">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url={process.env.NEXT_PUBLIC_TILE_URL ?? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"}
      />
      {withCoords.map((restaurant) => (
        <Marker key={restaurant.id} position={[restaurant.lat!, restaurant.lon!]} icon={restaurantIcon}>
          <Popup>
            <strong>{restaurant.name}</strong>
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

function googleMapsUrl(restaurant: RestaurantEntry) {
  const query = [restaurant.name, restaurant.address].filter(Boolean).join(" ");
  return restaurant.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
