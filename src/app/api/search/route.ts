import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";

let lastRequestAt = 0;

const FOOD_TAGS = [
  "amenity:restaurant",
  "amenity:fast_food",
  "amenity:cafe",
  "amenity:bar",
  "amenity:pub",
  "amenity:food_court",
];

type PhotonFeature = {
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

const OSM_TYPE: Record<string, string> = { N: "node", W: "way", R: "relation" };

function buildAddress(p: PhotonFeature["properties"]): string {
  const parts = [
    [p.housenumber, p.street].filter(Boolean).join(" "),
    p.city,
    p.state,
    p.postcode,
    p.country,
  ].filter(Boolean);
  return parts.join(", ");
}

function mapFeature(f: PhotonFeature) {
  const p = f.properties;
  const [fLon, fLat] = f.geometry.coordinates;
  return {
    osmType: OSM_TYPE[p.osm_type ?? ""] ?? p.osm_type ?? "",
    osmId: String(p.osm_id ?? ""),
    name: p.name ?? p.display_name ?? "Unnamed place",
    address: buildAddress(p),
    lat: String(fLat),
    lon: String(fLon),
    rawJson: JSON.stringify(f),
  };
}

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));
  const nearby = searchParams.get("nearby") === "1";

  const hasLocation = Number.isFinite(lat) && Number.isFinite(lon);

  // Nearby mode: no query required, uses Photon reverse with radius
  if (nearby) {
    if (!hasLocation) {
      return NextResponse.json({ error: "Location required for nearby search." }, { status: 400 });
    }
    const start = Date.now();
    const url = new URL("https://photon.komoot.io/reverse");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lon));
    url.searchParams.set("radius", "1"); // 1 km — street-level proximity
    url.searchParams.set("limit", "20");
    url.searchParams.set("lang", "en");
    for (const tag of FOOD_TAGS) url.searchParams.append("osm_tag", tag);
    const response = await fetch(url, {
      headers: { "User-Agent": process.env.OSM_USER_AGENT ?? "munchbase/0.1" },
    });
    if (!response.ok) {
      logger.warn("Nearby search upstream error", { status: response.status });
      return NextResponse.json({ error: "Nearby search failed." }, { status: 502 });
    }
    const data = (await response.json()) as { features: PhotonFeature[] };
    const results = data.features.filter((f) => f.properties.name).map(mapFeature);
    logger.info("Nearby search", { userId: user.id, lat, lon, results: results.length, ms: Date.now() - start });
    return NextResponse.json({ results });
  }

  // Named search mode
  if (!q || q.length < 3) return NextResponse.json({ results: [] });
  const now = Date.now();
  if (now - lastRequestAt < 1000) {
    return NextResponse.json({ error: "Please wait a moment before searching again." }, { status: 429 });
  }
  lastRequestAt = now;

  const start = Date.now();
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "20");
  url.searchParams.set("lang", "en");
  if (hasLocation) {
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lon));
  }

  const response = await fetch(url, {
    headers: { "User-Agent": process.env.OSM_USER_AGENT ?? "munchbase/0.1" },
  });
  if (!response.ok) {
    logger.warn("Place search upstream error", { q, status: response.status });
    return NextResponse.json({ error: "Place search failed." }, { status: 502 });
  }

  const data = (await response.json()) as { features: PhotonFeature[] };
  const results = data.features.map(mapFeature);
  logger.info("Place search", { userId: user.id, q, hasLocation, results: results.length, ms: Date.now() - start });
  return NextResponse.json({ results });
}
