import "fake-indexeddb/auto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppState, List, Restaurant } from "./types";
import {
  cacheAppState,
  cacheAppStateSnapshot,
  cacheLists,
  cacheRestaurants,
  clearAllOfflineData,
  clearCachedDataForUser,
  clearUnsafeRuntimeCaches,
  enqueueAction,
  enqueueMutationWithState,
  getActiveCachedAppState,
  getCachedAppState,
  getCachedLists,
  getCachedRestaurants,
  getQueuedActions,
} from "./offline-db";

function restaurant(id: number, name: string) {
  return { id, name } as Restaurant;
}

function list(id: number, name: string): List {
  return { id, name, description: null };
}

function appState(userId: number, restaurantName: string): AppState {
  return {
    user: { id: userId, name: `User ${userId}`, email: `user${userId}@example.com`, role: "user", active: true },
    lists: [list(1, "Saved")],
    activeList: null,
    activeListId: null,
    restaurants: [restaurant(1, restaurantName)],
    allRestaurants: [restaurant(1, restaurantName)],
    globalRatingDefinitions: [],
    ratingDefinitions: [],
    allRatingDefinitions: [],
    noteSections: [],
    users: [],
    appSettings: { selfSignupEnabled: false },
  };
}

beforeEach(async () => {
  await clearAllOfflineData();
});

afterAll(async () => {
  await clearAllOfflineData();
  vi.unstubAllGlobals();
});

describe("offline data isolation", () => {
  it("keeps cached app data separate for each user", async () => {
    await cacheAppState(1, "latest", { owner: "one" });
    await cacheAppState(2, "latest", { owner: "two" });
    await cacheRestaurants(1, [restaurant(1, "One")]);
    await cacheRestaurants(2, [restaurant(1, "Two")]);
    await cacheLists(1, [list(1, "First")]);
    await cacheLists(2, [list(1, "Second")]);

    await expect(getCachedAppState(1, "latest")).resolves.toEqual({ owner: "one" });
    await expect(getCachedAppState(2, "latest")).resolves.toEqual({ owner: "two" });
    await expect(getCachedRestaurants(1)).resolves.toEqual([restaurant(1, "One")]);
    await expect(getCachedRestaurants(2)).resolves.toEqual([restaurant(1, "Two")]);
    await expect(getCachedLists(1)).resolves.toEqual([list(1, "First")]);
    await expect(getCachedLists(2)).resolves.toEqual([list(1, "Second")]);
  });

  it("replaces stale records for one user without changing another user", async () => {
    await cacheRestaurants(1, [restaurant(1, "Old"), restaurant(2, "Keep")]);
    await cacheRestaurants(2, [restaurant(1, "Other user")]);

    await cacheRestaurants(1, [restaurant(2, "Keep")]);

    await expect(getCachedRestaurants(1)).resolves.toEqual([restaurant(2, "Keep")]);
    await expect(getCachedRestaurants(2)).resolves.toEqual([restaurant(1, "Other user")]);
  });

  it("removes cached data and queued mutations for only the signed-out user", async () => {
    await cacheAppState(1, "latest", { owner: "one" });
    await cacheAppState(2, "latest", { owner: "two" });
    await enqueueAction(1, "mutate", { name: "one" });
    await enqueueAction(2, "mutate", { name: "two" });

    await clearCachedDataForUser(1);

    await expect(getCachedAppState(1, "latest")).resolves.toBeUndefined();
    await expect(getQueuedActions(1)).resolves.toEqual([]);
    await expect(getCachedAppState(2, "latest")).resolves.toEqual({ owner: "two" });
    await expect(getQueuedActions(2)).resolves.toMatchObject([
      { userId: 2, action: "mutate", payload: { name: "two" } },
    ]);
  });

  it("loads the active user's complete AppState", async () => {
    await cacheAppStateSnapshot(appState(1, "One"));

    await expect(getActiveCachedAppState()).resolves.toMatchObject({
      state: { user: { id: 1 }, allRestaurants: [{ name: "One" }] },
      metadata: { userId: 1 },
    });
  });

  it("stores an optimistic snapshot and queued mutation together", async () => {
    const optimistic = appState(1, "Edited offline");
    await cacheAppStateSnapshot(appState(1, "Old"));
    await enqueueMutationWithState(1, "updateRestaurantMetadata", [
      ["__action", "updateRestaurantMetadata"],
      ["restaurantId", "1"],
      ["name", "Edited offline"],
    ], optimistic, "mutation-1");

    await expect(getActiveCachedAppState()).resolves.toMatchObject({
      state: { allRestaurants: [{ name: "Edited offline" }] },
    });
    await expect(getQueuedActions(1)).resolves.toMatchObject([
      { mutationId: "mutation-1", action: "updateRestaurantMetadata" },
    ]);
  });

  it("clears the previous account when a different user becomes active", async () => {
    await cacheAppStateSnapshot(appState(1, "One"));
    await enqueueAction(1, "updateRestaurantMetadata", { name: "One" });

    await cacheAppStateSnapshot(appState(2, "Two"));

    await expect(getQueuedActions(1)).resolves.toEqual([]);
    await expect(getCachedAppState(1, "latest")).resolves.toBeUndefined();
    await expect(getActiveCachedAppState()).resolves.toMatchObject({ state: { user: { id: 2 } } });
  });
});

describe("unsafe runtime cache cleanup", () => {
  it("deletes the old authenticated page cache", async () => {
    const deleteCache = vi.fn().mockResolvedValue(true);
    vi.stubGlobal("caches", { delete: deleteCache });

    await clearUnsafeRuntimeCaches();

    expect(deleteCache).toHaveBeenCalledWith("pages");
  });
});
