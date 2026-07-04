import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { mapPhotonFeature, type PhotonFeature } from "@/lib/photon";

let lastRequestAt = 0;

const FOOD_TAGS = [
  "amenity:restaurant",
  "amenity:fast_food",
  "amenity:cafe",
  "amenity:bar",
  "amenity:pub",
  "amenity:food_court",
];

const KM_PER_DEGREE_LAT = 111;

function boxAround(lat: number, lon: number, radiusKm: number): [number, number, number, number] {
  const latDelta = radiusKm / KM_PER_DEGREE_LAT;
  const lonDelta = radiusKm / (KM_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180));
  return [lon - lonDelta, lat - latDelta, lon + lonDelta, lat + latDelta];
}

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));
  const nearby = searchParams.get("nearby") === "1";
  const global = searchParams.get("global") === "1";

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
    const results = data.features.filter((f) => f.properties.name).map(mapPhotonFeature);
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
    if (!global) {
      url.searchParams.set("bbox", boxAround(lat, lon, 50).join(","));
    }
  }

  const response = await fetch(url, {
    headers: { "User-Agent": process.env.OSM_USER_AGENT ?? "munchbase/0.1" },
  });
  if (!response.ok) {
    logger.warn("Place search upstream error", { q, status: response.status });
    return NextResponse.json({ error: "Place search failed." }, { status: 502 });
  }

  const data = (await response.json()) as { features: PhotonFeature[] };
  const results = data.features.map(mapPhotonFeature);
  logger.info("Place search", { userId: user.id, q, hasLocation, results: results.length, ms: Date.now() - start });
  return NextResponse.json({ results });
}
