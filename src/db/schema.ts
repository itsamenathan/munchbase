import { relations, sql } from "drizzle-orm";
import { integer, real, sqliteTable, text, unique, primaryKey } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "user"] }).notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const appSettings = sqliteTable("app_settings", {
  id: integer("id").primaryKey().default(1),
  selfSignupEnabled: integer("self_signup_enabled", { mode: "boolean" }).notNull().default(false),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});


export const lists = sqliteTable("lists", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  ownerId: integer("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const listMembers = sqliteTable(
  "list_members",
  {
    listId: integer("list_id").notNull().references(() => lists.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    access: text("access", { enum: ["read", "write", "owner"] }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.listId, table.userId] })],
);

export const places = sqliteTable(
  "places",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    osmType: text("osm_type"),
    osmId: text("osm_id"),
    name: text("name").notNull(),
    address: text("address"),
    lat: real("lat"),
    lon: real("lon"),
    rawJson: text("raw_json"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [unique().on(table.osmType, table.osmId)],
);

export const restaurantEntries = sqliteTable(
  "restaurant_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    listId: integer("list_id").notNull().references(() => lists.id, { onDelete: "cascade" }),
    placeId: integer("place_id").notNull().references(() => places.id, { onDelete: "cascade" }),
    standingNotes: text("standing_notes"),
    favoriteItems: text("favorite_items"),
    orderingTips: text("ordering_tips"),
    googleMapsUrl: text("google_maps_url"),
    yelpUrl: text("yelp_url"),
    createdBy: integer("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [unique().on(table.listId, table.placeId)],
);

export const ratingDefinitions = sqliteTable(
  "rating_definitions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    listId: integer("list_id").notNull().references(() => lists.id, { onDelete: "cascade" }),
    presetKey: text("preset_key"),
    name: text("name").notNull(),
    type: text("type", { enum: ["choice", "scale", "boolean"] }).notNull(),
    icon: text("icon").notNull().default("tag"),
    optionsJson: text("options_json").notNull().default("[]"),
    min: integer("min"),
    max: integer("max"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [unique().on(table.listId, table.presetKey)],
);

export const ratingValues = sqliteTable(
  "rating_values",
  {
    entryId: integer("entry_id").notNull().references(() => restaurantEntries.id, { onDelete: "cascade" }),
    definitionId: integer("definition_id").notNull().references(() => ratingDefinitions.id, { onDelete: "cascade" }),
    value: text("value").notNull(),
  },
  (table) => [primaryKey({ columns: [table.entryId, table.definitionId] })],
);

export const checkins = sqliteTable("checkins", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  entryId: integer("entry_id").notNull().references(() => restaurantEntries.id, { onDelete: "cascade" }),
  authorId: integer("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  visitedAt: text("visited_at").notNull(),
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(listMembers),
  checkins: many(checkins),
}));
