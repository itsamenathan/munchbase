import { openDB, type IDBPDatabase } from "idb";
const DB_NAME = "munchbase-offline";
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (db.objectStoreNames.contains("restaurants")) db.deleteObjectStore("restaurants");
        if (db.objectStoreNames.contains("lists")) db.deleteObjectStore("lists");
        if (db.objectStoreNames.contains("app-state")) db.deleteObjectStore("app-state");
        if (!db.objectStoreNames.contains("sync-queue")) {
          const store = db.createObjectStore("sync-queue", { keyPath: "id", autoIncrement: true });
          store.createIndex("timestamp", "timestamp");
        }
      },
    });
  }
  return dbPromise;
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
