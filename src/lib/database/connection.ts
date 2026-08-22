import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database, pragma, type SqliteDatabase } from "./sqlite";
import fs from "node:fs";
import path from "node:path";
import * as schema from "@/db/schema";

type ConnectionState = {
  path: string;
  sqlite: SqliteDatabase;
  orm: ReturnType<typeof drizzle<typeof schema>>;
};

const globalState = globalThis as typeof globalThis & { __munchbaseConnection?: ConnectionState };

export function databasePath() {
  const configuredPath = process.env.DATABASE_PATH ?? "./data/munchbase.db";
  return path.isAbsolute(configuredPath)
    ? configuredPath
    : path.join(/* turbopackIgnore: true */ process.cwd(), configuredPath);
}

export function openDatabase() {
  if (globalState.__munchbaseConnection) return globalState.__munchbaseConnection;
  const resolvedPath = databasePath();
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  const sqlite = new Database(resolvedPath, { create: true });
  pragma(sqlite, "journal_mode = WAL");
  pragma(sqlite, "foreign_keys = ON");
  pragma(sqlite, "busy_timeout = 5000");
  globalState.__munchbaseConnection = {
    path: resolvedPath,
    sqlite,
    orm: drizzle(sqlite, { schema }),
  };
  return globalState.__munchbaseConnection;
}

/** Test-only: callers must ensure no application work is using the connection. */
export function resetDatabaseConnectionForTests() {
  globalState.__munchbaseConnection?.sqlite.close();
  delete globalState.__munchbaseConnection;
}
