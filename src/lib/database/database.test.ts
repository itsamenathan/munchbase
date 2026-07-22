import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runLegacyCompatibility } from "./compatibility";
import { resetDatabaseConnectionForTests } from "./connection";
import { resetDatabaseMaintenanceSchedulerForTests, runDatabaseMaintenance, startDatabaseMaintenanceScheduler } from "./maintenance";
import { resetDatabaseStartupForTests } from "./startup";

const migrationsFolder = path.resolve(process.cwd(), "drizzle");
const temporaryDirectories: string[] = [];

function temporaryDatabase() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "munchbase-db-"));
  temporaryDirectories.push(directory);
  const sqlite = new Database(path.join(directory, "munchbase.db"));
  sqlite.pragma("foreign_keys = ON");
  return sqlite;
}

afterEach(() => {
  resetDatabaseMaintenanceSchedulerForTests();
  resetDatabaseStartupForTests();
  resetDatabaseConnectionForTests();
  delete process.env.DATABASE_PATH;
  for (const directory of temporaryDirectories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe("database migrations", () => {
  it("initializes a fresh database and is repeatable", () => {
    const sqlite = temporaryDatabase();
    runLegacyCompatibility(sqlite);
    migrate(drizzle(sqlite), { migrationsFolder });
    runLegacyCompatibility(sqlite);
    const names = (sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>).map((row) => row.name);
    expect(names).toContain("restaurants");
    expect(names).toContain("munchbase_system_migrations");
    expect(names).toContain("__drizzle_migrations");
    expect((sqlite.pragma("table_info(rating_definitions)") as Array<{ name: string }>).some((column) => column.name === "sort_order")).toBe(true);
    const before = (sqlite.prepare("SELECT COUNT(*) AS count FROM __drizzle_migrations").get() as { count: number }).count;
    migrate(drizzle(sqlite), { migrationsFolder });
    runLegacyCompatibility(sqlite);
    expect((sqlite.prepare("SELECT COUNT(*) AS count FROM __drizzle_migrations").get() as { count: number }).count).toBe(before);
    sqlite.close();
  });

  it("upgrades the pre-scope schema without losing definitions", () => {
    const sqlite = temporaryDatabase();
    sqlite.exec(`
      CREATE TABLE lists (id integer PRIMARY KEY);
      CREATE TABLE rating_definitions (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL, list_id integer NOT NULL,
        preset_key text, name text NOT NULL, type text NOT NULL, icon text DEFAULT 'tag' NOT NULL,
        options_json text DEFAULT '[]' NOT NULL, min integer, max integer,
        active integer DEFAULT true NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE cascade
      );
      CREATE TABLE rating_values (
        restaurant_id integer NOT NULL, definition_id integer NOT NULL, value text NOT NULL,
        PRIMARY KEY (restaurant_id, definition_id),
        FOREIGN KEY (definition_id) REFERENCES rating_definitions(id) ON DELETE cascade
      );
      INSERT INTO lists VALUES (1);
      INSERT INTO rating_definitions (id, list_id, name, type) VALUES (7, 1, 'Favorite', 'boolean');
      INSERT INTO rating_values VALUES (99, 7, 'true');
    `);
    runLegacyCompatibility(sqlite);
    const row = sqlite.prepare("SELECT id, list_id AS listId, scope, sort_order AS sortOrder FROM rating_definitions").get() as Record<string, unknown>;
    expect(row).toEqual({ id: 7, listId: 1, scope: "list", sortOrder: 7 });
    expect((sqlite.prepare("SELECT definition_id AS definitionId, value FROM rating_values").get() as Record<string, unknown>)).toEqual({ definitionId: 7, value: "true" });
    expect((sqlite.pragma("table_info(rating_definitions)") as Array<{ name: string; notnull: number }>).find((column) => column.name === "list_id")?.notnull).toBe(0);
    expect(sqlite.pragma("foreign_key_check")).toEqual([]);
    sqlite.close();
  });

  it("adds missing ordering and preserves ordering already repaired at runtime", () => {
    for (const existingOrder of [undefined, 42]) {
      const sqlite = temporaryDatabase();
      sqlite.exec(`CREATE TABLE lists (id integer PRIMARY KEY);
        CREATE TABLE rating_definitions (
          id integer PRIMARY KEY, list_id integer, scope text DEFAULT 'list' NOT NULL,
          preset_key text, name text NOT NULL, type text NOT NULL, icon text DEFAULT 'tag' NOT NULL,
          options_json text DEFAULT '[]' NOT NULL, min integer, max integer, active integer DEFAULT true NOT NULL,
          ${existingOrder === undefined ? "" : "sort_order integer DEFAULT 0 NOT NULL,"}
          created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
        INSERT INTO rating_definitions (id, name, type${existingOrder === undefined ? "" : ", sort_order"}) VALUES (5, 'Test', 'boolean'${existingOrder === undefined ? "" : `, ${existingOrder}`});`);
      runLegacyCompatibility(sqlite);
      expect((sqlite.prepare("SELECT sort_order AS value FROM rating_definitions").get() as { value: number }).value).toBe(existingOrder ?? 5);
      sqlite.close();
    }
  });

  it("removes only expired sessions and registers one scheduler", () => {
    const sqlite = temporaryDatabase();
    sqlite.exec("CREATE TABLE sessions (id text PRIMARY KEY, expires_at text NOT NULL)");
    sqlite.prepare("INSERT INTO sessions VALUES (?, ?), (?, ?)").run("old", "2000-01-01", "active", "2999-01-01");
    expect(runDatabaseMaintenance(sqlite).expiredSessions).toBe(1);
    expect((sqlite.prepare("SELECT id FROM sessions").all() as Array<{ id: string }>).map((row) => row.id)).toEqual(["active"]);
    startDatabaseMaintenanceScheduler();
    startDatabaseMaintenanceScheduler();
    sqlite.close();
  });
});
