import { describe, expect, it } from "vitest";
import { formatCityState } from "./address";

describe("formatCityState", () => {
  it("extracts city and state from a US address", () => {
    expect(formatCityState("123 Main St, Springfield, IL 62701, United States")).toBe("Springfield, IL");
  });

  it("handles addresses without a zip", () => {
    expect(formatCityState("456 Oak Ave, Austin, Texas")).toBe("Austin, TX");
  });

  it("handles short addresses with just city, state", () => {
    expect(formatCityState("Portland, OR")).toBe("Portland, OR");
  });

  it("skips county-level segments when picking the city", () => {
    expect(formatCityState("Birdhouse, Erie, Weld County, Colorado 80516, United States")).toBe("Erie, CO");
  });

  it("falls back to the original address when parsing fails", () => {
    expect(formatCityState("Some random place")).toBe("Some random place");
  });

  it("returns empty string for null/undefined", () => {
    expect(formatCityState(null)).toBe("");
    expect(formatCityState(undefined)).toBe("");
  });
});