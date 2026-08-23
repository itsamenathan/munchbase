import { deleteDB, openDB, type IDBPDatabase, type IDBPTransaction } from "idb";
import type { AppState, List, Restaurant } from "@/lib/types";

const DB_NAME = "munchbase-offline";
// Version 4 introduced user-scoped records. Version 5 adds active-user metadata
// without discarding the safe version 4 cache.
const DB_VERSION = 5;

const DATA_STORES = ["restaurants", "lists", "app-state"] as const;
const USER_STORES = [...DATA_STORES, "sync-queue"] as const;
const METADATA_STORE = "metadata";
const ACTIVE_USER_KEY = "active-user";

type UserRecord<T> = {
  cacheKey: string;
  userId: number;
  value: T;
};

export type OfflineMetadata = {
  key: typeof ACTIVE_USER_KEY;
  userId: number;
  cachedAt: number;
  lastSyncedAt: number | null;
};

export type SerializedFormData = Array<[string, string]>;

export type QueuedAction = {
  id: number;
  userId: number;
  mutationId: string;
  action: string;
  payload: SerializedFormData | Record<string, string>;
  timestamp: number;
  retries: number;
  lastError?: string | null;
};

let dbPromise: Promise<IDBPDatabase> | null = null;

function createUserStore(db: IDBPDatabase, name: "restaurants" | "lists" | "app-state") {
  if (db.objectStoreNames.contains(name)) return;
  const store = db.createObjectStore(name, { keyPath: "cacheKey" });
  store.createIndex("userId", "userId");
}

function createQueueStore(db: IDBPDatabase) {
  if (db.objectStoreNames.contains("sync-queue")) return;
  const queue = db.createObjectStore("sync-queue", { keyPath: "id", autoIncrement: true });
  queue.createIndex("userId", "userId");
  queue.createIndex("timestamp", "timestamp");
}

function upgradeDb(db: IDBPDatabase, oldVersion: number) {
  // Records written before version 4 did not identify their user. They cannot
  // be assigned safely, so upgrades from those versions start with an empty cache.
  if (oldVersion < 4) {
    for (const name of USER_STORES) {
      if (db.objectStoreNames.contains(name)) db.deleteObjectStore(name);
    }
  }

  for (const name of DATA_STORES) createUserStore(db, name);
  createQueueStore(db);
  if (!db.objectStoreNames.contains(METADATA_STORE)) {
    db.createObjectStore(METADATA_STORE, { keyPath: "key" });
  }
}

async function openOfflineDb() {
  try {
    return await openDB(DB_NAME, DB_VERSION, { upgrade: (db, oldVersion) => upgradeDb(db, oldVersion) });
  } catch (error) {
    if (!(error instanceof DOMException) || error.name !== "VersionError") throw error;
    // A newer local build may have opened this database. Recreate it instead of
    // leaving offline support broken until someone clears browser storage.
    await deleteDB(DB_NAME);
    return openDB(DB_NAME, DB_VERSION, { upgrade: (db, oldVersion) => upgradeDb(db, oldVersion) });
  }
}

function getDb() {
  if (!dbPromise) {
    dbPromise = openOfflineDb().catch((error) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

export function reportCacheFailure(error: unknown) {
  console.warn("Munchbase offline cache unavailable", error);
}

function cacheKey(userId: number, key: string | number) {
  return `${userId}:${key}`;
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
      store.put({ cacheKey: cacheKey(userId, value.id), userId, value } satisfies UserRecord<T>),
    ),
  ]);
  await tx.done;
}

type SnapshotTransaction = IDBPTransaction<unknown, string[], "readwrite">;

async function replaceSnapshotRecords(tx: SnapshotTransaction, state: AppState) {
  const userId = state.user.id;
  const restaurantStore = tx.objectStore("restaurants");
  const listStore = tx.objectStore("lists");
  const [restaurantKeys, listKeys] = await Promise.all([
    restaurantStore.index("userId").getAllKeys(userId),
    listStore.index("userId").getAllKeys(userId),
  ]);

  await Promise.all([
    ...restaurantKeys.map((key) => restaurantStore.delete(key)),
    ...listKeys.map((key) => listStore.delete(key)),
    ...state.allRestaurants.map((value) =>
      restaurantStore.put({ cacheKey: cacheKey(userId, value.id), userId, value } satisfies UserRecord<Restaurant>),
    ),
    ...state.lists.map((value) =>
      listStore.put({ cacheKey: cacheKey(userId, value.id), userId, value } satisfies UserRecord<List>),
    ),
    tx.objectStore("app-state").put({
      cacheKey: cacheKey(userId, "latest"),
      userId,
      value: state,
    } satisfies UserRecord<AppState>),
  ]);
}

async function clearUserStores(tx: SnapshotTransaction) {
  await Promise.all(USER_STORES.map((name) => tx.objectStore(name).clear()));
}

export async function cacheAppStateSnapshot(state: AppState) {
  const db = await getDb();
  const tx = db.transaction([...USER_STORES, METADATA_STORE], "readwrite");
  const metadataStore = tx.objectStore(METADATA_STORE);
  const existing = await metadataStore.get(ACTIVE_USER_KEY) as OfflineMetadata | undefined;
  if (existing && existing.userId !== state.user.id) await clearUserStores(tx);

  await replaceSnapshotRecords(tx, state);
  await metadataStore.put({
    key: ACTIVE_USER_KEY,
    userId: state.user.id,
    cachedAt: Date.now(),
    lastSyncedAt: existing?.userId === state.user.id ? existing.lastSyncedAt : Date.now(),
  } satisfies OfflineMetadata);
  await tx.done;
}

export async function getActiveCachedAppState(): Promise<{
  state: AppState;
  metadata: OfflineMetadata;
} | null> {
  const db = await getDb();
  const metadata = await db.get(METADATA_STORE, ACTIVE_USER_KEY) as OfflineMetadata | undefined;
  if (!metadata) return null;
  const record = await db.get("app-state", cacheKey(metadata.userId, "latest")) as UserRecord<AppState> | undefined;
  return record ? { state: record.value, metadata } : null;
}

export async function cacheRestaurants(userId: number, restaurants: Restaurant[]) {
  await replaceUserRecords("restaurants", userId, restaurants);
}

export async function getCachedRestaurants(userId: number): Promise<Restaurant[]> {
  const db = await getDb();
  const records = await db.getAllFromIndex("restaurants", "userId", userId) as UserRecord<Restaurant>[];
  return records.map((record) => record.value);
}

export async function cacheLists(userId: number, lists: List[]) {
  await replaceUserRecords("lists", userId, lists);
}

export async function getCachedLists(userId: number): Promise<List[]> {
  const db = await getDb();
  const records = await db.getAllFromIndex("lists", "userId", userId) as UserRecord<List>[];
  return records.map((record) => record.value);
}

export async function cacheAppState(userId: number, key: string, data: unknown) {
  const db = await getDb();
  await db.put("app-state", {
    cacheKey: cacheKey(userId, key),
    userId,
    value: data,
  } satisfies UserRecord<unknown>);
}

export async function getCachedAppState<T>(userId: number, key: string): Promise<T | undefined> {
  const db = await getDb();
  const record = await db.get("app-state", cacheKey(userId, key)) as UserRecord<T> | undefined;
  return record?.value;
}

export function createOfflineMutationId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function enqueueMutationWithState(
  userId: number,
  action: string,
  payload: SerializedFormData,
  state: AppState,
  mutationId: string,
) {
  const db = await getDb();
  const tx = db.transaction([...USER_STORES, METADATA_STORE], "readwrite");
  const metadataStore = tx.objectStore(METADATA_STORE);
  const existing = await metadataStore.get(ACTIVE_USER_KEY) as OfflineMetadata | undefined;
  if (existing && existing.userId !== userId) await clearUserStores(tx);
  await replaceSnapshotRecords(tx, state);
  await tx.objectStore("sync-queue").add({
    userId,
    mutationId,
    action,
    payload,
    timestamp: Date.now(),
    retries: 0,
    lastError: null,
  });
  await metadataStore.put({
    key: ACTIVE_USER_KEY,
    userId,
    cachedAt: Date.now(),
    lastSyncedAt: existing?.userId === userId ? existing.lastSyncedAt : null,
  } satisfies OfflineMetadata);
  await tx.done;
}

// Kept for focused storage tests and migration compatibility.
export async function enqueueAction(userId: number, action: string, payload: unknown) {
  const db = await getDb();
  await db.add("sync-queue", {
    userId,
    mutationId: createOfflineMutationId(),
    action,
    payload,
    timestamp: Date.now(),
    retries: 0,
    lastError: null,
  });
}

export async function getQueuedActions(userId: number): Promise<QueuedAction[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex("sync-queue", "userId", userId) as QueuedAction[];
  return all.sort((a, b) => a.timestamp - b.timestamp);
}

export async function updateQueuedActionFailure(id: number, message: string) {
  const db = await getDb();
  const action = await db.get("sync-queue", id) as QueuedAction | undefined;
  if (!action) return;
  await db.put("sync-queue", {
    ...action,
    retries: action.retries + 1,
    lastError: message,
  });
}

export async function removeQueuedAction(id: number) {
  const db = await getDb();
  await db.delete("sync-queue", id);
}

export async function markOfflineDataSynced(userId: number) {
  const db = await getDb();
  const metadata = await db.get(METADATA_STORE, ACTIVE_USER_KEY) as OfflineMetadata | undefined;
  if (!metadata || metadata.userId !== userId) return;
  await db.put(METADATA_STORE, { ...metadata, lastSyncedAt: Date.now() });
}

export async function getOfflineMetadata(): Promise<OfflineMetadata | undefined> {
  const db = await getDb();
  return db.get(METADATA_STORE, ACTIVE_USER_KEY) as Promise<OfflineMetadata | undefined>;
}

export async function clearCachedDataForUser(userId: number) {
  const db = await getDb();
  const tx = db.transaction([...USER_STORES, METADATA_STORE], "readwrite");
  await Promise.all(
    USER_STORES.map(async (storeName) => {
      const store = tx.objectStore(storeName);
      const keys = await store.index("userId").getAllKeys(userId);
      await Promise.all(keys.map((key) => store.delete(key)));
    }),
  );
  const metadata = await tx.objectStore(METADATA_STORE).get(ACTIVE_USER_KEY) as OfflineMetadata | undefined;
  if (metadata?.userId === userId) await tx.objectStore(METADATA_STORE).delete(ACTIVE_USER_KEY);
  await tx.done;
}

export async function clearAllOfflineData() {
  const db = await getDb();
  const tx = db.transaction([...USER_STORES, METADATA_STORE], "readwrite");
  await Promise.all([
    ...USER_STORES.map((storeName) => tx.objectStore(storeName).clear()),
    tx.objectStore(METADATA_STORE).clear(),
  ]);
  await tx.done;
}

export async function clearUnsafeRuntimeCaches() {
  if (!("caches" in globalThis)) return;
  await caches.delete("pages");
}
