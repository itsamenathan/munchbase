// Shared by the edit form (to send only what changed) and the server (to detect
// that someone else changed a field first). Each posted `note:<id>` and
// `rating:<id>` field travels with a `base:<same key>` field holding the value it
// had when editing began.
import { parseNotes } from "@/lib/note-sections";
import { parseRatingValues, serializeRatingValues } from "@/lib/ratings";
import type { RatingDefinition } from "@/lib/types";

export const BASE_PREFIX = "base:";

/**
 * A field whose stored value no longer matches what the editor started from.
 * `label` and `display` are ready to show, since the offline sync banner has no
 * rating definitions or note sections to look them up in.
 */
export type EditConflict = { key: string; current: string; label: string; display: string };

export type EditBase = {
  notes: Record<number, string>;
  ratings: Record<number, string>;
};

export function snapshotEditBase(source: {
  notes: string | null;
  ratings: Array<{ definitionId: number; value: string }>;
}): EditBase {
  const notes: Record<number, string> = {};
  for (const [id, value] of Object.entries(parseNotes(source.notes))) notes[Number(id)] = value.trim();
  const ratings: Record<number, string> = {};
  for (const rating of source.ratings) ratings[rating.definitionId] = rating.value;
  return { notes, ratings };
}

/** The rating value a form would store for `submitted` entries, in a form safe to compare. */
export function normalizeSubmittedRating(
  definition: Pick<RatingDefinition, "type" | "options">,
  submitted: string[],
) {
  if (definition.type === "multi") {
    const selected = new Set(submitted.filter(Boolean));
    return serializeRatingValues(definition.options.filter((option) => selected.has(option)));
  }
  return submitted[submitted.length - 1] ?? "";
}

/** Whether two stored values for one rating mean the same thing. */
export function sameRatingValue(definition: Pick<RatingDefinition, "type" | "options">, a: string, b: string) {
  if (definition.type !== "multi") return a === b;
  const normalize = (value: string) =>
    serializeRatingValues(definition.options.filter((option) => new Set(parseRatingValues(definition, value)).has(option)));
  return normalize(a) === normalize(b);
}

export function sameNoteValue(a: string, b: string) {
  return a.trim() === b.trim();
}

const PLAIN_RATING: Pick<RatingDefinition, "type" | "options"> = { type: "choice", options: [] };

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function fieldKeys(formData: FormData, prefix: "note:" | "rating:") {
  return [...new Set([...formData.keys()].filter((key) => key.startsWith(prefix)))];
}

/**
 * Drops every field that still has the value it started with, along with its
 * base entry, so a save only carries what the person actually changed. Fields
 * with no base entry are left alone. Returns the same FormData.
 */
export function pruneUnchangedFields(formData: FormData, definitions: RatingDefinition[]) {
  for (const key of fieldKeys(formData, "note:")) {
    const baseKey = BASE_PREFIX + key;
    if (!formData.has(baseKey)) continue;
    if (sameNoteValue(formString(formData, key), formString(formData, baseKey))) {
      formData.delete(key);
      formData.delete(baseKey);
    }
  }
  for (const key of fieldKeys(formData, "rating:")) {
    const baseKey = BASE_PREFIX + key;
    if (!formData.has(baseKey)) continue;
    // Without the definition the value can only be compared as plain text, which is still safe for choices and scales.
    const definition = definitions.find((candidate) => candidate.id === Number(key.slice("rating:".length))) ?? PLAIN_RATING;
    const submitted = normalizeSubmittedRating(
      definition,
      formData.getAll(key).filter((entry): entry is string => typeof entry === "string"),
    );
    if (sameRatingValue(definition, submitted, formString(formData, baseKey))) {
      formData.delete(key);
      formData.delete(baseKey);
    }
  }
  return formData;
}

/** True when a pruned save still carries any note or rating to write. */
export function hasEntryChanges(formData: FormData) {
  return fieldKeys(formData, "note:").length > 0 || fieldKeys(formData, "rating:").length > 0;
}

/** The rating values currently selected in the form, keyed by definition id. */
export function ratingValuesFromForm(formData: FormData, definitions: RatingDefinition[]) {
  const values: Record<number, string> = {};
  for (const key of fieldKeys(formData, "rating:")) {
    const definition = definitions.find((candidate) => candidate.id === Number(key.slice("rating:".length))) ?? PLAIN_RATING;
    values[Number(key.slice("rating:".length))] = normalizeSubmittedRating(
      definition,
      formData.getAll(key).filter((entry): entry is string => typeof entry === "string"),
    );
  }
  return values;
}

/** Plain-text label for a conflicting value, for the conflict message. */
export function describeConflictValue(definition: RatingDefinition | null, current: string) {
  if (!current.trim()) return "empty";
  if (!definition) return current.trim();
  if (definition.type === "boolean") return current === "true" ? "Yes" : "No";
  return parseRatingValues(definition, current).join(", ") || "empty";
}
