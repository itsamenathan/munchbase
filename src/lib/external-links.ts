export function normalizeExternalUrl(value: string, service: "google" | "yelp") {
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("External link must be a valid URL.");
  }
  if (url.protocol !== "https:") throw new Error("External link must use HTTPS.");
  const host = url.hostname.toLowerCase();
  if (service === "google") {
    const isGoogleMaps =
      host === "maps.app.goo.gl" ||
      host === "goo.gl" ||
      host === "maps.google.com" ||
      host.endsWith(".google.com");
    if (!isGoogleMaps) throw new Error("Google Maps override must be a Google Maps URL.");
  }
  if (service === "yelp" && host !== "yelp.com" && host !== "www.yelp.com") {
    throw new Error("Yelp override must be a Yelp URL.");
  }
  return url.toString();
}
