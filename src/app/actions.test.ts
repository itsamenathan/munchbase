import { describe, expect, it } from "vitest";
import { normalizeExternalUrl } from "../lib/external-links";

describe("external link validation", () => {
  it("accepts google maps urls and clears blanks", () => {
    expect(normalizeExternalUrl("", "google")).toBeNull();
    expect(normalizeExternalUrl("https://maps.google.com/?q=test", "google")).toContain("maps.google.com");
    expect(normalizeExternalUrl("https://maps.app.goo.gl/abc", "google")).toContain("maps.app.goo.gl");
  });

  it("rejects non-google urls for google overrides", () => {
    expect(() => normalizeExternalUrl("https://example.com", "google")).toThrow();
  });

  it("accepts only yelp urls for yelp overrides", () => {
    expect(normalizeExternalUrl("https://www.yelp.com/biz/test", "yelp")).toContain("yelp.com");
    expect(() => normalizeExternalUrl("https://maps.google.com/?q=test", "yelp")).toThrow();
  });
});
