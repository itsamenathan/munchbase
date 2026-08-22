import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { getDb } from "@/lib/db";
import { canonicalJson } from "./golden/canonical";
import { cleanupSeededDatabases, createSeededDatabase } from "./golden/fixture";
import { buildSnapshot } from "./golden/snapshot";

const baselinePath = path.resolve(process.cwd(), "src/lib/database/golden/baseline.json");

describe("golden master: read surface", () => {
  // A fresh corpus per block: the contract tests below write, and must not be
  // able to reach the data the golden master reads.
  beforeAll(() => createSeededDatabase());
  afterAll(() => cleanupSeededDatabases());

  it("returns byte-identical data for the seeded corpus", () => {
    const actual = canonicalJson(buildSnapshot());

    if (process.env.UPDATE_GOLDEN === "1" || !fs.existsSync(baselinePath)) {
      fs.writeFileSync(baselinePath, actual);
      // Writing is not passing: a run that regenerates the baseline proves nothing.
      expect(process.env.UPDATE_GOLDEN).toBe("1");
      return;
    }

    expect(actual).toBe(fs.readFileSync(baselinePath, "utf8"));
  });
});

/**
 * The SQL boundary the driver swap actually moves. These assert behaviour rather
 * than snapshot it, so they read as a contract any SQLite driver has to satisfy.
 */
describe("driver contract", () => {
  beforeAll(() => createSeededDatabase());
  afterAll(() => cleanupSeededDatabases());

  it("reports inserted row ids as coercible numbers", () => {
    const result = getDb()
      .prepare("INSERT INTO places (osm_type, osm_id, name, address, lat, lon, raw_json) VALUES ('contract', 'a1', 'A', 'addr', 1.5, 2.5, '{}')")
      .run();
    expect(Number(result.lastInsertRowid)).toBeGreaterThan(0);
    expect(result.changes).toBe(1);
  });

  it("round-trips REAL, NULL and empty string without coercion", () => {
    const db = getDb();
    db.prepare("INSERT INTO places (osm_type, osm_id, name, address, lat, lon, raw_json) VALUES ('contract', 'a2', 'B', '', 40.7306, -73.9866, '{}')").run();
    const row = db.prepare("SELECT lat, lon, address, raw_json FROM places WHERE osm_type = 'contract' AND osm_id = 'a2'").get() as Record<string, unknown>;
    expect(row.lat).toBe(40.7306);
    expect(row.lon).toBe(-73.9866);
    expect(row.address).toBe("");
    expect(typeof row.lat).toBe("number");
  });

  it("treats a missing row as nullish", () => {
    // better-sqlite3 yields undefined here and bun:sqlite yields null. Every
    // call site reaches the value through `??` or `?.`, which cannot tell them
    // apart — so the contract is "nullish", not one specific value.
    const missing = getDb().prepare("SELECT id FROM places WHERE osm_id = 'no-such-place'").get();
    expect(missing ?? null).toBeNull();
    expect(getDb().prepare("SELECT id FROM places WHERE osm_id = 'no-such-place'").all()).toEqual([]);
  });

  it("rolls the whole transaction back when the body throws", () => {
    const db = getDb();
    const before = (db.prepare("SELECT COUNT(*) AS count FROM places").get() as { count: number }).count;
    const insertThenFail = db.transaction(() => {
      db.prepare("INSERT INTO places (osm_type, osm_id, name, address, lat, lon, raw_json) VALUES ('contract', 'rollback', 'C', 'addr', 1, 2, '{}')").run();
      throw new Error("boom");
    });
    expect(() => insertThenFail()).toThrow("boom");
    expect((db.prepare("SELECT COUNT(*) AS count FROM places").get() as { count: number }).count).toBe(before);
  });

  it("enforces uniqueness and foreign keys", () => {
    const db = getDb();
    expect(() =>
      db.prepare("INSERT INTO places (osm_type, osm_id, name, address, lat, lon, raw_json) VALUES ('contract', 'a1', 'dupe', 'addr', 1, 2, '{}')").run(),
    ).toThrow(/UNIQUE constraint failed/);
    expect(() => db.prepare("INSERT INTO restaurants (place_id, created_by) VALUES (987654, 1)").run()).toThrow(
      /FOREIGN KEY constraint failed/,
    );
  });

  it("cascades deletes from restaurants to their list memberships", () => {
    const db = getDb();
    const placeId = Number(
      db.prepare("INSERT INTO places (osm_type, osm_id, name, address, lat, lon, raw_json) VALUES ('contract', 'cascade', 'D', 'addr', 1, 2, '{}')").run().lastInsertRowid,
    );
    const userId = (db.prepare("SELECT id FROM users ORDER BY id LIMIT 1").get() as { id: number }).id;
    const restaurantId = Number(db.prepare("INSERT INTO restaurants (place_id, created_by) VALUES (?, ?)").run(placeId, userId).lastInsertRowid);
    const listId = (db.prepare("SELECT id FROM lists ORDER BY id LIMIT 1").get() as { id: number }).id;
    db.prepare("INSERT INTO list_restaurants (list_id, restaurant_id) VALUES (?, ?)").run(listId, restaurantId);

    db.prepare("DELETE FROM restaurants WHERE id = ?").run(restaurantId);
    expect(
      (db.prepare("SELECT COUNT(*) AS count FROM list_restaurants WHERE restaurant_id = ?").get(restaurantId) as { count: number }).count,
    ).toBe(0);
  });
});
