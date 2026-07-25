import { deleteDB, openDB, type IDBPDatabase } from "idb";
import type { List, Restaurant } from "@/lib/types";

const DB_NAME = "munchbase-offline";
// IndexedDB versions only ever go up, and an unreleased build once opened this
// database at version 2 (dropping every store except sync-queue). Browsers that
// ran it are stuck at 2, so opening at 1 throws "The requested version (1) is
// less than the existing version (2)". Stay ahead of every version ever opened.
const DB_VERSION = 3;

let dbPromise: Promise<IDBPDatabase> | null = null;

// Creates whatever is missing, so it works as a fresh install and as an upgrade
// from any earlier version, including the one that deleted stores.
function upgradeDb(db: IDBPDatabase) {
  if (!db.objectStoreNames.contains("restaurants")) {
    db.createObjectStore("restaurants", { keyPath: "id" });
  }
  if (!db.objectStoreNames.contains("lists")) {
    db.createObjectStore("lists", { keyPath: "id" });
  }
  if (!db.objectStoreNames.contains("sync-queue")) {
    const store = db.createObjectStore("sync-queue", { keyPath: "id", autoIncrement: true });
    store.createIndex("timestamp", "timestamp");
  }
  if (!db.objectStoreNames.contains("app-state")) {
    db.createObjectStore("app-state");
  }
}

async function openOfflineDb() {
  try {
    return await openDB(DB_NAME, DB_VERSION, { upgrade: upgradeDb });
  } catch (error) {
    if (!(error instanceof DOMException) || error.name !== "VersionError") throw error;
    // The stored database is newer than this build knows about, so it can't be
    // opened or read at all. Recreating it loses the cache, which beats leaving
    // offline support permanently broken with no way out but devtools.
    await deleteDB(DB_NAME);
    return openDB(DB_NAME, DB_VERSION, { upgrade: upgradeDb });
  }
}

function getDb() {
  if (!dbPromise) {
    dbPromise = openOfflineDb().catch((error) => {
      // Don't leave a rejected promise cached: every later call would reuse it,
      // so the offline cache and sync queue would stay dead for the rest of the
      // session even once the cause is gone.
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

// The write-through cache is best effort — losing it degrades the next offline
// session but must not break the current one or surface as an unhandled
// rejection.
export function reportCacheFailure(error: unknown) {
  console.warn("Munchbase offline cache unavailable", error);
}

export async function cacheRestaurants(restaurants: Restaurant[]) {
  const db = await getDb();
  const tx = db.transaction("restaurants", "readwrite");
  await Promise.all([
    ...restaurants.map((r) => tx.store.put(r)),
    tx.done,
  ]);
}

export async function getCachedRestaurants(): Promise<Restaurant[]> {
  const db = await getDb();
  return db.getAll("restaurants");
}

export async function cacheLists(lists: List[]) {
  const db = await getDb();
  const tx = db.transaction("lists", "readwrite");
  await Promise.all([...lists.map((l) => tx.store.put(l)), tx.done]);
}

export async function getCachedLists(): Promise<List[]> {
  const db = await getDb();
  return db.getAll("lists");
}

export async function cacheAppState(key: string, data: unknown) {
  const db = await getDb();
  await db.put("app-state", data, key);
}

export async function getCachedAppState<T>(key: string): Promise<T | undefined> {
  const db = await getDb();
  return db.get("app-state", key) as Promise<T | undefined>;
}

interface QueuedAction {
  id?: number;
  action: string;
  payload: unknown;
  timestamp: number;
  retries: number;
}

export async function enqueueAction(action: string, payload: unknown) {
  const db = await getDb();
  await db.add("sync-queue", {
    action,
    payload,
    timestamp: Date.now(),
    retries: 0,
  });
}

export async function getQueuedActions(): Promise<(QueuedAction & { id: number })[]> {
  const db = await getDb();
  const all = await db.getAll("sync-queue");
  return all.sort((a, b) => a.timestamp - b.timestamp);
}

export async function removeQueuedAction(id: number) {
  const db = await getDb();
  await db.delete("sync-queue", id);
}

export async function clearAllCachedData() {
  const db = await getDb();
  await Promise.all([
    db.clear("restaurants"),
    db.clear("lists"),
    db.clear("app-state"),
  ]);
}
