import { deleteDB, openDB, type IDBPDatabase } from "idb";
import type { List, Restaurant } from "@/lib/types";

const DB_NAME = "munchbase-offline";
// IndexedDB versions only ever go up, and an unreleased build once opened this
// database at version 2 (dropping every store except sync-queue). Browsers that
// ran it are stuck at 2, so opening at 1 throws "The requested version (1) is
// less than the existing version (2)". Stay ahead of every version ever opened.
// Version 4 replaces unscoped records with user-scoped records. Existing data
// cannot be assigned to an account safely, so the upgrade discards it.
const DB_VERSION = 4;

const USER_STORES = ["restaurants", "lists", "app-state", "sync-queue"] as const;

type UserRecord<T> = {
  cacheKey: string;
  userId: number;
  value: T;
};

let dbPromise: Promise<IDBPDatabase> | null = null;

function createUserStore(db: IDBPDatabase, name: "restaurants" | "lists" | "app-state") {
  const store = db.createObjectStore(name, { keyPath: "cacheKey" });
  store.createIndex("userId", "userId");
}

function upgradeDb(db: IDBPDatabase, oldVersion: number) {
  if (oldVersion < DB_VERSION) {
    for (const name of USER_STORES) {
      if (db.objectStoreNames.contains(name)) db.deleteObjectStore(name);
    }
  }

  createUserStore(db, "restaurants");
  createUserStore(db, "lists");
  createUserStore(db, "app-state");
  const queue = db.createObjectStore("sync-queue", { keyPath: "id", autoIncrement: true });
  queue.createIndex("userId", "userId");
  queue.createIndex("timestamp", "timestamp");
}

async function openOfflineDb() {
  try {
    return await openDB(DB_NAME, DB_VERSION, { upgrade: (db, oldVersion) => upgradeDb(db, oldVersion) });
  } catch (error) {
    if (!(error instanceof DOMException) || error.name !== "VersionError") throw error;
    // The stored database is newer than this build knows about, so it can't be
    // opened or read at all. Recreating it loses the cache, which beats leaving
    // offline support permanently broken with no way out but devtools.
    await deleteDB(DB_NAME);
    return openDB(DB_NAME, DB_VERSION, { upgrade: (db, oldVersion) => upgradeDb(db, oldVersion) });
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

async function replaceUserRecords<T extends { id: number }>(
  storeName: "restaurants" | "lists",
  userId: number,
  values: T[],
) {
  const db = await getDb();
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);
  const oldKeys = await store.index("userId").getAllKeys(userId);
  await Promise.all([
    ...oldKeys.map((key) => store.delete(key)),
    ...values.map((value) =>
      store.put({ cacheKey: `${userId}:${value.id}`, userId, value } satisfies UserRecord<T>),
    ),
    tx.done,
  ]);
}

export async function cacheRestaurants(userId: number, restaurants: Restaurant[]) {
  await replaceUserRecords("restaurants", userId, restaurants);
}

export async function getCachedRestaurants(userId: number): Promise<Restaurant[]> {
  const db = await getDb();
  const records = (await db.getAllFromIndex("restaurants", "userId", userId)) as UserRecord<Restaurant>[];
  return records.map((record) => record.value);
}

export async function cacheLists(userId: number, lists: List[]) {
  await replaceUserRecords("lists", userId, lists);
}

export async function getCachedLists(userId: number): Promise<List[]> {
  const db = await getDb();
  const records = (await db.getAllFromIndex("lists", "userId", userId)) as UserRecord<List>[];
  return records.map((record) => record.value);
}

export async function cacheAppState(userId: number, key: string, data: unknown) {
  const db = await getDb();
  await db.put("app-state", {
    cacheKey: `${userId}:${key}`,
    userId,
    value: data,
  } satisfies UserRecord<unknown>);
}

export async function getCachedAppState<T>(userId: number, key: string): Promise<T | undefined> {
  const db = await getDb();
  const record = (await db.get("app-state", `${userId}:${key}`)) as UserRecord<T> | undefined;
  return record?.value;
}

interface QueuedAction {
  id: number;
  userId: number;
  action: string;
  payload: unknown;
  timestamp: number;
  retries: number;
}

export async function enqueueAction(userId: number, action: string, payload: unknown) {
  const db = await getDb();
  await db.add("sync-queue", {
    userId,
    action,
    payload,
    timestamp: Date.now(),
    retries: 0,
  });
}

export async function getQueuedActions(userId: number): Promise<(QueuedAction & { id: number })[]> {
  const db = await getDb();
  const all = (await db.getAllFromIndex("sync-queue", "userId", userId)) as QueuedAction[];
  return all.sort((a, b) => a.timestamp - b.timestamp);
}

export async function removeQueuedAction(id: number) {
  const db = await getDb();
  await db.delete("sync-queue", id);
}

export async function clearCachedDataForUser(userId: number) {
  const db = await getDb();
  const tx = db.transaction(USER_STORES, "readwrite");
  await Promise.all(
    USER_STORES.map(async (storeName) => {
      const store = tx.objectStore(storeName);
      const keys = await store.index("userId").getAllKeys(userId);
      await Promise.all(keys.map((key) => store.delete(key)));
    }),
  );
  await tx.done;
}

export async function clearAllOfflineData() {
  const db = await getDb();
  const tx = db.transaction(USER_STORES, "readwrite");
  await Promise.all(USER_STORES.map((storeName) => tx.objectStore(storeName).clear()));
  await tx.done;
}

export async function clearUnsafeRuntimeCaches() {
  if (!("caches" in globalThis)) return;
  await caches.delete("pages");
}
