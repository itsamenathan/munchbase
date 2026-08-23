import { buildNotes } from "@/lib/note-sections";
import { serializeRatingValues, validateRatingValue } from "@/lib/ratings";
import type { SerializedFormData } from "@/lib/offline-db";
import type { AppState, CheckIn, Restaurant } from "@/lib/types";

const SUPPORTED_ACTIONS = new Set([
  "updateEntryAndRatings",
  "updateRestaurantMetadata",
  "attachRestaurantToList",
  "removeRestaurantFromList",
  "createCheckIn",
  "updateCheckIn",
  "deleteCheckIn",
]);

export class UnsupportedOfflineMutationError extends Error {
  constructor(subject = "This change") {
    super(`${subject} needs a connection.`);
    this.name = "UnsupportedOfflineMutationError";
  }
}

export function supportsOfflineMutation(action: string) {
  return SUPPORTED_ACTIONS.has(action);
}

export function serializeMutationFormData(formData: FormData): SerializedFormData {
  const entries: SerializedFormData = [];
  for (const [key, value] of formData.entries()) {
    if (value instanceof File) throw new UnsupportedOfflineMutationError("Photo uploads");
    entries.push([key, value]);
  }
  return entries;
}

export function restoreMutationFormData(payload: SerializedFormData | Record<string, string>) {
  const formData = new FormData();
  const entries = Array.isArray(payload) ? payload : Object.entries(payload);
  for (const [key, value] of entries) formData.append(key, value);
  return formData;
}

function values(payload: SerializedFormData, key: string) {
  return payload.filter(([entryKey]) => entryKey === key).map(([, value]) => value);
}

function value(payload: SerializedFormData, key: string) {
  const matches = values(payload, key);
  return matches[matches.length - 1] ?? "";
}

function positiveId(payload: SerializedFormData, key: string) {
  const parsed = Number(value(payload, key));
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`Invalid ${key}.`);
  return parsed;
}

function replaceRestaurant(state: AppState, restaurant: Restaurant): AppState {
  const replace = (candidate: Restaurant) => candidate.id === restaurant.id ? restaurant : candidate;
  return {
    ...state,
    allRestaurants: state.allRestaurants.map(replace),
    restaurants: state.restaurants.map(replace),
  };
}

function updateNotesAndRatings(state: AppState, payload: SerializedFormData) {
  const restaurantId = positiveId(payload, "restaurantId");
  const restaurant = state.allRestaurants.find((entry) => entry.id === restaurantId);
  if (!restaurant) throw new Error("Restaurant not found in the offline cache.");

  const noteUpdates: Record<number, string> = {};
  for (const [key, submittedValue] of payload) {
    if (!key.startsWith("note:")) continue;
    const definitionId = Number(key.slice("note:".length));
    if (Number.isInteger(definitionId)) noteUpdates[definitionId] = submittedValue;
  }

  const ratings = [...restaurant.ratings];
  const ratingKeys = new Set(payload.map(([key]) => key).filter((key) => key.startsWith("rating:")));
  for (const key of ratingKeys) {
    const definitionId = Number(key.slice("rating:".length));
    const definition = state.allRatingDefinitions.find((candidate) => candidate.id === definitionId);
    if (!definition) continue;
    const submitted = values(payload, key).filter(Boolean);
    const raw = definition.type === "multi"
      ? serializeRatingValues(submitted)
      : values(payload, key).at(-1) ?? "";
    const nextValue = validateRatingValue(definition, raw);
    const existingIndex = ratings.findIndex((rating) => rating.definitionId === definitionId);
    if (!nextValue) {
      if (existingIndex >= 0) ratings.splice(existingIndex, 1);
    } else if (existingIndex >= 0) {
      ratings[existingIndex] = { definitionId, value: nextValue };
    } else {
      ratings.push({ definitionId, value: nextValue });
    }
  }

  return replaceRestaurant(state, {
    ...restaurant,
    notes: buildNotes(restaurant.notes, noteUpdates),
    ratings,
  });
}

function updateMetadata(state: AppState, payload: SerializedFormData) {
  const restaurantId = positiveId(payload, "restaurantId");
  const restaurant = state.allRestaurants.find((entry) => entry.id === restaurantId);
  if (!restaurant) throw new Error("Restaurant not found in the offline cache.");
  const name = value(payload, "name").trim();
  if (!name) throw new Error("Restaurant name is required.");
  const latValue = value(payload, "lat").trim();
  const lonValue = value(payload, "lon").trim();
  const lat = latValue ? Number(latValue) : null;
  const lon = lonValue ? Number(lonValue) : null;
  if (lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) {
    throw new Error("Latitude must be between -90 and 90.");
  }
  if (lon !== null && (!Number.isFinite(lon) || lon < -180 || lon > 180)) {
    throw new Error("Longitude must be between -180 and 180.");
  }
  return replaceRestaurant(state, {
    ...restaurant,
    name,
    address: value(payload, "address").trim() || null,
    lat,
    lon,
  });
}

function updateMembership(state: AppState, payload: SerializedFormData, attach: boolean) {
  const restaurantId = positiveId(payload, "restaurantId");
  const listId = positiveId(payload, "listId");
  const restaurant = state.allRestaurants.find((entry) => entry.id === restaurantId);
  const list = state.lists.find((entry) => entry.id === listId);
  if (!restaurant || !list) throw new Error("Restaurant or List not found in the offline cache.");

  const memberships = attach
    ? restaurant.memberships.some((membership) => membership.id === listId)
      ? restaurant.memberships
      : [...restaurant.memberships, { id: list.id, name: list.name }]
    : restaurant.memberships.filter((membership) => membership.id !== listId);
  const ratingGroups = attach
    ? restaurant.ratingGroups.some((group) => group.list.id === listId)
      ? restaurant.ratingGroups
      : [...restaurant.ratingGroups, {
          list: { id: list.id, name: list.name },
          definitions: state.allRatingDefinitions.filter((definition) => definition.listId === listId),
        }]
    : restaurant.ratingGroups.filter((group) => group.list.id !== listId);

  return replaceRestaurant(state, { ...restaurant, memberships, ratingGroups });
}

function temporaryCheckInId(mutationId: string) {
  let hash = 0;
  for (const character of mutationId) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return -(Math.abs(hash) + 1);
}

function sortedCheckIns(checkIns: CheckIn[]) {
  return [...checkIns].sort((left, right) => right.visitedAt.localeCompare(left.visitedAt));
}

function createCheckIn(state: AppState, payload: SerializedFormData, mutationId: string) {
  const restaurantId = positiveId(payload, "restaurantId");
  const restaurant = state.allRestaurants.find((entry) => entry.id === restaurantId);
  if (!restaurant) throw new Error("Restaurant not found in the offline cache.");
  const checkIn: CheckIn = {
    id: temporaryCheckInId(mutationId),
    authorName: state.user.name,
    visitedAt: value(payload, "visitedAt") || new Date().toISOString().slice(0, 16),
    notes: null,
  };
  const checkIns = sortedCheckIns([checkIn, ...restaurant.checkIns]);
  return replaceRestaurant(state, {
    ...restaurant,
    checkIns,
    latestCheckIn: checkIns[0] ?? null,
    checkInCount: checkIns.length,
  });
}

function updateCheckIn(state: AppState, payload: SerializedFormData) {
  const checkInId = Number(value(payload, "checkInId"));
  const visitedAt = value(payload, "visitedAt");
  if (!Number.isInteger(checkInId) || !visitedAt) throw new Error("Invalid Check-in.");
  const restaurant = state.allRestaurants.find((entry) => entry.checkIns.some((checkIn) => checkIn.id === checkInId));
  if (!restaurant) throw new Error("Check-in not found in the offline cache.");
  const checkIns = sortedCheckIns(restaurant.checkIns.map((checkIn) =>
    checkIn.id === checkInId ? { ...checkIn, visitedAt } : checkIn,
  ));
  return replaceRestaurant(state, { ...restaurant, checkIns, latestCheckIn: checkIns[0] ?? null });
}

function deleteCheckIn(state: AppState, payload: SerializedFormData) {
  const checkInId = Number(value(payload, "checkInId"));
  if (!Number.isInteger(checkInId)) throw new Error("Invalid Check-in.");
  const restaurant = state.allRestaurants.find((entry) => entry.checkIns.some((checkIn) => checkIn.id === checkInId));
  if (!restaurant) throw new Error("Check-in not found in the offline cache.");
  const checkIns = restaurant.checkIns.filter((checkIn) => checkIn.id !== checkInId);
  return replaceRestaurant(state, {
    ...restaurant,
    checkIns,
    latestCheckIn: checkIns[0] ?? null,
    checkInCount: checkIns.length,
  });
}

export function applyOfflineMutation(
  state: AppState,
  action: string,
  payload: SerializedFormData,
  mutationId: string,
): AppState {
  if (!supportsOfflineMutation(action)) throw new UnsupportedOfflineMutationError();
  if (action === "updateEntryAndRatings") return updateNotesAndRatings(state, payload);
  if (action === "updateRestaurantMetadata") return updateMetadata(state, payload);
  if (action === "attachRestaurantToList") return updateMembership(state, payload, true);
  if (action === "removeRestaurantFromList") return updateMembership(state, payload, false);
  if (action === "createCheckIn") return createCheckIn(state, payload, mutationId);
  if (action === "updateCheckIn") return updateCheckIn(state, payload);
  return deleteCheckIn(state, payload);
}
