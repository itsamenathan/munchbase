import { describe, expect, it } from "vitest";
import { buildCheckInFeed, formatCheckInTime, groupCheckInFeed } from "./check-ins";
import type { CheckIn, Restaurant } from "./types";

function restaurant(id: number, name: string, checkIns: CheckIn[], address: string | null = null): Restaurant {
  return {
    id,
    placeId: id,
    name,
    address,
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
    latestCheckIn: checkIns[0] ?? null,
    checkIns,
    checkInCount: checkIns.length,
    photos: [],
  };
}

function checkIn(id: number, visitedAt: string, notes: string | null = null): CheckIn {
  return { id, authorName: "Alex", visitedAt, notes };
}

describe("Check-in feed", () => {
  it("flattens Restaurant Check-ins newest-first with ID as a stable tie-breaker", () => {
    const feed = buildCheckInFeed([
      restaurant(1, "Alpha", [checkIn(1, "2026-07-16T18:00")]),
      restaurant(2, "Bravo", [
        checkIn(3, "2026-07-17T12:00"),
        checkIn(2, "2026-07-17T12:00"),
      ], "Denver, CO"),
    ]);

    expect(feed.map((item) => item.id)).toEqual([3, 2, 1]);
    expect(feed[0]).toMatchObject({ restaurantId: 2, restaurantName: "Bravo", restaurantAddress: "Denver, CO" });
  });

  it("only includes Check-ins from the supplied active List Restaurants", () => {
    const inList = restaurant(1, "In list", [checkIn(1, "2026-07-17T12:00")]);
    const outsideList = restaurant(2, "Outside list", [checkIn(2, "2026-07-17T13:00")]);

    expect(buildCheckInFeed([inList]).map((item) => item.restaurantName)).toEqual(["In list"]);
    expect(buildCheckInFeed([inList, outsideList])).toHaveLength(2);
  });

  it("groups local wall times under Today, Yesterday, and calendar dates", () => {
    const feed = buildCheckInFeed([
      restaurant(1, "Alpha", [
        checkIn(3, "2026-07-17T09:00"),
        checkIn(2, "2026-07-16T22:30"),
        checkIn(1, "2026-07-14T18:00"),
      ]),
    ]);
    const groups = groupCheckInFeed(feed, new Date(2026, 6, 17, 12, 0));

    expect(groups.map((group) => group.dateKey)).toEqual(["2026-07-17", "2026-07-16", "2026-07-14"]);
    expect(groups[0].label).toBe("Today");
    expect(groups[1].label).toBe("Yesterday");
    expect(groups[2].label).toContain("2026");
  });

  it("preserves optional notes and formats the stored wall-clock time", () => {
    const [item] = buildCheckInFeed([
      restaurant(1, "Alpha", [checkIn(1, "2026-07-17T18:30", "Patio table")]),
    ]);

    expect(item.notes).toBe("Patio table");
    expect(formatCheckInTime(item.visitedAt)).toMatch(/6:30|18:30/);
  });
});
