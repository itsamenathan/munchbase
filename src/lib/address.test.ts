import { describe, expect, it } from "vitest";
import { formatCityState, formatStreetCity } from "./address";

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
describe("formatStreetCity", () => {
  it("keeps the street and city, dropping state, zip, and country", () => {
    expect(formatStreetCity("421 S Main Street, Los Angeles, California, 90013, United States")).toBe("421 S Main Street, Los Angeles");
  });

  it("skips county-level segments when picking the city", () => {
    expect(formatStreetCity("Birdhouse, Erie, Weld County, Colorado 80516, United States")).toBe("Birdhouse, Erie");
  });

  it("returns just the city when there is no street segment", () => {
    expect(formatStreetCity("Portland, OR")).toBe("Portland");
  });

  it("falls back to the original address when parsing fails", () => {
    expect(formatStreetCity("Some random place")).toBe("Some random place");
  });

  it("returns empty string for null/undefined", () => {
    expect(formatStreetCity(null)).toBe("");
    expect(formatStreetCity(undefined)).toBe("");
  });
});
