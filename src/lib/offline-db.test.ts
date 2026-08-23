import "fake-indexeddb/auto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { List, Restaurant } from "./types";
import {
  cacheAppState,
  cacheLists,
  cacheRestaurants,
  clearAllOfflineData,
  clearCachedDataForUser,
  clearUnsafeRuntimeCaches,
  enqueueAction,
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
});

describe("unsafe runtime cache cleanup", () => {
  it("deletes the old authenticated page cache", async () => {
    const deleteCache = vi.fn().mockResolvedValue(true);
    vi.stubGlobal("caches", { delete: deleteCache });

    await clearUnsafeRuntimeCaches();

    expect(deleteCache).toHaveBeenCalledWith("pages");
  });
});
