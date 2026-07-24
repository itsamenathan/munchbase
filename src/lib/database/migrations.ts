import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { logger } from "@/lib/logger";
import { databasePath, openDatabase } from "./connection";

function migrationCount(database: Database.Database) {
  const exists = database.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'").get();
  if (!exists) return 0;
  return (database.prepare("SELECT COUNT(*) AS count FROM __drizzle_migrations").get() as { count: number }).count;
}

export function migrateDatabase() {
  const connection = openDatabase();
  const migrationsFolder = path.resolve(process.cwd(), "drizzle");
  const journal = path.join(migrationsFolder, "meta", "_journal.json");
  if (!fs.existsSync(migrationsFolder) || !fs.existsSync(journal)) {
    throw new Error(`Database migration files are missing from ${migrationsFolder}.`);
  }
  const started = performance.now();
  try {
    const before = migrationCount(connection.sqlite);
    migrate(connection.orm, { migrationsFolder });
    const applied = migrationCount(connection.sqlite) - before;
    logger.info("Database migrations completed", {
      databasePath: databasePath(),
      migrationsFolder,
      applied,
      result: applied > 0 ? "applied" : "up_to_date",
      durationMs: Math.round(performance.now() - started),
    });
    return applied;
  } catch (error) {
    logger.error("Database migrations failed", {
      databasePath: databasePath(),
      migrationsFolder,
      durationMs: Math.round(performance.now() - started),
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
