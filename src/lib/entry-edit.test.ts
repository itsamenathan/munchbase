import { describe, expect, it } from "vitest";
import {
  hasEntryChanges,
  normalizeSubmittedRating,
  pruneUnchangedFields,
  ratingValuesFromForm,
  sameRatingValue,
  snapshotEditBase,
} from "./entry-edit";
import type { RatingDefinition } from "./types";

function definition(overrides: Partial<RatingDefinition>): RatingDefinition {
  return {
    id: 1,
    listId: null,
    scope: "global",
    presetKey: null,
    name: "Field",
    type: "choice",
    icon: "tag",
    options: ["a", "b", "c"],
    min: null,
    max: null,
    active: true,
    sortOrder: 0,
    ...overrides,
  } as RatingDefinition;
}

function form(entries: Array<[string, string]>) {
  const formData = new FormData();
  for (const [key, value] of entries) formData.append(key, value);
  return formData;
}

describe("snapshotEditBase", () => {
  it("reads note sections and rating values", () => {
    const base = snapshotEditBase({
      notes: "<!--section:1-->\nHello\n\n<!--section:2-->\nWorld",
      ratings: [{ definitionId: 7, value: "4" }],
    });
    expect(base.notes).toEqual({ 1: "Hello", 2: "World" });
    expect(base.ratings).toEqual({ 7: "4" });
  });
});

describe("pruneUnchangedFields", () => {
  it("drops unchanged notes and keeps changed ones with their base", () => {
    const data = form([
      ["note:1", "same"], ["base:note:1", "same"],
      ["note:2", "edited"], ["base:note:2", "original"],
    ]);
    pruneUnchangedFields(data, []);
    expect(data.has("note:1")).toBe(false);
    expect(data.has("base:note:1")).toBe(false);
    expect(data.get("note:2")).toBe("edited");
    expect(data.get("base:note:2")).toBe("original");
  });

  it("ignores whitespace-only differences in notes", () => {
    const data = form([["note:1", "same  "], ["base:note:1", "same"]]);
    pruneUnchangedFields(data, []);
    expect(hasEntryChanges(data)).toBe(false);
  });

  it("treats a cleared single rating as a change from its base", () => {
    const data = form([["rating:1", ""], ["base:rating:1", "a"]]);
    pruneUnchangedFields(data, [definition({ id: 1 })]);
    expect(data.get("rating:1")).toBe("");
    expect(data.get("base:rating:1")).toBe("a");
  });

  it("uses the last entry for single ratings", () => {
    const data = form([["rating:1", ""], ["rating:1", "b"], ["base:rating:1", "b"]]);
    pruneUnchangedFields(data, [definition({ id: 1 })]);
    expect(data.has("rating:1")).toBe(false);
  });

  it("compares multi ratings regardless of tick order", () => {
    const multi = definition({ id: 3, type: "multi" });
    const data = form([
      ["rating:3", ""], ["rating:3", "c"], ["rating:3", "a"],
      ["base:rating:3", JSON.stringify(["a", "c"])],
    ]);
    pruneUnchangedFields(data, [multi]);
    expect(data.has("rating:3")).toBe(false);
  });

  it("keeps a multi rating that gained a selection", () => {
    const multi = definition({ id: 3, type: "multi" });
    const data = form([["rating:3", ""], ["rating:3", "a"], ["rating:3", "b"], ["base:rating:3", JSON.stringify(["a"])]]);
    pruneUnchangedFields(data, [multi]);
    expect(data.has("rating:3")).toBe(true);
  });

  it("still prunes a rating whose definition is unknown, comparing plain values", () => {
    const data = form([["rating:9", "x"], ["base:rating:9", "x"], ["rating:10", "y"], ["base:rating:10", "z"]]);
    pruneUnchangedFields(data, []);
    expect(data.has("rating:9")).toBe(false);
    expect(data.get("rating:10")).toBe("y");
  });

  it("leaves fields without a base entry alone", () => {
    const data = form([["note:1", "x"], ["rating:1", "a"]]);
    pruneUnchangedFields(data, [definition({ id: 1 })]);
    expect(hasEntryChanges(data)).toBe(true);
  });
});

describe("rating helpers", () => {
  it("normalizes multi selections into option order", () => {
    const multi = definition({ type: "multi" });
    expect(normalizeSubmittedRating(multi, ["", "c", "a"])).toBe(JSON.stringify(["a", "c"]));
    expect(normalizeSubmittedRating(multi, [""])).toBe("");
  });

  it("compares stored multi values by content", () => {
    const multi = definition({ type: "multi" });
    expect(sameRatingValue(multi, JSON.stringify(["c", "a"]), JSON.stringify(["a", "c"]))).toBe(true);
    expect(sameRatingValue(multi, JSON.stringify(["a"]), "")).toBe(false);
  });

  it("reads current rating values from a form", () => {
    const data = form([["rating:1", ""], ["rating:1", "b"], ["note:5", "x"]]);
    expect(ratingValuesFromForm(data, [definition({ id: 1 })])).toEqual({ 1: "b" });
  });
});
