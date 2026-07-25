export type Coords = { lat: number; lon: number };

/** Radius used to split Explore into "Nearby" and "More restaurants". */
export const NEARBY_RADIUS_MILES = 5;

const EARTH_RADIUS_MILES = 3958.8;

export function distanceMiles(from: Coords, to: Coords) {
  const toRadians = (degrees: number) => degrees * (Math.PI / 180);
  const latitudeDelta = toRadians(to.lat - from.lat);
  const longitudeDelta = toRadians(to.lon - from.lon);
  const fromLatitude = toRadians(from.lat);
  const toLatitude = toRadians(to.lat);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function formatDistance(miles: number) {
  return miles < 0.1 ? "< 0.1 mi" : `${miles.toFixed(miles < 10 ? 1 : 0)} mi`;
}
