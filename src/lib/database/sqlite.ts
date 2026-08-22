import { Database } from "bun:sqlite";

export { Database };
export type SqliteDatabase = Database;

/**
 * bun:sqlite has no `.pragma()`. Preparing the statement returns the same row
 * shape better-sqlite3 produced, so call sites stay unchanged apart from the name.
 */
export function pragma(database: Database, statement: string): unknown[] {
  return database.prepare(`PRAGMA ${statement}`).all();
}
