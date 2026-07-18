import { describe, expect, it } from "vitest";
import { compareRestaurantNames, restaurantNameSortKey } from "./restaurant-sort";

describe("Restaurant name sorting", () => {
  it("ignores leading English articles", () => {
    expect(restaurantNameSortKey("The French Laundry")).toBe("French Laundry");
    expect(restaurantNameSortKey("A Pizza Place")).toBe("Pizza Place");
    expect(restaurantNameSortKey("An American Bistro")).toBe("American Bistro");
  });

  it("only ignores articles when they are whole leading words", () => {
    expect(restaurantNameSortKey("A&W")).toBe("A&W");
    expect(restaurantNameSortKey("Theodore's")).toBe("Theodore's");
  });

  it("sorts by the meaningful part of each name", () => {
    const names = ["The French Laundry", "Zuni Cafe", "An American Bistro", "A Pizza Place"];

    expect(names.sort(compareRestaurantNames)).toEqual([
      "An American Bistro",
      "The French Laundry",
      "A Pizza Place",
      "Zuni Cafe",
    ]);
  });
});
