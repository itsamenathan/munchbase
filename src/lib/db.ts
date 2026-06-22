import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import path from "node:path";
import * as schema from "@/db/schema";
import { getPhotoMediaUrl } from "./restaurant-photos";
import { RATING_PRESETS } from "./ratings";
import type {
  AppState,
  CheckIn,
  List,
  RatingDefinition,
  RatingValue,
  Restaurant,
  RestaurantListMembership,
  RestaurantPhoto,
  User,
} from "./types";

let db: Database.Database | null = null;
let orm: ReturnType<typeof drizzle<typeof schema>> | null = null;

type RatingDefinitionRow = Omit<RatingDefinition, "options"> & { optionsJson: string };

function parseRatingDefinition(row: RatingDefinitionRow): RatingDefinition {
  return { ...row, options: JSON.parse(row.optionsJson) as string[] };
}

export function getDb() {
  if (db) return db;
  const databasePath = process.env.DATABASE_PATH ?? "./data/munchbase.db";
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  db = new Database(databasePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  orm = drizzle(db, { schema });
  migrate(orm, { migrationsFolder: "./drizzle" });
  ensureRatingDefinitionScope(db);
  seedGlobalRatingPresets(db);
  return db;
}

function ensureRatingDefinitionScope(database: Database.Database) {
  const table = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'rating_definitions'")
    .get();
  if (!table) return;
  const columns = database.prepare("PRAGMA table_info(rating_definitions)").all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === "scope")) {
    database.prepare("ALTER TABLE rating_definitions ADD COLUMN scope text DEFAULT 'list' NOT NULL").run();
  }
  const listIdColumn = (database.prepare("PRAGMA table_info(rating_definitions)").all() as Array<{ name: string; notnull: number }>).find(
    (column) => column.name === "list_id",
  );
  if (listIdColumn?.notnull) {
    rebuildRatingDefinitionsWithNullableListId(database);
  }
  database
    .prepare("CREATE UNIQUE INDEX IF NOT EXISTS rating_definitions_global_preset_key_unique ON rating_definitions (scope, preset_key)")
    .run();
}

function rebuildRatingDefinitionsWithNullableListId(database: Database.Database) {
  database.pragma("foreign_keys = OFF");
  const rebuild = database.transaction(() => {
    database.prepare("DROP INDEX IF EXISTS rating_definitions_list_id_preset_key_unique").run();
    database.prepare("DROP INDEX IF EXISTS rating_definitions_global_preset_key_unique").run();
    database
      .prepare(
        `CREATE TABLE rating_definitions_new (
          id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
          list_id integer,
          scope text DEFAULT 'list' NOT NULL,
          preset_key text,
          name text NOT NULL,
          type text NOT NULL,
          icon text DEFAULT 'tag' NOT NULL,
          options_json text DEFAULT '[]' NOT NULL,
          min integer,
          max integer,
          active integer DEFAULT true NOT NULL,
          created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
          FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE cascade
        )`,
      )
      .run();
    database
      .prepare(
        `INSERT INTO rating_definitions_new
         (id, list_id, scope, preset_key, name, type, icon, options_json, min, max, active, created_at)
         SELECT id, list_id, COALESCE(scope, 'list'), preset_key, name, type, icon, options_json, min, max, active, created_at
         FROM rating_definitions`,
      )
      .run();
    database.prepare("DROP TABLE rating_definitions").run();
    database.prepare("ALTER TABLE rating_definitions_new RENAME TO rating_definitions").run();
    database.prepare("CREATE UNIQUE INDEX rating_definitions_list_id_preset_key_unique ON rating_definitions (list_id, preset_key)").run();
    database.prepare("CREATE UNIQUE INDEX rating_definitions_global_preset_key_unique ON rating_definitions (scope, preset_key)").run();
  });
  rebuild();
  database.pragma("foreign_keys = ON");
}

function seedGlobalRatingPresets(database: Database.Database) {
  for (const preset of RATING_PRESETS) {
    database
      .prepare(
        `INSERT INTO rating_definitions
         (list_id, scope, preset_key, name, type, icon, options_json, min, max, active)
         VALUES (NULL, 'global', ?, ?, ?, ?, ?, ?, ?, 1)
         ON CONFLICT(scope, preset_key) DO UPDATE SET
           name = excluded.name,
           type = excluded.type,
           icon = excluded.icon,
           options_json = excluded.options_json,
           min = excluded.min,
           max = excluded.max`,
      )
      .run(preset.key, preset.name, preset.type, preset.icon, JSON.stringify(preset.options), preset.min, preset.max);
  }
}

export function getOrm() {
  getDb();
  if (!orm) throw new Error("Database ORM failed to initialize.");
  return orm;
}

export function userCount() {
  return getDb().prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number };
}

export function getUserByEmail(email: string) {
  return getDb()
    .prepare("SELECT id, name, email, role, active, password_hash AS passwordHash FROM users WHERE email = ?")
    .get(email) as (User & { passwordHash: string }) | undefined;
}

export function getUserBySession(sessionId: string) {
  return getDb()
    .prepare(
      `SELECT users.id, users.name, users.email, users.role, users.active
       FROM sessions JOIN users ON users.id = sessions.user_id
       WHERE sessions.id = ? AND sessions.expires_at > CURRENT_TIMESTAMP AND users.active = 1`,
    )
    .get(sessionId) as User | undefined;
}

export function getAppState(user: User, listId?: number | null): AppState {
  const database = getDb();
  const lists = database
    .prepare(
      `SELECT id, name, description
       FROM lists
       ORDER BY lists.created_at DESC`,
    )
    .all() as List[];
  const activeList = listId ? (lists.find((list) => list.id === listId) ?? null) : null;
  const activeListId = activeList?.id ?? null;

  const globalRatingDefinitions = (database
    .prepare(
      `SELECT id, list_id AS listId, scope, preset_key AS presetKey, name, type, icon, options_json AS optionsJson, min, max, active
       FROM rating_definitions WHERE scope = 'global' ORDER BY id`,
    )
    .all() as RatingDefinitionRow[]).map(parseRatingDefinition);
  const ratingDefinitions = activeList
    ? (database
        .prepare(
          `SELECT id, list_id AS listId, scope, preset_key AS presetKey, name, type, icon, options_json AS optionsJson, min, max, active
           FROM rating_definitions WHERE scope = 'list' AND list_id = ? ORDER BY id`,
        )
        .all(activeList.id) as RatingDefinitionRow[]).map(parseRatingDefinition)
    : [];
  const allRatingDefinitions = (database
    .prepare(
      `SELECT id, list_id AS listId, scope, preset_key AS presetKey, name, type, icon, options_json AS optionsJson, min, max, active
       FROM rating_definitions WHERE scope = 'list' ORDER BY id`,
    )
    .all() as RatingDefinitionRow[]).map(parseRatingDefinition);

  const restaurants = getRestaurants(activeListId);
  const allRestaurants = activeListId ? getRestaurants(null) : restaurants;
  const users =
    user.role === "admin"
      ? (database.prepare("SELECT id, name, email, role, active FROM users ORDER BY active DESC, name").all() as User[])
      : [];
  const appSettings =
    (database
      .prepare("SELECT self_signup_enabled AS selfSignupEnabled FROM app_settings WHERE id = 1")
      .get() as AppState["appSettings"] | undefined) ?? { selfSignupEnabled: false };

  return { user, lists, activeList, activeListId, restaurants, allRestaurants, globalRatingDefinitions, ratingDefinitions, allRatingDefinitions, users, appSettings };
}

export function getRestaurants(listId: number | null = null): Restaurant[] {
  const database = getDb();
  const whereClause = listId
    ? "WHERE restaurants.id IN (SELECT restaurant_id FROM list_restaurants WHERE list_id = ?)"
    : "";
  const rows = database
    .prepare(
      `SELECT restaurants.id, places.id AS placeId,
              places.name, places.address, places.lat, places.lon, places.osm_type AS osmType,
              places.osm_id AS osmId, restaurants.standing_notes AS standingNotes,
              restaurants.favorite_items AS favoriteItems,
              restaurants.ordering_tips AS orderingTips,
              restaurants.google_maps_url AS googleMapsUrl,
              restaurants.yelp_url AS yelpUrl
       FROM restaurants
       JOIN places ON places.id = restaurants.place_id
       ${whereClause}
       ORDER BY places.name COLLATE NOCASE`,
    )
    .all(...(listId ? [listId] : [])) as Omit<Restaurant, "ratings" | "memberships" | "ratingGroups" | "latestCheckIn" | "checkIns" | "checkInCount" | "photos">[];

  return rows.map((restaurant) => ({
    ...restaurant,
    ratings: database
      .prepare("SELECT definition_id AS definitionId, value FROM rating_values WHERE restaurant_id = ?")
      .all(restaurant.id) as RatingValue[],
    memberships: database
      .prepare(
        `SELECT lists.id, lists.name
         FROM list_restaurants JOIN lists ON lists.id = list_restaurants.list_id
         WHERE list_restaurants.restaurant_id = ?
         ORDER BY lists.name COLLATE NOCASE`,
      )
      .all(restaurant.id) as RestaurantListMembership[],
    ratingGroups: getRestaurantRatingGroups(restaurant.id),
    checkIns: database
      .prepare(
        `SELECT checkins.id, users.name AS authorName, checkins.visited_at AS visitedAt, checkins.notes
         FROM checkins JOIN users ON users.id = checkins.author_id
         WHERE checkins.restaurant_id = ?
         ORDER BY checkins.visited_at DESC`,
      )
      .all(restaurant.id) as CheckIn[],
    latestCheckIn:
      (database
        .prepare(
          `SELECT checkins.id, users.name AS authorName, checkins.visited_at AS visitedAt, checkins.notes
           FROM checkins JOIN users ON users.id = checkins.author_id
           WHERE checkins.restaurant_id = ?
           ORDER BY checkins.visited_at DESC LIMIT 1`,
        )
        .get(restaurant.id) as CheckIn | undefined) ?? null,
    checkInCount: (
      database.prepare("SELECT COUNT(*) AS count FROM checkins WHERE restaurant_id = ?").get(restaurant.id) as { count: number }
    ).count,
    photos: (database
      .prepare(
        `SELECT restaurant_photos.id,
                restaurant_photos.description,
                users.name AS uploadedByName,
                restaurant_photos.storage_key AS storageKey,
                restaurant_photos.thumbnail_storage_key AS thumbnailStorageKey,
                restaurant_photos.created_at AS createdAt
         FROM restaurant_photos
         JOIN users ON users.id = restaurant_photos.uploaded_by
         WHERE restaurant_photos.restaurant_id = ?
         ORDER BY restaurant_photos.created_at DESC, restaurant_photos.id DESC`,
      )
      .all(restaurant.id) as Array<{
      id: number;
      description: string | null;
      uploadedByName: string;
      storageKey: string;
      thumbnailStorageKey: string;
      createdAt: string;
    }>).map((photo): RestaurantPhoto => ({
      id: photo.id,
      description: photo.description,
      uploadedByName: photo.uploadedByName,
      imageUrl: getPhotoMediaUrl(photo.storageKey),
      thumbnailUrl: getPhotoMediaUrl(photo.thumbnailStorageKey),
      createdAt: photo.createdAt,
    })),
  }));
}

export function getRestaurantRatingGroups(restaurantId: number) {
  const database = getDb();
  const memberships = database
    .prepare(
      `SELECT lists.id, lists.name
       FROM list_restaurants JOIN lists ON lists.id = list_restaurants.list_id
       WHERE list_restaurants.restaurant_id = ?
       ORDER BY lists.name COLLATE NOCASE`,
    )
    .all(restaurantId) as RestaurantListMembership[];
  return memberships.map((list) => ({
    list,
    definitions: (database
      .prepare(
        `SELECT id, list_id AS listId, scope, preset_key AS presetKey, name, type, icon, options_json AS optionsJson, min, max, active
         FROM rating_definitions WHERE scope = 'list' AND list_id = ? ORDER BY id`,
      )
      .all(list.id) as RatingDefinitionRow[]).map(parseRatingDefinition),
  }));
}

export function getCheckIns(restaurantId: number) {
  return getDb()
    .prepare(
      `SELECT checkins.id, users.name AS authorName, checkins.visited_at AS visitedAt, checkins.notes
       FROM checkins JOIN users ON users.id = checkins.author_id
       WHERE checkins.restaurant_id = ?
       ORDER BY checkins.visited_at DESC`,
    )
    .all(restaurantId) as CheckIn[];
}
