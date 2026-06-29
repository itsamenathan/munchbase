import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";

let lastRequestAt = 0;

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));
  const radiusKm = Math.min(Math.max(Number(searchParams.get("radiusKm")) || 25, 1), 100);
  if (!q || q.length < 3) return NextResponse.json({ results: [] });
  const now = Date.now();
  if (now - lastRequestAt < 1000) {
    return NextResponse.json({ error: "Please wait a moment before searching again." }, { status: 429 });
  }
  lastRequestAt = now;

  const url = new URL("https://nominatim.openstreetmap.org/search");
  // Use the structured `amenity` parameter instead of free-form `q`.
  // Nominatim normalizes POI names at index time, so "mcdonalds" matches
  // "McDonald's", "chuys" matches "Chuy's", etc. — no client-side workarounds needed.
  url.searchParams.set("amenity", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "8");
  url.searchParams.set("extratags", "1");
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    const latDelta = radiusKm / 111;
    const lonDelta = radiusKm / (111 * Math.max(Math.cos((lat * Math.PI) / 180), 0.2));
    url.searchParams.set("viewbox", `${lon - lonDelta},${lat + latDelta},${lon + lonDelta},${lat - latDelta}`);
    url.searchParams.set("bounded", "1");
  }
  const response = await fetch(url, {
    headers: {
      "User-Agent": process.env.OSM_USER_AGENT ?? "munchbase/0.1",
      Referer: process.env.APP_ORIGIN ?? "http://localhost:3000",
    },
  });
  if (!response.ok) return NextResponse.json({ error: "OpenStreetMap search failed." }, { status: 502 });
  const data = (await response.json()) as Array<Record<string, unknown>>;
  return NextResponse.json({
    results: data.map((item) => ({
      osmType: String(item.osm_type ?? ""),
      osmId: String(item.osm_id ?? ""),
      name: String(item.name || item.display_name || "Unnamed place"),
      address: String(item.display_name ?? ""),
      lat: String(item.lat ?? ""),
      lon: String(item.lon ?? ""),
      rawJson: JSON.stringify(item),
    })),
  });
}
