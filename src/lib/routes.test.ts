import { describe, expect, it } from "vitest";
import {
  adminHref,
  addHref,
  addListHref,
  addListStep,
  checkInRestaurantHref,
  restaurantHref,
  restaurantOrigin,
  restaurantOriginHref,
  tabHref,
} from "./routes";

describe("Root navigation routes", () => {
  it("builds every root with active List preservation", () => {
    expect(tabHref("explore", null)).toBe("/explore");
    expect(tabHref("explore", 7)).toBe("/explore?list=7");
    expect(tabHref("map", 7)).toBe("/map?list=7");
    expect(tabHref("lists", 7)).toBe("/lists?list=7");
  });
});

describe("Check-in routes", () => {
  it("builds the Check-ins route with and without an active List", () => {
    expect(tabHref("checkins", null)).toBe("/check-ins");
    expect(tabHref("checkins", 7)).toBe("/check-ins?list=7");
  });

  it("marks Restaurant links as originating from Check-ins", () => {
    expect(checkInRestaurantHref(12, null)).toBe("/restaurants/12?from=checkins");
    expect(checkInRestaurantHref(12, 7)).toBe("/restaurants/12?from=checkins&list=7");
  });
});

describe("Restaurant navigation", () => {
  it("keeps origin, List, edit, and photo state in canonical order", () => {
    expect(restaurantHref(12, 7, { origin: "map", edit: true, photoId: 9 }))
      .toBe("/restaurants/12?from=map&list=7&edit=1&photo=9");
  });

  it("falls back to Explore for missing or invalid origins", () => {
    expect(restaurantOrigin(null)).toBe("explore");
    expect(restaurantOrigin("nope")).toBe("explore");
    expect(restaurantOriginHref("explore", 7)).toBe("/explore?list=7");
  });
});

describe("full-screen overlay routes", () => {
  it("builds and parses Add List wizard state", () => {
    expect(addListHref(null)).toBe("/lists?overlay=add-list&step=details");
    expect(addListHref(7, "restaurants")).toBe("/lists?list=7&overlay=add-list&step=restaurants");
    expect(addListStep("fields")).toBe("fields");
    expect(addListStep("invalid")).toBe("details");
  });
});

describe("Add route", () => {
  it("builds the Add route with and without an active List", () => {
    expect(addHref(null)).toBe("/add");
    expect(addHref(7)).toBe("/add?list=7");
  });
});

describe("Admin route", () => {
  it("preserves a return path", () => {
    expect(adminHref("/map?list=7")).toBe("/admin?returnTo=%2Fmap%3Flist%3D7");
  });
});
