import { z } from "zod";
import type { RatingDefinition, RatingPresetKey, RatingType } from "./types";

export type RatingPreset = {
  key: RatingPresetKey;
  name: string;
  type: RatingType;
  icon: string;
  options: string[];
  min: number | null;
  max: number | null;
};

export const RATING_PRESETS: RatingPreset[] = [
  { key: "go_back", name: "Go Back", type: "boolean", icon: "check-circle", options: [], min: null, max: null },
  { key: "price", name: "Price", type: "choice", icon: "dollar-sign", options: ["$", "$$", "$$$", "$$$$"], min: null, max: null },
  { key: "stars", name: "Stars", type: "scale", icon: "star", options: [], min: 1, max: 5 },
];

export const RATING_ICONS = [
  "star",
  "heart",
  "dollar-sign",
  "thumbs-up",
  "thumbs-down",
  "check-circle",
  "x-circle",
  "flame",
  "zap",
  "award",
  "crown",
  "gem",
  "smile",
  "meh",
  "frown",
  "coffee",
  "utensils",
  "wine",
  "beer",
  "moon",
  "sun",
  "cloud",
  "tag",
  "undo-2",
] as const;

export function presetByKey(key: string) {
  return RATING_PRESETS.find((preset) => preset.key === key);
}

export const ratingDefinitionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("choice"),
    name: z.string().trim().min(1),
    icon: z.string().default("tag"),
    options: z.array(z.string().trim().min(1)).min(2),
    min: z.null().optional(),
    max: z.null().optional(),
  }),
  z.object({
    type: z.literal("scale"),
    name: z.string().trim().min(1),
    icon: z.string().default("star"),
    options: z.array(z.string()).default([]),
    min: z.coerce.number().int(),
    max: z.coerce.number().int(),
  }),
  z.object({
    type: z.literal("boolean"),
    name: z.string().trim().min(1),
    icon: z.string().default("check-circle"),
    options: z.array(z.string()).default([]),
    min: z.null().optional(),
    max: z.null().optional(),
  }),
]);

export function normalizeRatingDefinition(input: {
  name: string;
  type: RatingType;
  icon?: string;
  options?: string;
  min?: string | number | null;
  max?: string | number | null;
}) {
  const options =
    input.type === "choice"
      ? (input.options ?? "")
          .split(",")
          .map((option) => option.trim())
          .filter(Boolean)
      : [];
  const parsed = ratingDefinitionSchema.parse({
    name: input.name,
    type: input.type,
    icon: input.icon || undefined,
    options,
    min: input.type === "scale" ? input.min || 1 : null,
    max: input.type === "scale" ? input.max || 5 : null,
  });
  if (parsed.type === "scale" && parsed.min >= parsed.max) {
    throw new Error("Scale minimum must be less than maximum.");
  }
  return parsed;
}

export function validateRatingValue(definition: RatingDefinition, value: string) {
  if (value === "") return "";
  if (definition.type === "boolean") {
    if (value !== "true" && value !== "false") throw new Error(`Invalid value for ${definition.name}`);
    return value;
  }
  if (definition.type === "choice") {
    if (!definition.options.includes(value)) throw new Error(`Invalid value for ${definition.name}`);
    return value;
  }
  const numeric = Number(value);
  if (!Number.isInteger(numeric)) throw new Error(`${definition.name} must be a whole number.`);
  if (definition.min !== null && numeric < definition.min) throw new Error(`${definition.name} is too low.`);
  if (definition.max !== null && numeric > definition.max) throw new Error(`${definition.name} is too high.`);
  return String(numeric);
}
