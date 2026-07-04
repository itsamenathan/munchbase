import { describe, expect, it } from "vitest";
import { googleMapsPlaceId, isGoogleMapsUrl, parseGoogleMapsUrl, parseGoogleMapsUrlWithRedirects } from "./google-maps-url";

describe("google maps url parser", () => {
  it("extracts a name and @ coordinates from a place URL", () => {
    const parsed = parseGoogleMapsUrl("https://www.google.com/maps/place/Taco+Town/@40.73061,-73.935242,17z/data=!3m1!4b1");

    expect(parsed.name).toBe("Taco Town");
    expect(parsed.lat).toBe(40.73061);
    expect(parsed.lon).toBe(-73.935242);
  });

  it("prefers exact !3d and !4d coordinates when present", () => {
    const parsed = parseGoogleMapsUrl("https://www.google.com/maps/place/Noodle+House/@1,2,17z/data=!3m1!4b1!4m6!3m5!1sabc!8m2!3d40.1!4d-73.2!16sxyz");

    expect(parsed.name).toBe("Noodle House");
    expect(parsed.lat).toBe(40.1);
    expect(parsed.lon).toBe(-73.2);
  });

  it("extracts coordinates from a query parameter", () => {
    const parsed = parseGoogleMapsUrl("https://maps.google.com/?q=40.75,-73.98");

    expect(parsed.lat).toBe(40.75);
    expect(parsed.lon).toBe(-73.98);
  });

  it("extracts a restaurant name from a query parameter", () => {
    const parsed = parseGoogleMapsUrl("https://www.google.com/maps/search/?api=1&query=Best%20Bagels");

    expect(parsed.name).toBe("Best Bagels");
    expect(parsed.lat).toBeUndefined();
  });

  it("rejects non-Google Maps URLs", () => {
    expect(isGoogleMapsUrl("https://example.com/maps/place/Taco+Town")).toBe(false);
    expect(() => parseGoogleMapsUrl("https://example.com/maps/place/Taco+Town")).toThrow("Google Maps URL");
  });

  it("resolves short URLs before parsing", async () => {
    const response = new Response(null, {
      status: 200,
    });
    Object.defineProperty(response, "url", {
      value: "https://www.google.com/maps/place/Pizza+Place/@41.1,-72.2,17z",
    });

    const parsed = await parseGoogleMapsUrlWithRedirects("https://maps.app.goo.gl/abc123", async () => response);

    expect(parsed.sourceUrl).toBe("https://maps.app.goo.gl/abc123");
    expect(parsed.finalUrl).toBe("https://www.google.com/maps/place/Pizza+Place/@41.1,-72.2,17z");
    expect(parsed.name).toBe("Pizza Place");
    expect(parsed.lat).toBe(41.1);
    expect(parsed.lon).toBe(-72.2);
  });

  it("creates stable synthetic place ids", () => {
    expect(googleMapsPlaceId("https://www.google.com/maps/place/Taco+Town")).toBe(googleMapsPlaceId("https://www.google.com/maps/place/Taco+Town"));
    expect(googleMapsPlaceId("https://www.google.com/maps/place/Taco+Town")).toHaveLength(32);
  });
});
