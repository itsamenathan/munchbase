import { revalidatePath } from "next/cache";
import { createSession, currentUser, hashPassword } from "@/lib/auth";
import { localDateTimeInputValue } from "@/lib/datetime";
import { getDb, userCount } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { normalizeExternalUrl } from "@/lib/external-links";
import { googleMapsPlaceId, parseGoogleMapsUrlWithRedirects } from "@/lib/google-maps-url";
import { reverseGeocodeAddress } from "@/lib/photon";
import { deletePhotoFiles, saveRestaurantPhotoFiles } from "@/lib/restaurant-photos";
import { normalizeRatingDefinition, presetByKey, validateRatingValue } from "@/lib/ratings";
import { buildNotes } from "@/lib/note-sections";
import { restaurantHref, tabHref } from "@/lib/routes";
import type { RatingDefinition, RatingPresetKey, RatingType } from "@/lib/types";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function collectNoteUpdates(formData: FormData) {
  const updates: Record<number, string> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("note:") || typeof value !== "string") continue;
    const id = Number(key.slice("note:".length));
    if (Number.isInteger(id)) updates[id] = value.trim();
  }
  return updates;
}

function parseCustomFields(json: string) {
  if (!json) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error("Custom fields could not be read.");
  }
  if (!Array.isArray(raw)) throw new Error("Custom fields must be a list.");
  return raw.map((field) => {
    if (!field || typeof field !== "object") throw new Error("Custom field is invalid.");
    const input = field as Record<string, unknown>;
    return normalizeRatingDefinition({
      name: typeof input.name === "string" ? input.name : "",
      type: input.type as RatingType,
      icon: typeof input.icon === "string" ? input.icon : undefined,
      options: typeof input.options === "string" ? input.options : "",
      min: typeof input.min === "string" || typeof input.min === "number" ? input.min : null,
      max: typeof input.max === "string" || typeof input.max === "number" ? input.max : null,
    });
  });
}

function revalidateApp() {
  revalidatePath("/", "layout");
}

export type MutationContext = { ip: string };
export type MutationResult = { redirectTo?: string } | void;

export class MutationError extends Error {
  constructor(
    message: string,
    public readonly code = "invalid",
  ) {
    super(message);
  }
}

function parseRestaurantIds(json: string) {
  if (!json) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error("Restaurants could not be read.");
  }
  if (!Array.isArray(raw)) throw new Error("Restaurants must be a list.");
  return raw
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);
}

async function requireUser() {
  const user = await currentUser();
  if (!user) throw new MutationError("Sign in to continue.", "auth");
  return user;
}

export async function setup(formData: FormData, context: MutationContext) {
  const ip = context.ip;
  checkRateLimit(`setup:${ip}`, 5, 60 * 60 * 1000);
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
  db.prepare("INSERT INTO lists (name, description, created_by) VALUES ('Places to Eat', 'Default shared list', ?)").run(userId);
  db.prepare("INSERT OR IGNORE INTO app_settings (id, self_signup_enabled) VALUES (1, 0)").run();
  await createSession(userId);
  return { redirectTo: "/explore" };
}

export async function signup(formData: FormData, context: MutationContext) {
  const ip = context.ip;
  checkRateLimit(`signup:${ip}`, 5, 60 * 60 * 1000);
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
  return { redirectTo: "/explore" };
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
  revalidateApp();
}

export async function setUserActive(formData: FormData) {
  const admin = await requireAdmin();
  const userId = Number(text(formData, "userId"));
  const active = text(formData, "active") === "1" ? 1 : 0;
  if (admin.id === userId && active === 0) throw new Error("You cannot deactivate your own account.");
  getDb().prepare("UPDATE users SET active = ? WHERE id = ?").run(active, userId);
  if (!active) getDb().prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  revalidateApp();
}

export async function deleteRestaurant(formData: FormData) {
  await requireUser();
  const restaurantId = Number(text(formData, "restaurantId"));
  const listId = Number(text(formData, "listId")) || null;
  const db = getDb();
  const restaurant = db.prepare("SELECT place_id AS placeId FROM restaurants WHERE id = ?").get(restaurantId) as { placeId: number } | undefined;
  if (!restaurant) throw new Error("Restaurant not found.");
  db.prepare("DELETE FROM restaurants WHERE id = ?").run(restaurantId);
  db.prepare("DELETE FROM places WHERE id = ?").run(restaurant.placeId);
  revalidateApp();
  return { redirectTo: tabHref("list", listId) };
}

export async function deleteUser(formData: FormData) {
  const admin = await requireAdmin();
  const userId = Number(text(formData, "userId"));
  if (admin.id === userId) throw new Error("You cannot delete your own account.");
  const user = getDb().prepare("SELECT id FROM users WHERE id = ?").get(userId) as { id: number } | undefined;
  if (!user) throw new Error("User not found.");
  getDb().prepare("DELETE FROM users WHERE id = ?").run(userId);
  revalidateApp();
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
  revalidateApp();
}

export async function createList(formData: FormData) {
  const user = await requireUser();
  const name = text(formData, "name");
  const description = text(formData, "description") || null;
  if (!name) throw new Error("List name is required.");
  const db = getDb();
  const customFields = parseCustomFields(text(formData, "customFieldsJson"));
  const restaurantIds = parseRestaurantIds(text(formData, "restaurantIdsJson"));
  const create = db.transaction(() => {
    const result = db.prepare("INSERT INTO lists (name, description, created_by) VALUES (?, ?, ?)").run(name, description, user.id);
    const listId = Number(result.lastInsertRowid);
    for (const field of customFields) {
      db.prepare(
        `INSERT INTO rating_definitions
         (list_id, scope, preset_key, name, type, icon, options_json, min, max)
         VALUES (?, 'list', NULL, ?, ?, ?, ?, ?, ?)`,
      ).run(
        listId,
        field.name,
        field.type,
        field.icon ?? "tag",
        JSON.stringify(field.options),
        field.type === "scale" ? field.min : null,
        field.type === "scale" ? field.max : null,
      );
    }
    for (const restaurantId of restaurantIds) {
      db.prepare("INSERT OR IGNORE INTO list_restaurants (list_id, restaurant_id) VALUES (?, ?)").run(listId, restaurantId);
    }
    return listId;
  });
  const listId = create();
  revalidateApp();
  return { redirectTo: tabHref("list", listId) };
}

export async function updateListDetails(formData: FormData) {
  const listId = Number(text(formData, "listId"));
  await requireUser();
  const name = text(formData, "name");
  if (!name) throw new Error("List name is required.");
  getDb()
    .prepare("UPDATE lists SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .run(name, text(formData, "description") || null, listId);
  revalidateApp();
}

export async function deleteList(formData: FormData) {
  await requireUser();
  const listId = Number(text(formData, "listId"));
  const list = getDb().prepare("SELECT id FROM lists WHERE id = ?").get(listId) as { id: number } | undefined;
  if (!list) throw new Error("List not found.");
  getDb().prepare("DELETE FROM lists WHERE id = ?").run(listId);
  revalidateApp();
  return { redirectTo: tabHref("list", null) };
}

export async function addRestaurant(formData: FormData) {
  const listIdText = text(formData, "listId");
  const listId = listIdText ? Number(listIdText) : null;
  const user = await requireUser();
  const googleMapsUrlInput = text(formData, "googleMapsUrl");
  let parsedGoogleMapsUrl: Awaited<ReturnType<typeof parseGoogleMapsUrlWithRedirects>> | null = null;
  if (googleMapsUrlInput) {
    try {
      parsedGoogleMapsUrl = await parseGoogleMapsUrlWithRedirects(googleMapsUrlInput);
    } catch {
      parsedGoogleMapsUrl = null;
    }
  }

  const name = text(formData, "name") || parsedGoogleMapsUrl?.name || "";
  if (!name) throw new Error("Restaurant name is required.");
  const manualLat = text(formData, "lat") ? Number(text(formData, "lat")) : null;
  const manualLon = text(formData, "lon") ? Number(text(formData, "lon")) : null;
  const hasParsedCoords = parsedGoogleMapsUrl?.lat !== undefined && parsedGoogleMapsUrl.lon !== undefined;
  const osmType = text(formData, "osmType") || (hasParsedCoords && parsedGoogleMapsUrl ? "google_maps_url" : null);
  const osmId = text(formData, "osmId") || (hasParsedCoords && parsedGoogleMapsUrl ? googleMapsPlaceId(parsedGoogleMapsUrl.finalUrl) : null);
  const lat = manualLat ?? parsedGoogleMapsUrl?.lat ?? null;
  const lon = manualLon ?? parsedGoogleMapsUrl?.lon ?? null;
  const reverseGeocodedAddress = !text(formData, "address") && lat !== null && lon !== null ? await reverseGeocodeAddress(lat, lon) : null;
  const address = text(formData, "address") || parsedGoogleMapsUrl?.address || reverseGeocodedAddress || null;
  const rawJson = text(formData, "rawJson") || parsedGoogleMapsUrl?.rawJson || null;
  const googleMapsUrl = parsedGoogleMapsUrl?.sourceUrl ?? null;
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
      .run(osmType, osmId, name, address, lat, lon, rawJson);
    placeId = Number(result.lastInsertRowid);
  }
  db.prepare(
    `INSERT OR IGNORE INTO restaurants
     (place_id, notes, google_maps_url, created_by)
     VALUES (?, ?, ?, ?)`,
  ).run(placeId, buildNotes(null, collectNoteUpdates(formData)), googleMapsUrl, user.id);
  const restaurant = db
    .prepare("SELECT id FROM restaurants WHERE place_id = ?")
    .get(placeId) as { id: number } | undefined;
  if (!restaurant) throw new Error("Restaurant could not be created.");
  if (listId) {
    db.prepare("INSERT OR IGNORE INTO list_restaurants (list_id, restaurant_id) VALUES (?, ?)").run(listId, restaurant.id);
  }
  revalidateApp();
  return { redirectTo: restaurantHref(restaurant.id, listId, true) };
}

export async function addRestaurantFromGoogleMapsUrl(formData: FormData) {
  const listIdText = text(formData, "listId");
  const listId = listIdText ? Number(listIdText) : null;
  const user = await requireUser();
  const sourceUrl = text(formData, "googleMapsUrl");
  if (!sourceUrl) throw new MutationError("Google Maps URL is required.", "google_maps_url_required");

  let parsed: Awaited<ReturnType<typeof parseGoogleMapsUrlWithRedirects>>;
  try {
    parsed = await parseGoogleMapsUrlWithRedirects(sourceUrl);
  } catch {
    throw new MutationError("We couldn't read that Google Maps URL.", "google_maps_url_unreadable");
  }

  const name = text(formData, "name") || parsed.name;
  if (!name) throw new MutationError("Add a restaurant name for this Google Maps URL.", "restaurant_name_required");
  if (parsed.lat === undefined || parsed.lon === undefined) {
    throw new MutationError("We couldn't find coordinates in that Google Maps URL. Try an expanded place URL or add the restaurant manually.", "google_maps_location_missing");
  }

  const osmType = "google_maps_url";
  const osmId = googleMapsPlaceId(parsed.finalUrl);
  const address = parsed.address ?? await reverseGeocodeAddress(parsed.lat, parsed.lon);
  const db = getDb();
  const existing = db.prepare("SELECT id FROM places WHERE osm_type = ? AND osm_id = ?").get(osmType, osmId) as
    | { id: number }
    | undefined;
  const placeId = existing?.id ?? Number(db
    .prepare("INSERT INTO places (osm_type, osm_id, name, address, lat, lon, raw_json) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(osmType, osmId, name, address, parsed.lat, parsed.lon, parsed.rawJson).lastInsertRowid);

  db.prepare(
    `INSERT OR IGNORE INTO restaurants
     (place_id, notes, google_maps_url, created_by)
     VALUES (?, ?, ?, ?)`,
  ).run(placeId, buildNotes(null, collectNoteUpdates(formData)), parsed.sourceUrl, user.id);
  const restaurant = db
    .prepare("SELECT id FROM restaurants WHERE place_id = ?")
    .get(placeId) as { id: number } | undefined;
  if (!restaurant) throw new Error("Restaurant could not be created.");
  if (listId) {
    db.prepare("INSERT OR IGNORE INTO list_restaurants (list_id, restaurant_id) VALUES (?, ?)").run(listId, restaurant.id);
  }
  revalidateApp();
  return { redirectTo: restaurantHref(restaurant.id, listId, true) };
}

export async function updateEntry(formData: FormData) {
  await requireUser();
  const restaurantId = Number(text(formData, "restaurantId"));
  const db = getDb();
  const existing = db.prepare("SELECT notes FROM restaurants WHERE id = ?").get(restaurantId) as
    | { notes: string | null }
    | undefined;
  if (!existing) throw new Error("Restaurant not found.");

  const notes = buildNotes(existing.notes, collectNoteUpdates(formData));
  db.prepare(
    `UPDATE restaurants
     SET notes = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
  ).run(notes, restaurantId);
  revalidateApp();
}

export async function updateRestaurantMetadata(formData: FormData) {
  await requireUser();
  const restaurantId = Number(text(formData, "restaurantId"));
  const db = getDb();
  const existing = db.prepare("SELECT place_id AS placeId FROM restaurants WHERE id = ?").get(restaurantId) as
    | { placeId: number }
    | undefined;
  if (!existing) throw new Error("Restaurant not found.");

  const name = text(formData, "name");
  if (!name) throw new Error("Restaurant name is required.");
  const latText = text(formData, "lat");
  const lonText = text(formData, "lon");
  const lat = latText ? Number(latText) : null;
  const lon = lonText ? Number(lonText) : null;
  if (latText && (lat === null || !Number.isFinite(lat) || lat < -90 || lat > 90)) throw new Error("Latitude must be between -90 and 90.");
  if (lonText && (lon === null || !Number.isFinite(lon) || lon < -180 || lon > 180)) throw new Error("Longitude must be between -180 and 180.");

  db.prepare(
    `UPDATE places
     SET name = ?, address = ?, lat = ?, lon = ?
     WHERE id = ?`,
  ).run(name, text(formData, "address") || null, lat, lon, existing.placeId);
  db.prepare("UPDATE restaurants SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(restaurantId);
  revalidateApp();
}

export async function updateExternalLinks(formData: FormData) {
  await requireUser();
  const restaurantId = Number(text(formData, "restaurantId"));
  const googleMapsUrl = normalizeExternalUrl(text(formData, "googleMapsUrl"), "google");
  const yelpUrl = normalizeExternalUrl(text(formData, "yelpUrl"), "yelp");
  getDb()
    .prepare(
      `UPDATE restaurants
       SET google_maps_url = ?, yelp_url = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
    .run(googleMapsUrl, yelpUrl, restaurantId);
  revalidateApp();
}

export async function createRatingDefinition(formData: FormData) {
  await requireUser();
  const scope = text(formData, "scope") === "global" ? "global" : "list";
  const listId = scope === "list" ? Number(text(formData, "listId")) : null;
  if (scope === "list" && !listId) throw new Error("List is required.");
  const definition = normalizeRatingDefinition({
    name: text(formData, "name"),
    type: text(formData, "type") as RatingType,
    icon: text(formData, "icon") || undefined,
    options: text(formData, "options"),
    min: text(formData, "min") || null,
    max: text(formData, "max") || null,
  });
  getDb()
    .prepare(
      `INSERT INTO rating_definitions
       (list_id, scope, preset_key, name, type, icon, options_json, min, max)
       VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      listId,
      scope,
      definition.name,
      definition.type,
      definition.icon ?? "tag",
      JSON.stringify(definition.options),
      definition.type === "scale" ? definition.min : null,
      definition.type === "scale" ? definition.max : null,
    );
  revalidateApp();
}

export async function setRatingPresetEnabled(formData: FormData) {
  await requireUser();
  const presetKey = text(formData, "presetKey") as RatingPresetKey;
  const enabled = text(formData, "enabled") === "1";
  const preset = presetByKey(presetKey);
  if (!preset) throw new Error("Unknown rating preset.");
  const db = getDb();
  if (enabled) {
    db.prepare(
      `INSERT INTO rating_definitions
       (list_id, scope, preset_key, name, type, icon, options_json, min, max, active)
       VALUES (NULL, 'global', ?, ?, ?, ?, ?, ?, ?, 1)
       ON CONFLICT(scope, preset_key) DO UPDATE SET active = 1`,
    ).run(preset.key, preset.name, preset.type, preset.icon, JSON.stringify(preset.options), preset.min, preset.max);
  } else {
    db.prepare("UPDATE rating_definitions SET active = 0 WHERE scope = 'global' AND preset_key = ?").run(preset.key);
  }
  revalidateApp();
}

export async function updateRatingFieldActive(formData: FormData) {
  await requireUser();
  const definitionId = Number(text(formData, "definitionId"));
  const active = text(formData, "active") === "1";
  getDb().prepare("UPDATE rating_definitions SET active = ? WHERE id = ?").run(active ? 1 : 0, definitionId);
  revalidateApp();
}

export async function updateRatingDefinition(formData: FormData) {
  await requireUser();
  const definitionId = Number(text(formData, "definitionId"));
  const db = getDb();
  const existing = db
    .prepare("SELECT name, type, icon FROM rating_definitions WHERE id = ?")
    .get(definitionId) as { name: string; type: RatingType; icon: string } | undefined;
  if (!existing) throw new Error("Attribute not found.");

  const definition = normalizeRatingDefinition({
    name: text(formData, "name"),
    type: existing.type,
    icon: text(formData, "icon") || existing.icon,
    options: text(formData, "options"),
    min: text(formData, "min") || null,
    max: text(formData, "max") || null,
  });
  db.prepare("UPDATE rating_definitions SET name = ?, icon = ?, options_json = ?, min = ?, max = ? WHERE id = ?")
    .run(
      definition.name,
      definition.icon ?? "tag",
      JSON.stringify(definition.options),
      definition.type === "scale" ? definition.min : null,
      definition.type === "scale" ? definition.max : null,
      definitionId,
    );
  revalidateApp();
}

export async function reorderRatingDefinitions(formData: FormData) {
  await requireUser();
  const idsJson = text(formData, "orderedIdsJson");
  let ids: unknown;
  try { ids = JSON.parse(idsJson); } catch { throw new Error("Invalid order data."); }
  if (!Array.isArray(ids)) throw new Error("Invalid order data.");
  const db = getDb();
  const update = db.prepare("UPDATE rating_definitions SET sort_order = ? WHERE id = ?");
  db.transaction(() => { (ids as number[]).forEach((id, index) => update.run(index, id)); })();
  revalidateApp();
}

export async function deleteRatingField(formData: FormData) {
  await requireUser();
  const definitionId = Number(text(formData, "definitionId"));
  const definition = getDb()
    .prepare("SELECT id, preset_key AS presetKey FROM rating_definitions WHERE id = ?")
    .get(definitionId) as { id: number; presetKey: string | null } | undefined;
  if (!definition) throw new Error("Custom field not found.");
  if (definition.presetKey) throw new Error("Built-in fields cannot be removed.");
  getDb().prepare("DELETE FROM rating_definitions WHERE id = ?").run(definitionId);
  revalidateApp();
}

export async function createNoteSection(formData: FormData) {
  await requireUser();
  const name = text(formData, "name");
  if (!name) throw new Error("Heading name is required.");
  const db = getDb();
  const maxOrder = (db.prepare("SELECT COALESCE(MAX(sort_order), -1) AS maxOrder FROM note_sections").get() as {
    maxOrder: number;
  }).maxOrder;
  db.prepare("INSERT INTO note_sections (preset_key, name, sort_order) VALUES (NULL, ?, ?)").run(name, maxOrder + 1);
  revalidateApp();
}

export async function updateNoteSectionActive(formData: FormData) {
  await requireUser();
  const sectionId = Number(text(formData, "sectionId"));
  const active = text(formData, "active") === "1";
  getDb().prepare("UPDATE note_sections SET active = ? WHERE id = ?").run(active ? 1 : 0, sectionId);
  revalidateApp();
}

export async function updateNoteSectionName(formData: FormData) {
  await requireUser();
  const sectionId = Number(text(formData, "sectionId"));
  const name = text(formData, "name");
  if (!name) throw new Error("Name is required.");
  const db = getDb();
  const section = db.prepare("SELECT preset_key AS presetKey FROM note_sections WHERE id = ?").get(sectionId) as
    | { presetKey: string | null }
    | undefined;
  if (!section) throw new Error("Heading not found.");
  db.prepare("UPDATE note_sections SET name = ? WHERE id = ?").run(name, sectionId);
  revalidateApp();
}

export async function reorderNoteSections(formData: FormData) {
  await requireUser();
  const idsJson = text(formData, "orderedIdsJson");
  let ids: unknown;
  try {
    ids = JSON.parse(idsJson);
  } catch {
    throw new Error("Invalid order data.");
  }
  if (!Array.isArray(ids)) throw new Error("Invalid order data.");
  const db = getDb();
  const update = db.prepare("UPDATE note_sections SET sort_order = ? WHERE id = ?");
  db.transaction(() => { (ids as number[]).forEach((id, index) => update.run(index, id)); })();
  revalidateApp();
}

export async function deleteNoteSection(formData: FormData) {
  await requireUser();
  const sectionId = Number(text(formData, "sectionId"));
  const db = getDb();
  const section = db.prepare("SELECT preset_key AS presetKey FROM note_sections WHERE id = ?").get(sectionId) as
    | { presetKey: string | null }
    | undefined;
  if (!section) throw new Error("Heading not found.");
  if (section.presetKey) throw new Error("Built-in headings cannot be removed.");
  db.prepare("DELETE FROM note_sections WHERE id = ?").run(sectionId);
  revalidateApp();
}

export async function saveRatings(formData: FormData) {
  await requireUser();
  const restaurantId = Number(text(formData, "restaurantId"));
  const db = getDb();
  const definitions = new Map<number, RatingDefinition>(
    (db
      .prepare(
        `SELECT id, list_id AS listId, scope, preset_key AS presetKey, name, type, icon, options_json AS optionsJson, min, max, active
         FROM rating_definitions`,
      )
      .all() as Array<Omit<RatingDefinition, "options"> & { optionsJson: string }>).map((definition) => [
      definition.id,
      { ...definition, options: JSON.parse(definition.optionsJson) as string[] },
    ]),
  );
  for (const [key, formValue] of formData.entries()) {
    if (!key.startsWith("rating:") || typeof formValue !== "string") continue;
    const definitionId = Number(key.split(":")[1]);
    const definition = definitions.get(definitionId);
    if (!definition) continue;
    if (definition.scope === "list" && definition.listId !== null) {
      const membership = db
        .prepare("SELECT 1 FROM list_restaurants WHERE restaurant_id = ? AND list_id = ?")
        .get(restaurantId, definition.listId);
      if (!membership) continue;
    }
    const value = validateRatingValue(definition, formValue);
    if (!value) {
      db.prepare("DELETE FROM rating_values WHERE restaurant_id = ? AND definition_id = ?").run(restaurantId, definitionId);
    } else {
      db.prepare(
        `INSERT INTO rating_values (restaurant_id, definition_id, value) VALUES (?, ?, ?)
         ON CONFLICT(restaurant_id, definition_id) DO UPDATE SET value = excluded.value`,
      ).run(restaurantId, definitionId, value);
    }
  }
  revalidateApp();
}

export async function createCheckIn(formData: FormData) {
  const user = await requireUser();
  const restaurantId = Number(text(formData, "restaurantId"));
  const visitedAt = text(formData, "visitedAt") || localDateTimeInputValue();
  getDb()
    .prepare("INSERT INTO checkins (restaurant_id, author_id, visited_at) VALUES (?, ?, ?)")
    .run(restaurantId, user.id, visitedAt);
  revalidateApp();
}

export async function deleteCheckIn(formData: FormData) {
  await requireUser();
  getDb().prepare("DELETE FROM checkins WHERE id = ?").run(Number(text(formData, "checkInId")));
  revalidateApp();
}

export async function updateCheckIn(formData: FormData) {
  await requireUser();
  getDb()
    .prepare(
      `UPDATE checkins
       SET visited_at = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
    .run(
      text(formData, "visitedAt"),
      Number(text(formData, "checkInId")),
    );
  revalidateApp();
}

export async function attachRestaurantToList(formData: FormData) {
  await requireUser();
  const restaurantId = Number(text(formData, "restaurantId"));
  const listId = Number(text(formData, "listId"));
  if (!restaurantId || !listId) throw new Error("Choose a list.");
  getDb().prepare("INSERT OR IGNORE INTO list_restaurants (list_id, restaurant_id) VALUES (?, ?)").run(listId, restaurantId);
  revalidateApp();
  if (text(formData, "openRestaurant") === "1") {
    return { redirectTo: restaurantHref(restaurantId, listId) };
  }
}

export async function removeRestaurantFromList(formData: FormData) {
  await requireUser();
  const restaurantId = Number(text(formData, "restaurantId"));
  const listId = Number(text(formData, "listId"));
  getDb().prepare("DELETE FROM list_restaurants WHERE list_id = ? AND restaurant_id = ?").run(listId, restaurantId);
  revalidateApp();
}

export async function uploadRestaurantPhoto(formData: FormData) {
  const user = await requireUser();
  const restaurantId = Number(text(formData, "restaurantId"));
  if (!restaurantId) throw new Error("Restaurant is required.");
  const file = formData.get("photo");
  if (!(file instanceof File)) throw new Error("Choose an image to upload.");
  const description = text(formData, "description") || null;

  const restaurant = getDb().prepare("SELECT id FROM restaurants WHERE id = ?").get(restaurantId) as { id: number } | undefined;
  if (!restaurant) throw new Error("Restaurant not found.");

  const saved = await saveRestaurantPhotoFiles(restaurantId, file);
  try {
    getDb()
      .prepare(
        `INSERT INTO restaurant_photos
         (restaurant_id, storage_key, original_storage_key, thumbnail_storage_key, description, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(restaurantId, saved.storageKey, saved.originalStorageKey, saved.thumbnailStorageKey, description, user.id);
  } catch (error) {
    await deletePhotoFiles([saved.originalStorageKey, saved.storageKey, saved.thumbnailStorageKey]);
    throw error;
  }

  revalidateApp();
}

export async function updateRestaurantPhotoDescription(formData: FormData) {
  await requireUser();
  const photoId = Number(text(formData, "photoId"));
  if (!photoId) throw new Error("Photo is required.");
  getDb()
    .prepare(
      `UPDATE restaurant_photos
       SET description = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
    .run(text(formData, "description") || null, photoId);
  revalidateApp();
}

export async function deleteRestaurantPhoto(formData: FormData) {
  await requireUser();
  const photoId = Number(text(formData, "photoId"));
  if (!photoId) throw new Error("Photo is required.");

  const photo = getDb()
    .prepare(
      `SELECT original_storage_key AS originalStorageKey,
              storage_key AS storageKey,
              thumbnail_storage_key AS thumbnailStorageKey
       FROM restaurant_photos
       WHERE id = ?`,
    )
    .get(photoId) as { originalStorageKey: string; storageKey: string; thumbnailStorageKey: string } | undefined;
  if (!photo) throw new Error("Photo not found.");

  getDb().prepare("DELETE FROM restaurant_photos WHERE id = ?").run(photoId);
  await deletePhotoFiles([photo.originalStorageKey, photo.storageKey, photo.thumbnailStorageKey]);
  revalidateApp();
}
