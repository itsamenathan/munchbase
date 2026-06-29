const KEY = "munchbase-location";
const TTL = 60 * 60 * 1000; // 1 hour

export function readCachedLocation(): { lat: number; lon: number } | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const { lat, lng, ts } = JSON.parse(raw) as { lat: number; lng: number; ts: number };
    if (Date.now() - ts > TTL) return null;
    return { lat, lon: lng };
  } catch { return null; }
}

export function writeCachedLocation(lat: number, lon: number) {
  try { localStorage.setItem(KEY, JSON.stringify({ lat, lng: lon, ts: Date.now() })); } catch {}
}
