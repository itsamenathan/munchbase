import { describe, expect, it } from "vitest";
import { addHref, checkInRestaurantHref, tabHref } from "./routes";

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

describe("Add route", () => {
  it("builds the Add route with and without an active List", () => {
    expect(addHref(null)).toBe("/add");
    expect(addHref(7)).toBe("/add?list=7");
  });
});
