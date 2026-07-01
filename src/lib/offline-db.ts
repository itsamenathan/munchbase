import { openDB, type IDBPDatabase } from "idb";

type CachedRestaurant = {
  id: number;
  name: string;
  address: string | null;
  lat: number | null;
  lon: number | null;
  notes: string | null;
  googleMapsUrl: string | null;
  yelpUrl: string | null;
  checkInCount: number;
  latestCheckIn: string | null;
  ratings: { definitionId: number; value: string }[];
  memberships: { id: number; name: string }[];
  ratingGroups: { list: { id: number; name: string }; definitions: { id: number; name: string; active: boolean }[] }[];
};

const DB_NAME = "munchbase-offline";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
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
      },
    });
  }
  return dbPromise;
}

export async function cacheRestaurants(restaurants: CachedRestaurant[]) {
  const db = await getDb();
  const tx = db.transaction("restaurants", "readwrite");
  await Promise.all([
    ...restaurants.map((r) => tx.store.put(r)),
    tx.done,
  ]);
}

export async function getCachedRestaurants(): Promise<CachedRestaurant[]> {
  const db = await getDb();
  return db.getAll("restaurants");
}

export async function cacheLists(lists: { id: number; name: string; description: string | null }[]) {
  const db = await getDb();
  const tx = db.transaction("lists", "readwrite");
  await Promise.all([...lists.map((l) => tx.store.put(l)), tx.done]);
}

export async function getCachedLists() {
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
