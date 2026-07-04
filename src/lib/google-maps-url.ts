import { createHash } from "node:crypto";

export type ParsedGoogleMapsUrl = {
  name?: string;
  address?: string;
  lat?: number;
  lon?: number;
  sourceUrl: string;
  finalUrl: string;
  rawJson: string;
};

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

const GOOGLE_MAPS_HOSTS = new Set(["google.com", "www.google.com", "maps.google.com", "maps.app.goo.gl", "goo.gl"]);
const COORD_PAIR = String.raw`(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)`;

export function isGoogleMapsUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && isGoogleMapsHost(url.hostname);
  } catch {
    return false;
  }
}

export function googleMapsPlaceId(url: string) {
  return createHash("sha256").update(url).digest("hex").slice(0, 32);
}

export function parseGoogleMapsUrl(value: string): ParsedGoogleMapsUrl {
  const url = parseSupportedUrl(value);
  const fromBangCoords = matchCoords(url.toString(), /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/i);
  const fromAtCoords = matchCoords(url.toString(), new RegExp(String.raw`@${COORD_PAIR}`, "i"));
  const fromQuery = coordsFromQuery(url);
  const coords = fromBangCoords ?? fromAtCoords ?? fromQuery;
  const name = nameFromPath(url) ?? nameFromQuery(url);
  const parsed: ParsedGoogleMapsUrl = {
    ...(name ? { name } : {}),
    ...(coords ? { lat: coords.lat, lon: coords.lon } : {}),
    sourceUrl: value.trim(),
    finalUrl: url.toString(),
    rawJson: "",
  };
  parsed.rawJson = JSON.stringify({ source: "google_maps_url", sourceUrl: parsed.sourceUrl, finalUrl: parsed.finalUrl });
  return parsed;
}

export async function parseGoogleMapsUrlWithRedirects(value: string, fetchImpl: FetchLike = fetch): Promise<ParsedGoogleMapsUrl> {
  const sourceUrl = parseSupportedUrl(value);
  if (!isShortUrl(sourceUrl.hostname)) return parseGoogleMapsUrl(value);

  const finalUrl = await resolveFinalUrl(sourceUrl, fetchImpl);
  const parsed = parseGoogleMapsUrl(finalUrl);
  return {
    ...parsed,
    sourceUrl: value.trim(),
    finalUrl,
    rawJson: JSON.stringify({ source: "google_maps_url", sourceUrl: value.trim(), finalUrl }),
  };
}

function parseSupportedUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Enter a valid Google Maps URL.");
  }
  if (url.protocol !== "https:") throw new Error("Google Maps URL must use HTTPS.");
  if (!isGoogleMapsHost(url.hostname)) throw new Error("Enter a Google Maps URL.");
  return url;
}

function isGoogleMapsHost(hostname: string) {
  const host = hostname.toLowerCase();
  return GOOGLE_MAPS_HOSTS.has(host) || host.endsWith(".google.com");
}

function isShortUrl(hostname: string) {
  const host = hostname.toLowerCase();
  return host === "maps.app.goo.gl" || host === "goo.gl";
}

async function resolveFinalUrl(url: URL, fetchImpl: FetchLike) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetchImpl(url, { method: "HEAD", redirect: "follow", signal: controller.signal });
    return response.url || url.toString();
  } catch {
    const response = await fetchImpl(url, { method: "GET", redirect: "follow", signal: controller.signal });
    return response.url || url.toString();
  } finally {
    clearTimeout(timeout);
  }
}

function matchCoords(value: string, regex: RegExp) {
  const match = regex.exec(value);
  if (!match) return null;
  return normalizeCoords(match[1], match[2]);
}

function coordsFromQuery(url: URL) {
  for (const key of ["q", "query", "ll", "center"]) {
    const value = url.searchParams.get(key);
    if (!value) continue;
    const match = new RegExp(`^\\s*${COORD_PAIR}`).exec(value);
    if (!match) continue;
    const coords = normalizeCoords(match[1], match[2]);
    if (coords) return coords;
  }
  return null;
}

function normalizeCoords(latText: string, lonText: string) {
  const lat = Number(latText);
  const lon = Number(lonText);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

function nameFromPath(url: URL) {
  const parts = url.pathname.split("/").filter(Boolean);
  const placeIndex = parts.findIndex((part) => part.toLowerCase() === "place");
  const encoded = placeIndex >= 0 ? parts[placeIndex + 1] : null;
  if (!encoded) return null;
  return cleanName(decodeURIComponent(encoded.replace(/\+/g, " ")));
}

function nameFromQuery(url: URL) {
  const value = url.searchParams.get("q") ?? url.searchParams.get("query");
  if (!value || new RegExp(`^\\s*${COORD_PAIR}`).test(value)) return null;
  return cleanName(value);
}

function cleanName(value: string) {
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned || null;
}
