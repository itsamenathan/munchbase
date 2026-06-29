import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";

let lastRequestAt = 0;

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

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));
  if (!q || q.length < 3) return NextResponse.json({ results: [] });
  const now = Date.now();
  if (now - lastRequestAt < 1000) {
    return NextResponse.json({ error: "Please wait a moment before searching again." }, { status: 429 });
  }
  lastRequestAt = now;

  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "8");
  url.searchParams.set("lang", "en");
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lon));
  }

  const response = await fetch(url, {
    headers: { "User-Agent": process.env.OSM_USER_AGENT ?? "munchbase/0.1" },
  });
  if (!response.ok) return NextResponse.json({ error: "Place search failed." }, { status: 502 });

  const data = (await response.json()) as { features: PhotonFeature[] };
  return NextResponse.json({
    results: data.features.map((f) => {
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
    }),
  });
}
