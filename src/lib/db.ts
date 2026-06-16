import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import path from "node:path";
import * as schema from "@/db/schema";
import type {
  Access,
  AppState,
  CheckIn,
  List,
  RatingDefinition,
  RatingValue,
  RestaurantEntry,
  User,
} from "./types";

let db: Database.Database | null = null;
let orm: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (db) return db;
  const databasePath = process.env.DATABASE_PATH ?? "./data/munchbase.db";
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  db = new Database(databasePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  orm = drizzle(db, { schema });
  migrate(orm, { migrationsFolder: "./drizzle" });
  return db;
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

export function getAccess(userId: number, listId: number) {
  return getDb()
    .prepare("SELECT access FROM list_members WHERE user_id = ? AND list_id = ?")
    .get(userId, listId) as { access: Access } | undefined;
}

export function canWrite(access: Access | undefined) {
  return access === "owner" || access === "write";
}

export function getAppState(user: User, listId?: number): AppState {
  const database = getDb();
  const lists = database
    .prepare(
      `SELECT lists.id, lists.name, lists.description, list_members.access
       FROM lists JOIN list_members ON list_members.list_id = lists.id
       WHERE list_members.user_id = ?
       ORDER BY lists.created_at DESC`,
    )
    .all(user.id) as List[];
  const activeList = lists.find((list) => list.id === listId) ?? lists[0] ?? null;

  const ratingDefinitions = activeList
    ? (database
        .prepare(
          `SELECT id, list_id AS listId, preset_key AS presetKey, name, type, icon, options_json AS optionsJson, min, max, active
           FROM rating_definitions WHERE list_id = ? ORDER BY id`,
        )
        .all(activeList.id) as Array<
        Omit<RatingDefinition, "options"> & { optionsJson: string }
      >).map((row) => ({ ...row, options: JSON.parse(row.optionsJson) as string[] }))
    : [];

  const restaurants = activeList ? getRestaurants(activeList.id) : [];
  const activeAccess = activeList ? getAccess(user.id, activeList.id)?.access : undefined;
  const users =
    user.role === "admin"
      ? (database.prepare("SELECT id, name, email, role, active FROM users ORDER BY active DESC, name").all() as User[])
      : activeAccess === "owner"
        ? (database.prepare("SELECT id, name, email, role, active FROM users WHERE active = 1 ORDER BY name").all() as User[])
        : [];
  const listMembers = activeList
    ? (database
        .prepare(
          `SELECT users.id, users.name, users.email, users.role, users.active, list_members.access
           FROM list_members JOIN users ON users.id = list_members.user_id
           WHERE list_members.list_id = ?
           ORDER BY list_members.access = 'owner' DESC, users.name`,
        )
        .all(activeList.id) as AppState["listMembers"])
    : [];
  const appSettings =
    (database
      .prepare("SELECT self_signup_enabled AS selfSignupEnabled FROM app_settings WHERE id = 1")
      .get() as AppState["appSettings"] | undefined) ?? { selfSignupEnabled: false };

  return { user, lists, activeList, restaurants, ratingDefinitions, users, listMembers, appSettings };
}

export function getRestaurants(listId: number): RestaurantEntry[] {
  const database = getDb();
  const entries = database
    .prepare(
      `SELECT restaurant_entries.id, restaurant_entries.list_id AS listId, places.id AS placeId,
              places.name, places.address, places.lat, places.lon, places.osm_type AS osmType,
              places.osm_id AS osmId, restaurant_entries.standing_notes AS standingNotes,
              restaurant_entries.favorite_items AS favoriteItems,
              restaurant_entries.ordering_tips AS orderingTips,
              restaurant_entries.google_maps_url AS googleMapsUrl,
              restaurant_entries.yelp_url AS yelpUrl
       FROM restaurant_entries
       JOIN places ON places.id = restaurant_entries.place_id
       WHERE restaurant_entries.list_id = ?
       ORDER BY places.name COLLATE NOCASE`,
    )
    .all(listId) as Omit<RestaurantEntry, "ratings" | "latestCheckIn" | "checkInCount">[];

  return entries.map((entry) => ({
    ...entry,
    ratings: database
      .prepare("SELECT definition_id AS definitionId, value FROM rating_values WHERE entry_id = ?")
      .all(entry.id) as RatingValue[],
    checkIns: database
      .prepare(
        `SELECT checkins.id, users.name AS authorName, checkins.visited_at AS visitedAt, checkins.notes
         FROM checkins JOIN users ON users.id = checkins.author_id
         WHERE checkins.entry_id = ?
         ORDER BY checkins.visited_at DESC`,
      )
      .all(entry.id) as CheckIn[],
    latestCheckIn:
      (database
        .prepare(
          `SELECT checkins.id, users.name AS authorName, checkins.visited_at AS visitedAt, checkins.notes
           FROM checkins JOIN users ON users.id = checkins.author_id
           WHERE checkins.entry_id = ?
           ORDER BY checkins.visited_at DESC LIMIT 1`,
        )
        .get(entry.id) as CheckIn | undefined) ?? null,
    checkInCount: (
      database.prepare("SELECT COUNT(*) AS count FROM checkins WHERE entry_id = ?").get(entry.id) as { count: number }
    ).count,
  }));
}

export function getCheckIns(entryId: number) {
  return getDb()
    .prepare(
      `SELECT checkins.id, users.name AS authorName, checkins.visited_at AS visitedAt, checkins.notes
       FROM checkins JOIN users ON users.id = checkins.author_id
       WHERE checkins.entry_id = ?
       ORDER BY checkins.visited_at DESC`,
    )
    .all(entryId) as CheckIn[];
}
