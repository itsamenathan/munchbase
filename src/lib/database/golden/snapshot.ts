import {
  getAppState,
  getCheckIns,
  getDb,
  getRestaurants,
  getRestaurantRatingGroups,
  getUserByEmail,
  getUserBySession,
  firstUser,
  userCount,
} from "@/lib/db";
import type { List, User } from "@/lib/types";

/** The salt is random per seed run, so only its shape can be asserted. */
function redactPasswordHash(value: unknown) {
  if (!value || typeof value !== "object") return value;
  const row = { ...(value as Record<string, unknown>) };
  if (typeof row.passwordHash === "string") {
    const [salt, digest] = row.passwordHash.split(":");
    row.passwordHash = `<${salt?.length ?? 0}:${digest?.length ?? 0}>`;
  }
  return row;
}

function tableNames(): string[] {
  return (getDb()
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all() as Array<{ name: string }>).map((row) => row.name);
}

/**
 * `pragma_table_info` is a table-valued function, so the schema reads through
 * the ordinary query path rather than the driver-specific `.pragma()` helper.
 */
function schemaFingerprint() {
  return Object.fromEntries(
    tableNames().map((table) => [
      table,
      getDb()
        .prepare(`SELECT name, type, "notnull" AS "notNull", dflt_value AS defaultValue, pk FROM pragma_table_info(?) ORDER BY cid`)
        .all(table),
    ]),
  );
}

function rowCounts() {
  return Object.fromEntries(
    tableNames().map((table) => [
      table,
      (getDb().prepare(`SELECT COUNT(*) AS count FROM "${table}"`).get() as { count: number }).count,
    ]),
  );
}

/**
 * Every read path the app uses, exercised against the seeded corpus. The result
 * is compared byte-for-byte across driver changes.
 */
export function buildSnapshot() {
  const admin = firstUser();
  if (!admin) throw new Error("Seeded database has no user; the fixture did not run.");

  // Exercises the non-admin branch of getAppState, which returns an empty user list.
  const member: User = { ...admin, id: admin.id + 1000, name: "Member", email: "member@example.test", role: "user" };

  const lists = getAppState(admin, null).lists as List[];

  return {
    schema: schemaFingerprint(),
    rowCounts: rowCounts(),
    users: {
      count: userCount(),
      first: admin,
      byEmailHit: redactPasswordHash(getUserByEmail(admin.email)),
      // Misses are the shape that differs between drivers; pinning them is the point.
      byEmailMiss: getUserByEmail("nobody@example.test"),
      bySessionMiss: getUserBySession("session-that-does-not-exist"),
    },
    appState: {
      adminNoList: getAppState(admin, null),
      memberNoList: getAppState(member, null),
      byList: Object.fromEntries(lists.map((list) => [list.name, getAppState(admin, list.id)])),
      unknownList: getAppState(admin, 999999),
    },
    restaurants: {
      all: getRestaurants(null),
      byList: Object.fromEntries(lists.map((list) => [list.name, getRestaurants(list.id)])),
    },
    perRestaurant: Object.fromEntries(
      getRestaurants(null).map((restaurant) => [
        restaurant.name,
        { checkIns: getCheckIns(restaurant.id), ratingGroups: getRestaurantRatingGroups(restaurant.id) },
      ]),
    ),
  };
}
