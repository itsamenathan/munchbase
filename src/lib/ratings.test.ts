import { describe, expect, it } from "vitest";
import { RATING_PRESETS, normalizeRatingDefinition, validateRatingValue } from "./ratings";

describe("ratings", () => {
  it("normalizes choice definitions", () => {
    expect(
      normalizeRatingDefinition({ name: "Return?", type: "choice", options: "Yes, Maybe, No" }),
    ).toMatchObject({ options: ["Yes", "Maybe", "No"] });
  });

  it("rejects inverted scales", () => {
    expect(() => normalizeRatingDefinition({ name: "Cost", type: "scale", min: 5, max: 1 })).toThrow();
  });

  it("defaults blank scales to one through five", () => {
    expect(normalizeRatingDefinition({ name: "Overall", type: "scale" })).toMatchObject({ min: 1, max: 5 });
  });

  it("validates boolean values", () => {
    expect(validateRatingValue({ id: 1, listId: null, scope: "global", presetKey: "go_back", name: "Go back", type: "boolean", icon: "heart", options: [], min: null, max: null, active: true, sortOrder: 0 }, "true")).toBe("true");
    expect(() => validateRatingValue({ id: 1, listId: null, scope: "global", presetKey: "go_back", name: "Go back", type: "boolean", icon: "heart", options: [], min: null, max: null, active: true, sortOrder: 0 }, "yes")).toThrow();
  });

  it("defines the minimal presets", () => {
    expect(RATING_PRESETS.map((preset) => preset.key)).toEqual(["go_back", "price", "stars"]);
  });

  it("validates price and stars presets", () => {
    const price = RATING_PRESETS.find((preset) => preset.key === "price")!;
    const stars = RATING_PRESETS.find((preset) => preset.key === "stars")!;
    expect(validateRatingValue({ id: 1, listId: null, scope: "global", presetKey: "price", active: true, sortOrder: 0, ...price, icon: "dollar-sign" }, "$$$")).toBe("$$$");
    expect(() => validateRatingValue({ id: 1, listId: null, scope: "global", presetKey: "price", active: true, sortOrder: 0, ...price, icon: "dollar-sign" }, "$$$$$")).toThrow();
    expect(validateRatingValue({ id: 2, listId: null, scope: "global", presetKey: "stars", active: true, sortOrder: 0, ...stars, icon: "star" }, "5")).toBe("5");
    expect(() => validateRatingValue({ id: 2, listId: null, scope: "global", presetKey: "stars", active: true, sortOrder: 0, ...stars, icon: "star" }, "6")).toThrow();
  });
});
