export type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    osm_type?: string;
    osm_id?: number;
    osm_key?: string;
    osm_value?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
    display_name?: string;
  };
};

export type PlaceSearchResult = {
  osmType: string;
  osmId: string;
  name: string;
  address: string;
  lat: string;
  lon: string;
  rawJson: string;
};

const OSM_TYPE: Record<string, string> = { N: "node", W: "way", R: "relation" };

export function buildPhotonAddress(p: PhotonFeature["properties"]): string {
  const parts = [
    [p.housenumber, p.street].filter(Boolean).join(" "),
    p.city,
    p.state,
    p.postcode,
    p.country,
  ].filter(Boolean);
  return parts.join(", ");
}

export function mapPhotonFeature(f: PhotonFeature): PlaceSearchResult {
  const p = f.properties;
  const [fLon, fLat] = f.geometry.coordinates;
  return {
    osmType: OSM_TYPE[p.osm_type ?? ""] ?? p.osm_type ?? "",
    osmId: String(p.osm_id ?? ""),
    name: p.name ?? p.display_name ?? "Unnamed place",
    address: buildPhotonAddress(p),
    lat: String(fLat),
    lon: String(fLon),
    rawJson: JSON.stringify(f),
  };
}

export async function reverseGeocodeAddress(lat: number, lon: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const url = new URL("https://photon.komoot.io/reverse");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lon));
    url.searchParams.set("radius", "0.25");
    url.searchParams.set("limit", "1");
    url.searchParams.set("lang", "en");
    const response = await fetch(url, {
      headers: { "User-Agent": process.env.OSM_USER_AGENT ?? "munchbase/0.1" },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { features?: PhotonFeature[] };
    const feature = data.features?.[0];
    if (!feature) return null;
    return buildPhotonAddress(feature.properties) || feature.properties.display_name || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
