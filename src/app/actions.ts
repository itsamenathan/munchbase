"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSession, currentUser, destroySession, hashPassword, verifyPassword } from "@/lib/auth";
import { localDateTimeInputValue } from "@/lib/datetime";
import { canWrite, getAccess, getAppState, getDb, getUserByEmail, userCount } from "@/lib/db";
import { normalizeExternalUrl } from "@/lib/external-links";
import { normalizeRatingDefinition, presetByKey, RATING_PRESETS, validateRatingValue } from "@/lib/ratings";
import type { RatingDefinition, RatingPresetKey, RatingType } from "@/lib/types";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function insertDefaultRatingPresets(listId: number) {
  const db = getDb();
  for (const preset of RATING_PRESETS) {
    db.prepare(
      `INSERT OR IGNORE INTO rating_definitions (list_id, preset_key, name, type, icon, options_json, min, max)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(listId, preset.key, preset.name, preset.type, preset.icon, JSON.stringify(preset.options), preset.min, preset.max);
  }
}

async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/");
  return user;
}

async function requireWrite(listId: number) {
  const user = await requireUser();
  const access = getAccess(user.id, listId)?.access;
  if (!canWrite(access)) throw new Error("You do not have write access to this list.");
  return user;
}

export async function setup(formData: FormData) {
  if (userCount().count > 0) throw new Error("Setup is already complete.");
  const name = text(formData, "name");
  const email = text(formData, "email").toLowerCase();
  const password = text(formData, "password");
  if (!name || !email || password.length < 8) throw new Error("Name, email, and an 8+ character password are required.");
  const db = getDb();
  const passwordHash = await hashPassword(password);
  const result = db
    .prepare("INSERT INTO users (name, email, password_hash, role, active) VALUES (?, ?, ?, 'admin', 1)")
    .run(name, email, passwordHash);
  const userId = Number(result.lastInsertRowid);
  const list = db
    .prepare("INSERT INTO lists (name, description, owner_id) VALUES ('Places to Eat', 'Default shared list', ?)")
    .run(userId);
  const listId = Number(list.lastInsertRowid);
  db.prepare("INSERT INTO list_members (list_id, user_id, access) VALUES (?, ?, 'owner')").run(
    listId,
    userId,
  );
  insertDefaultRatingPresets(listId);
  db.prepare("INSERT OR IGNORE INTO app_settings (id, self_signup_enabled) VALUES (1, 0)").run();
  await createSession(userId);
  redirect("/");
}

export async function signup(formData: FormData) {
  const db = getDb();
  const settings = db
    .prepare("SELECT self_signup_enabled AS selfSignupEnabled FROM app_settings WHERE id = 1")
    .get() as { selfSignupEnabled: boolean } | undefined;
  if (!settings?.selfSignupEnabled) throw new Error("Self-signup is disabled.");
  const name = text(formData, "name");
  const email = text(formData, "email").toLowerCase();
  const password = text(formData, "password");
  if (!name || !email || password.length < 8) throw new Error("Name, email, and an 8+ character password are required.");
  const result = db
    .prepare("INSERT INTO users (name, email, password_hash, role, active) VALUES (?, ?, ?, 'user', 1)")
    .run(name, email, await hashPassword(password));
  await createSession(Number(result.lastInsertRowid));
  redirect("/");
}

export async function login(formData: FormData) {
  const email = text(formData, "email").toLowerCase();
  const password = text(formData, "password");
  const user = getUserByEmail(email);
  if (!user || !user.active || !(await verifyPassword(password, user.passwordHash))) {
    throw new Error("Invalid email or password.");
  }
  await createSession(user.id);
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/");
}

async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") throw new Error("Only admins can manage users.");
  return user;
}

export async function createUser(formData: FormData) {
  await requireAdmin();
  const name = text(formData, "name");
  const email = text(formData, "email").toLowerCase();
  const password = text(formData, "password");
  const role = text(formData, "role") === "admin" ? "admin" : "user";
  if (!name || !email || password.length < 8) throw new Error("Name, email, and an 8+ character password are required.");
  getDb()
    .prepare("INSERT INTO users (name, email, password_hash, role, active) VALUES (?, ?, ?, ?, 1)")
    .run(name, email, await hashPassword(password), role);
  revalidatePath("/");
}

export async function setUserActive(formData: FormData) {
  const admin = await requireAdmin();
  const userId = Number(text(formData, "userId"));
  const active = text(formData, "active") === "1" ? 1 : 0;
  if (admin.id === userId && active === 0) throw new Error("You cannot deactivate your own account.");
  getDb().prepare("UPDATE users SET active = ? WHERE id = ?").run(active, userId);
  if (!active) getDb().prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  revalidatePath("/");
}

export async function updateSelfSignup(formData: FormData) {
  await requireAdmin();
  const enabled = text(formData, "selfSignupEnabled") === "1" ? 1 : 0;
  getDb()
    .prepare(
      `INSERT INTO app_settings (id, self_signup_enabled, updated_at) VALUES (1, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET self_signup_enabled = excluded.self_signup_enabled, updated_at = CURRENT_TIMESTAMP`,
    )
    .run(enabled);
  revalidatePath("/");
}

export async function createList(formData: FormData) {
  const user = await requireUser();
  const name = text(formData, "name");
  const description = text(formData, "description") || null;
  if (!name) throw new Error("List name is required.");
  const db = getDb();
  const result = db.prepare("INSERT INTO lists (name, description, owner_id) VALUES (?, ?, ?)").run(name, description, user.id);
  const listId = Number(result.lastInsertRowid);
  db.prepare("INSERT INTO list_members (list_id, user_id, access) VALUES (?, ?, 'owner')").run(listId, user.id);
  insertDefaultRatingPresets(listId);
  revalidatePath("/");
}

export async function updateListDetails(formData: FormData) {
  const listId = Number(text(formData, "listId"));
  const user = await requireUser();
  const access = getAccess(user.id, listId)?.access;
  if (access !== "owner") throw new Error("Only list owners can edit list settings.");
  const name = text(formData, "name");
  if (!name) throw new Error("List name is required.");
  getDb()
    .prepare("UPDATE lists SET name = ?, description = ? WHERE id = ?")
    .run(name, text(formData, "description") || null, listId);
  revalidatePath("/");
}

export async function shareList(formData: FormData) {
  const listId = Number(text(formData, "listId"));
  const user = await requireUser();
  const access = getAccess(user.id, listId)?.access;
  if (access !== "owner") throw new Error("Only list owners can share a list.");
  const memberId = Number(text(formData, "userId"));
  const memberAccess = text(formData, "access") === "read" ? "read" : "write";
  const member = getDb().prepare("SELECT id, active FROM users WHERE id = ?").get(memberId) as
    | { id: number; active: boolean }
    | undefined;
  if (!member || !member.active) throw new Error("Choose an active existing user.");
  getDb()
    .prepare(
      `INSERT INTO list_members (list_id, user_id, access) VALUES (?, ?, ?)
       ON CONFLICT(list_id, user_id) DO UPDATE SET access = excluded.access`,
    )
    .run(listId, member.id, memberAccess);
  revalidatePath("/");
}

export async function removeListMember(formData: FormData) {
  const listId = Number(text(formData, "listId"));
  const memberId = Number(text(formData, "userId"));
  const user = await requireUser();
  const access = getAccess(user.id, listId)?.access;
  if (access !== "owner") throw new Error("Only list owners can remove members.");
  if (memberId === user.id) throw new Error("You cannot remove yourself from a list you own.");
  getDb().prepare("DELETE FROM list_members WHERE list_id = ? AND user_id = ? AND access != 'owner'").run(listId, memberId);
  revalidatePath("/");
}

export async function addRestaurant(formData: FormData) {
  const listId = Number(text(formData, "listId"));
  const user = await requireWrite(listId);
  const name = text(formData, "name");
  if (!name) throw new Error("Restaurant name is required.");
  const osmType = text(formData, "osmType") || null;
  const osmId = text(formData, "osmId") || null;
  const address = text(formData, "address") || null;
  const lat = text(formData, "lat") ? Number(text(formData, "lat")) : null;
  const lon = text(formData, "lon") ? Number(text(formData, "lon")) : null;
  const db = getDb();
  let placeId: number | undefined;
  if (osmType && osmId) {
    const existing = db.prepare("SELECT id FROM places WHERE osm_type = ? AND osm_id = ?").get(osmType, osmId) as
      | { id: number }
      | undefined;
    placeId = existing?.id;
  }
  if (!placeId) {
    const result = db
      .prepare("INSERT INTO places (osm_type, osm_id, name, address, lat, lon, raw_json) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(osmType, osmId, name, address, lat, lon, text(formData, "rawJson") || null);
    placeId = Number(result.lastInsertRowid);
  }
  db.prepare(
    `INSERT OR IGNORE INTO restaurant_entries
     (list_id, place_id, standing_notes, favorite_items, ordering_tips, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    listId,
    placeId,
    text(formData, "standingNotes") || null,
    text(formData, "favoriteItems") || null,
    text(formData, "orderingTips") || null,
    user.id,
  );
  const entry = db
    .prepare("SELECT id FROM restaurant_entries WHERE list_id = ? AND place_id = ?")
    .get(listId, placeId) as { id: number } | undefined;
  if (!entry) throw new Error("Restaurant entry could not be created.");
  revalidatePath("/");
  redirect(`/?list=${listId}&entry=${entry.id}&edit=1`);
}

export async function updateEntry(formData: FormData) {
  const listId = Number(text(formData, "listId"));
  await requireWrite(listId);
  const entryId = Number(text(formData, "entryId"));
  getDb()
    .prepare(
      `UPDATE restaurant_entries
       SET standing_notes = ?, favorite_items = ?, ordering_tips = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND list_id = ?`,
    )
    .run(
      text(formData, "standingNotes") || null,
      text(formData, "favoriteItems") || null,
      text(formData, "orderingTips") || null,
      entryId,
      listId,
    );
  revalidatePath("/");
}

export async function updateExternalLinks(formData: FormData) {
  const listId = Number(text(formData, "listId"));
  await requireWrite(listId);
  const entryId = Number(text(formData, "entryId"));
  const googleMapsUrl = normalizeExternalUrl(text(formData, "googleMapsUrl"), "google");
  const yelpUrl = normalizeExternalUrl(text(formData, "yelpUrl"), "yelp");
  getDb()
    .prepare(
      `UPDATE restaurant_entries
       SET google_maps_url = ?, yelp_url = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND list_id = ?`,
    )
    .run(googleMapsUrl, yelpUrl, entryId, listId);
  revalidatePath("/");
}

export async function createRatingDefinition(formData: FormData) {
  const listId = Number(text(formData, "listId"));
  await requireWrite(listId);
  const definition = normalizeRatingDefinition({
    name: text(formData, "name"),
    type: text(formData, "type") as RatingType,
    icon: text(formData, "icon") || undefined,
    options: text(formData, "options"),
    min: text(formData, "min") || null,
    max: text(formData, "max") || null,
  });
  getDb()
    .prepare("INSERT INTO rating_definitions (list_id, preset_key, name, type, icon, options_json, min, max) VALUES (?, NULL, ?, ?, ?, ?, ?, ?)")
    .run(
      listId,
      definition.name,
      definition.type,
      definition.icon ?? "tag",
      JSON.stringify(definition.options),
      definition.type === "scale" ? definition.min : null,
      definition.type === "scale" ? definition.max : null,
    );
  revalidatePath("/");
}

export async function setRatingPresetEnabled(formData: FormData) {
  const listId = Number(text(formData, "listId"));
  await requireWrite(listId);
  const presetKey = text(formData, "presetKey") as RatingPresetKey;
  const enabled = text(formData, "enabled") === "1";
  const preset = presetByKey(presetKey);
  if (!preset) throw new Error("Unknown rating preset.");
  const db = getDb();
  if (enabled) {
    db.prepare(
      `INSERT OR IGNORE INTO rating_definitions (list_id, preset_key, name, type, icon, options_json, min, max)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(listId, preset.key, preset.name, preset.type, preset.icon, JSON.stringify(preset.options), preset.min, preset.max);
  } else {
    db.prepare("DELETE FROM rating_definitions WHERE list_id = ? AND preset_key = ?").run(listId, preset.key);
  }
  revalidatePath("/");
}

export async function updateRatingFieldActive(formData: FormData) {
  const listId = Number(text(formData, "listId"));
  await requireWrite(listId);
  const definitionId = Number(text(formData, "definitionId"));
  const active = text(formData, "active") === "1";
  getDb().prepare("UPDATE rating_definitions SET active = ? WHERE id = ? AND list_id = ?").run(active ? 1 : 0, definitionId, listId);
  revalidatePath("/");
}

export async function saveRatings(formData: FormData) {
  const listId = Number(text(formData, "listId"));
  await requireWrite(listId);
  const entryId = Number(text(formData, "entryId"));
  const state = getAppState(await requireUser(), listId);
  const definitions = new Map<number, RatingDefinition>(state.ratingDefinitions.map((definition) => [definition.id, definition]));
  const db = getDb();
  for (const [key, formValue] of formData.entries()) {
    if (!key.startsWith("rating:") || typeof formValue !== "string") continue;
    const definitionId = Number(key.split(":")[1]);
    const definition = definitions.get(definitionId);
    if (!definition) continue;
    const value = validateRatingValue(definition, formValue);
    if (!value) {
      db.prepare("DELETE FROM rating_values WHERE entry_id = ? AND definition_id = ?").run(entryId, definitionId);
    } else {
      db.prepare(
        `INSERT INTO rating_values (entry_id, definition_id, value) VALUES (?, ?, ?)
         ON CONFLICT(entry_id, definition_id) DO UPDATE SET value = excluded.value`,
      ).run(entryId, definitionId, value);
    }
  }
  revalidatePath("/");
}

export async function createCheckIn(formData: FormData) {
  const listId = Number(text(formData, "listId"));
  const user = await requireWrite(listId);
  const entryId = Number(text(formData, "entryId"));
  const visitedAt = text(formData, "visitedAt") || localDateTimeInputValue();
  getDb()
    .prepare("INSERT INTO checkins (entry_id, author_id, visited_at) VALUES (?, ?, ?)")
    .run(entryId, user.id, visitedAt);
  revalidatePath("/");
}

export async function deleteCheckIn(formData: FormData) {
  const listId = Number(text(formData, "listId"));
  await requireWrite(listId);
  getDb()
    .prepare(
      `DELETE FROM checkins
       WHERE id = ? AND entry_id IN (SELECT id FROM restaurant_entries WHERE list_id = ?)`,
    )
    .run(Number(text(formData, "checkInId")), listId);
  revalidatePath("/");
}

export async function updateCheckIn(formData: FormData) {
  const listId = Number(text(formData, "listId"));
  await requireWrite(listId);
  getDb()
    .prepare(
      `UPDATE checkins
       SET visited_at = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND entry_id IN (SELECT id FROM restaurant_entries WHERE list_id = ?)`,
    )
    .run(
      text(formData, "visitedAt"),
      Number(text(formData, "checkInId")),
      listId,
    );
  revalidatePath("/");
}
