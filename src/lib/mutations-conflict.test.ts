import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetDatabaseConnectionForTests } from "./database/connection";
import { resetDatabaseStartupForTests } from "./database/startup";

vi.hoisted(() => {
  process.env.MUNCHBASE_LOG_LEVEL = "error";
});
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/lib/auth", () => ({
  currentUser: async () => ({ id: 1, name: "Alex", role: "admin" }),
  createSession: async () => undefined,
  hashPassword: async () => "hash",
}));

let directory: string;

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "munchbase-conflict-"));
  process.env.DATABASE_PATH = path.join(directory, "munchbase.db");
});

afterEach(() => {
  resetDatabaseStartupForTests();
  resetDatabaseConnectionForTests();
  delete process.env.DATABASE_PATH;
  fs.rmSync(directory, { recursive: true, force: true });
});

function form(entries: Array<[string, string]>) {
  const formData = new FormData();
  for (const [key, value] of entries) formData.append(key, value);
  return formData;
}

async function setup() {
  const { getDb } = await import("@/lib/db");
  const mutations = await import("@/lib/mutations");
  const db = getDb();
  db.prepare("INSERT INTO users (id, name, email, password_hash, role, active) VALUES (1, 'Alex', 'a@x.test', 'h', 'admin', 1)").run();
  const place = db.prepare("INSERT INTO places (name) VALUES ('Harbor & Pine')").run();
  const restaurant = db
    .prepare("INSERT INTO restaurants (place_id, notes) VALUES (?, ?)")
    .run(place.lastInsertRowid, "<!--section:1-->\nOriginal one\n\n<!--section:2-->\nOriginal two");
  const stars = db.prepare("SELECT id FROM rating_definitions WHERE preset_key = 'stars'").get() as { id: number };
  db.prepare("INSERT INTO rating_values (restaurant_id, definition_id, value) VALUES (?, ?, '3')").run(restaurant.lastInsertRowid, stars.id);
  return { db, mutations, restaurantId: Number(restaurant.lastInsertRowid), starsId: stars.id };
}

describe("updateEntryAndRatings conflict detection", () => {
  it("saves a field nobody else touched", async () => {
    const { db, mutations, restaurantId } = await setup();
    await mutations.updateEntryAndRatings(form([
      ["restaurantId", String(restaurantId)],
      ["note:1", "Mine"], ["base:note:1", "Original one"],
    ]));
    const row = db.prepare("SELECT notes FROM restaurants WHERE id = ?").get(restaurantId) as { notes: string };
    expect(row.notes).toContain("Mine");
    expect(row.notes).toContain("Original two");
  });

  it("keeps someone else's edit to a field the saver did not touch", async () => {
    const { db, mutations, restaurantId } = await setup();
    // Someone else changes section 2 after this editor loaded the page...
    db.prepare("UPDATE restaurants SET notes = ? WHERE id = ?").run("<!--section:1-->\nOriginal one\n\n<!--section:2-->\nTheirs", restaurantId);
    // ...and this editor saves only section 1, because the form drops unchanged fields.
    await mutations.updateEntryAndRatings(form([
      ["restaurantId", String(restaurantId)],
      ["note:1", "Mine"], ["base:note:1", "Original one"],
    ]));
    const row = db.prepare("SELECT notes FROM restaurants WHERE id = ?").get(restaurantId) as { notes: string };
    expect(row.notes).toContain("Mine");
    expect(row.notes).toContain("Theirs");
  });

  it("rejects a note someone else changed and writes nothing", async () => {
    const { db, mutations, restaurantId, starsId } = await setup();
    db.prepare("UPDATE restaurants SET notes = ? WHERE id = ?").run("<!--section:1-->\nTheirs\n\n<!--section:2-->\nOriginal two", restaurantId);
    const attempt = mutations.updateEntryAndRatings(form([
      ["restaurantId", String(restaurantId)],
      ["note:1", "Mine"], ["base:note:1", "Original one"],
      ["rating:" + starsId, "5"], ["base:rating:" + starsId, "3"],
    ]));
    await expect(attempt).rejects.toMatchObject({ code: "conflict", conflicts: [{ key: "note:1", current: "Theirs" }] });
    const notes = db.prepare("SELECT notes FROM restaurants WHERE id = ?").get(restaurantId) as { notes: string };
    expect(notes.notes).toContain("Theirs");
    const rating = db.prepare("SELECT value FROM rating_values WHERE restaurant_id = ? AND definition_id = ?").get(restaurantId, starsId) as { value: string };
    expect(rating.value).toBe("3");
  });

  it("rejects a rating someone else changed", async () => {
    const { db, mutations, restaurantId, starsId } = await setup();
    db.prepare("UPDATE rating_values SET value = '1' WHERE restaurant_id = ? AND definition_id = ?").run(restaurantId, starsId);
    await expect(mutations.updateEntryAndRatings(form([
      ["restaurantId", String(restaurantId)],
      ["rating:" + starsId, "5"], ["base:rating:" + starsId, "3"],
    ]))).rejects.toMatchObject({ code: "conflict", conflicts: [{ key: "rating:" + starsId, current: "1" }] });
  });

  it("is not a conflict when someone else already made the same change", async () => {
    const { db, mutations, restaurantId, starsId } = await setup();
    db.prepare("UPDATE rating_values SET value = '5' WHERE restaurant_id = ? AND definition_id = ?").run(restaurantId, starsId);
    await mutations.updateEntryAndRatings(form([
      ["restaurantId", String(restaurantId)],
      ["rating:" + starsId, "5"], ["base:rating:" + starsId, "3"],
    ]));
  });

  it("overwrites once the base matches the current value (keep my changes)", async () => {
    const { db, mutations, restaurantId } = await setup();
    db.prepare("UPDATE restaurants SET notes = ? WHERE id = ?").run("<!--section:1-->\nTheirs", restaurantId);
    await mutations.updateEntryAndRatings(form([
      ["restaurantId", String(restaurantId)],
      ["note:1", "Mine"], ["base:note:1", "Theirs"],
    ]));
    const row = db.prepare("SELECT notes FROM restaurants WHERE id = ?").get(restaurantId) as { notes: string };
    expect(row.notes).toContain("Mine");
  });

  it("still applies saves that carry no base values (older queued edits)", async () => {
    const { db, mutations, restaurantId } = await setup();
    await mutations.updateEntryAndRatings(form([["restaurantId", String(restaurantId)], ["note:1", "Legacy"]]));
    const row = db.prepare("SELECT notes FROM restaurants WHERE id = ?").get(restaurantId) as { notes: string };
    expect(row.notes).toContain("Legacy");
  });
});
