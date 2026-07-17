import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const databasePath = path.resolve(process.env.DATABASE_PATH ?? "./data/munchbase.db");

if (!fs.existsSync(databasePath)) {
  console.error(`Database not found at ${databasePath}. Run \"npm run db:migrate\" first.`);
  process.exit(1);
}

const db = new Database(databasePath);
db.pragma("foreign_keys = ON");

const requiredTable = db
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'restaurants'")
  .get();
if (!requiredTable) {
  console.error(`Database at ${databasePath} has not been migrated. Run \"npm run db:migrate\" first.`);
  db.close();
  process.exit(1);
}

const testRestaurants = [
  {
    key: "harbor-and-pine",
    name: "Harbor & Pine",
    address: "401 S Main St, Los Angeles, CA 90013",
    lat: 34.0476,
    lon: -118.2477,
    lists: ["Places to Eat", "Weekend Favorites"],
    ratings: { go_back: "true", price: "$$$", stars: "5" },
    notes: {
      notes: "Warm neighborhood spot with a lively patio. Reservations help on Friday nights.",
      what_to_order: "Charred carrots, house pasta, and the seasonal tart.",
      people: "Date night or a small group.",
    },
    checkins: [
      ["2026-07-05T19:30:00.000Z", "Patio table; great service."],
      ["2026-05-18T20:00:00.000Z", "Tried the spring menu."],
    ],
  },
  {
    key: "juniper-table",
    name: "Juniper Table",
    address: "812 E 3rd St, Los Angeles, CA 90013",
    lat: 34.0454,
    lon: -118.2349,
    lists: ["Places to Eat", "Weekend Favorites"],
    ratings: { go_back: "true", price: "$$", stars: "4" },
    notes: {
      notes: "Bright all-day cafe with plenty of outdoor seating.",
      what_to_order: "Mushroom toast and cardamom cold brew.",
      what_to_avoid: "The pastry case is mostly sold out after noon.",
    },
    checkins: [["2026-06-22T17:45:00.000Z", "Easy Sunday brunch." ]],
  },
  {
    key: "little-ember",
    name: "Little Ember",
    address: "727 N Broadway, Los Angeles, CA 90012",
    lat: 34.0614,
    lon: -118.2388,
    lists: ["Places to Eat", "Weekend Favorites"],
    ratings: { go_back: "true", price: "$$", stars: "5" },
    notes: {
      notes: "Compact wood-fired kitchen; counter seats have the best view.",
      what_to_order: "Smoked chicken, crispy potatoes, and chili crisp cucumbers.",
    },
    checkins: [["2026-07-11T02:15:00.000Z", "Counter seats were worth the wait." ]],
  },
  {
    key: "paper-crane-noodles",
    name: "Paper Crane Noodles",
    address: "317 S Broadway, Los Angeles, CA 90013",
    lat: 34.0505,
    lon: -118.2483,
    lists: ["Places to Eat", "Work Lunches"],
    ratings: { go_back: "true", price: "$", stars: "4" },
    notes: {
      notes: "Fast counter service and reliable weekday lunch specials.",
      what_to_order: "Spicy sesame noodles with an extra tea egg.",
      people: "Solo lunch or coworkers.",
    },
    checkins: [["2026-07-14T19:10:00.000Z", "In and out in 35 minutes." ]],
  },
  {
    key: "olive-and-rye",
    name: "Olive & Rye",
    address: "700 S Grand Ave, Los Angeles, CA 90017",
    lat: 34.0464,
    lon: -118.2571,
    lists: ["Places to Eat", "Work Lunches"],
    ratings: { go_back: "true", price: "$$", stars: "3" },
    notes: {
      notes: "Good sandwiches and lots of tables for a working lunch.",
      what_to_order: "Roasted vegetable focaccia.",
    },
    checkins: [["2026-06-30T19:30:00.000Z", "Quiet after the noon rush." ]],
  },
  {
    key: "saffron-window",
    name: "Saffron Window",
    address: "506 S Spring St, Los Angeles, CA 90013",
    lat: 34.0455,
    lon: -118.2508,
    lists: ["Places to Eat", "Work Lunches"],
    ratings: { go_back: "false", price: "$$", stars: "3" },
    notes: {
      notes: "Quick rice bowls with rotating sauces.",
      what_to_order: "Crispy chickpea bowl with green chutney.",
      what_to_avoid: "Pickup line gets crowded around 12:30.",
    },
    checkins: [["2026-06-12T20:00:00.000Z", "Solid, but the wait was longer than expected." ]],
  },
];

function getOrCreateUser() {
  const existing = db.prepare("SELECT id, email FROM users ORDER BY id LIMIT 1").get();
  if (existing) return { ...existing, created: false };

  const password = process.env.DEV_LOGIN_PASSWORD ?? "devpassword123";
  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = `${salt}:${crypto.scryptSync(password, salt, 64).toString("hex")}`;
  const email = process.env.DEV_LOGIN_EMAIL ?? "dev@localhost";
  const result = db
    .prepare("INSERT INTO users (name, email, password_hash, role, active) VALUES (?, ?, ?, 'admin', 1)")
    .run("Dev", email, passwordHash);
  return { id: Number(result.lastInsertRowid), email, created: true };
}

function getOrCreateList(name, description, userId) {
  const existing = db.prepare("SELECT id FROM lists WHERE name = ? ORDER BY id LIMIT 1").get(name);
  if (existing) return existing.id;
  return Number(
    db.prepare("INSERT INTO lists (name, description, created_by) VALUES (?, ?, ?)").run(name, description, userId)
      .lastInsertRowid,
  );
}

function seedDefinitions() {
  const presets = [
    ["go_back", "Go Back", "boolean", "check-circle", "[]", null, null],
    ["price", "Price", "choice", "dollar-sign", JSON.stringify(["$", "$$", "$$$", "$$$$"]), null, null],
    ["stars", "Stars", "scale", "star", "[]", 1, 5],
  ];
  const upsert = db.prepare(`
    INSERT INTO rating_definitions
      (list_id, scope, preset_key, name, type, icon, options_json, min, max, active)
    VALUES (NULL, 'global', ?, ?, ?, ?, ?, ?, ?, 1)
    ON CONFLICT(scope, preset_key) DO UPDATE SET
      name = excluded.name,
      type = excluded.type,
      icon = excluded.icon,
      options_json = excluded.options_json,
      min = excluded.min,
      max = excluded.max
  `);
  for (const preset of presets) upsert.run(...preset);

  const notePresets = [
    ["notes", "Notes", 0],
    ["what_to_order", "What to order", 1],
    ["what_to_avoid", "What to avoid", 2],
    ["people", "People", 3],
  ];
  const upsertNote = db.prepare(`
    INSERT INTO note_sections (preset_key, name, sort_order) VALUES (?, ?, ?)
    ON CONFLICT(preset_key) DO UPDATE SET name = excluded.name, sort_order = excluded.sort_order
  `);
  for (const preset of notePresets) upsertNote.run(...preset);
}

const seed = db.transaction(() => {
  const user = getOrCreateUser();
  db.prepare("INSERT OR IGNORE INTO app_settings (id, self_signup_enabled) VALUES (1, 0)").run();
  seedDefinitions();

  const listIds = new Map([
    ["Places to Eat", getOrCreateList("Places to Eat", "Default shared list", user.id)],
    ["Weekend Favorites", getOrCreateList("Weekend Favorites", "Restaurants worth making plans for", user.id)],
    ["Work Lunches", getOrCreateList("Work Lunches", "Reliable weekday lunch options", user.id)],
  ]);
  const definitionIds = new Map(
    db
      .prepare("SELECT preset_key AS presetKey, id FROM rating_definitions WHERE scope = 'global' AND preset_key IS NOT NULL")
      .all()
      .map((row) => [row.presetKey, row.id]),
  );
  const noteSectionIds = new Map(
    db
      .prepare("SELECT preset_key AS presetKey, id FROM note_sections WHERE preset_key IS NOT NULL")
      .all()
      .map((row) => [row.presetKey, row.id]),
  );

  const upsertPlace = db.prepare(`
    INSERT INTO places (osm_type, osm_id, name, address, lat, lon, raw_json)
    VALUES ('test_seed', ?, ?, ?, ?, ?, ?)
    ON CONFLICT(osm_type, osm_id) DO UPDATE SET
      name = excluded.name,
      address = excluded.address,
      lat = excluded.lat,
      lon = excluded.lon,
      raw_json = excluded.raw_json
  `);
  const upsertRestaurant = db.prepare(`
    INSERT INTO restaurants (place_id, notes, created_by)
    VALUES (?, ?, ?)
    ON CONFLICT(place_id) DO UPDATE SET notes = excluded.notes, updated_at = CURRENT_TIMESTAMP
  `);
  const upsertRating = db.prepare(`
    INSERT INTO rating_values (restaurant_id, definition_id, value) VALUES (?, ?, ?)
    ON CONFLICT(restaurant_id, definition_id) DO UPDATE SET value = excluded.value
  `);

  for (const restaurant of testRestaurants) {
    const rawJson = JSON.stringify({ source: "munchbase-test-seed", key: restaurant.key });
    upsertPlace.run(restaurant.key, restaurant.name, restaurant.address, restaurant.lat, restaurant.lon, rawJson);
    const place = db.prepare("SELECT id FROM places WHERE osm_type = 'test_seed' AND osm_id = ?").get(restaurant.key);
    const notes = Object.entries(restaurant.notes)
      .map(([sectionKey, value]) => `<!--section:${noteSectionIds.get(sectionKey)}-->\n${value}`)
      .join("\n\n");
    upsertRestaurant.run(place.id, notes, user.id);
    const saved = db.prepare("SELECT id FROM restaurants WHERE place_id = ?").get(place.id);

    db.prepare("DELETE FROM list_restaurants WHERE restaurant_id = ?").run(saved.id);
    for (const listName of restaurant.lists) {
      db.prepare("INSERT INTO list_restaurants (list_id, restaurant_id) VALUES (?, ?)").run(listIds.get(listName), saved.id);
    }

    for (const [presetKey, value] of Object.entries(restaurant.ratings)) {
      upsertRating.run(saved.id, definitionIds.get(presetKey), value);
    }

    db.prepare("DELETE FROM checkins WHERE restaurant_id = ? AND author_id = ?").run(saved.id, user.id);
    for (const [visitedAt, checkinNotes] of restaurant.checkins) {
      db.prepare("INSERT INTO checkins (restaurant_id, author_id, visited_at, notes) VALUES (?, ?, ?, ?)").run(
        saved.id,
        user.id,
        visitedAt,
        checkinNotes,
      );
    }
  }

  return { user, lists: listIds.size, restaurants: testRestaurants.length };
});

try {
  const result = seed();
  console.log(`Seeded ${result.restaurants} Restaurants across ${result.lists} Lists in ${databasePath}`);
  if (result.user.created) {
    console.log(`Created local admin ${result.user.email} (password: ${process.env.DEV_LOGIN_PASSWORD ?? "devpassword123"})`);
  } else {
    console.log(`Assigned test data to existing user ${result.user.email}`);
  }
  console.log("In development, visit /api/dev-login to sign in without entering a password.");
} finally {
  db.close();
}
