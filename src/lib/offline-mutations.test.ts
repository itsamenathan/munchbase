import { describe, expect, it } from "vitest";
import { applyOfflineMutation } from "./offline-mutations";
import type { AppState, Restaurant } from "./types";

function state(): AppState {
  const restaurant: Restaurant = {
    id: 10,
    placeId: 1,
    name: "Old name",
    address: "Old address",
    lat: 1,
    lon: 2,
    osmType: null,
    osmId: null,
    notes: "<!--section:1-->\nOld note",
    googleMapsUrl: null,
    yelpUrl: null,
    ratings: [{ definitionId: 1, value: "2" }],
    memberships: [],
    ratingGroups: [],
    latestCheckIn: null,
    checkIns: [],
    checkInCount: 0,
    photos: [],
  };
  return {
    user: { id: 7, name: "Nathan", email: "n@example.com", role: "admin", active: true },
    lists: [{ id: 3, name: "Favorites", description: null }],
    activeList: null,
    activeListId: null,
    restaurants: [restaurant],
    allRestaurants: [restaurant],
    globalRatingDefinitions: [{
      id: 1,
      listId: null,
      scope: "global",
      presetKey: "stars",
      name: "Stars",
      type: "scale",
      icon: "star",
      options: [],
      min: 1,
      max: 5,
      active: true,
      sortOrder: 0,
    }],
    ratingDefinitions: [],
    allRatingDefinitions: [{
      id: 1,
      listId: null,
      scope: "global",
      presetKey: "stars",
      name: "Stars",
      type: "scale",
      icon: "star",
      options: [],
      min: 1,
      max: 5,
      active: true,
      sortOrder: 0,
    }],
    noteSections: [{ id: 1, presetKey: "notes", name: "Notes", active: true, sortOrder: 0 }],
    users: [],
    appSettings: { selfSignupEnabled: false },
  };
}

describe("offline Restaurant mutations", () => {
  it("updates cached notes and ratings", () => {
    const next = applyOfflineMutation(state(), "updateEntryAndRatings", [
      ["restaurantId", "10"],
      ["note:1", "New note"],
      ["rating:1", "5"],
    ], "mutation-1");

    expect(next.allRestaurants[0].notes).toContain("New note");
    expect(next.allRestaurants[0].ratings).toEqual([{ definitionId: 1, value: "5" }]);
  });

  it("updates metadata and List membership", () => {
    const renamed = applyOfflineMutation(state(), "updateRestaurantMetadata", [
      ["restaurantId", "10"],
      ["name", "New name"],
      ["address", "New address"],
      ["lat", "40.1"],
      ["lon", "-105.2"],
    ], "mutation-2");
    const attached = applyOfflineMutation(renamed, "attachRestaurantToList", [
      ["restaurantId", "10"],
      ["listId", "3"],
    ], "mutation-3");

    expect(attached.allRestaurants[0]).toMatchObject({
      name: "New name",
      address: "New address",
      lat: 40.1,
      lon: -105.2,
      memberships: [{ id: 3, name: "Favorites" }],
    });
  });

  it("creates, edits, and deletes a pending Check-in", () => {
    const created = applyOfflineMutation(state(), "createCheckIn", [
      ["restaurantId", "10"],
      ["visitedAt", "2026-08-23T12:00"],
    ], "mutation-4");
    const checkInId = created.allRestaurants[0].checkIns[0].id;
    const updated = applyOfflineMutation(created, "updateCheckIn", [
      ["checkInId", String(checkInId)],
      ["visitedAt", "2026-08-23T13:00"],
    ], "mutation-5");
    const deleted = applyOfflineMutation(updated, "deleteCheckIn", [
      ["checkInId", String(checkInId)],
    ], "mutation-6");

    expect(checkInId).toBeLessThan(0);
    expect(updated.allRestaurants[0].checkIns[0].visitedAt).toBe("2026-08-23T13:00");
    expect(deleted.allRestaurants[0].checkInCount).toBe(0);
  });
});
