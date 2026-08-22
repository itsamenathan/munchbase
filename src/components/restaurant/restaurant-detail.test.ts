import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "bun:test";
import type { RatingDefinition, Restaurant } from "@/lib/types";
import { RestaurantDetail } from "./restaurant-detail";

const goBackDefinition: RatingDefinition = {
  id: 1,
  listId: null,
  scope: "global",
  presetKey: "go_back",
  name: "Go Back",
  type: "boolean",
  icon: "check-circle",
  options: [],
  min: null,
  max: null,
  active: true,
  sortOrder: 0,
};

const restaurant: Restaurant = {
  id: 1,
  placeId: 1,
  name: "Test Restaurant",
  address: null,
  lat: null,
  lon: null,
  osmType: null,
  osmId: null,
  notes: null,
  googleMapsUrl: null,
  yelpUrl: null,
  ratings: [],
  memberships: [],
  ratingGroups: [],
  latestCheckIn: null,
  checkIns: [],
  checkInCount: 0,
  photos: [],
};

describe("RestaurantDetail", () => {
  it("does not nest interactive rating labels inside a field label", () => {
    const markup = renderToStaticMarkup(createElement(RestaurantDetail, {
      canWrite: true,
      entry: restaurant,
      activeListId: null,
      lists: [],
      globalRatingDefinitions: [goBackDefinition],
      ratingDefinitions: [],
      allRatingDefinitions: [],
      noteSections: [],
      initialEdit: true,
      onEditChange: () => {},
      activePhotoId: null,
      onOpenPhoto: () => {},
      onSelectPhoto: () => {},
      onClosePhoto: () => {},
    }));

    expect(markup).toContain('<div class="rating-field-row">');
    expect(markup).not.toContain('<label class="rating-field-row">');
  });
});
