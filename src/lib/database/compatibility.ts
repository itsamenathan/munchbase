import type Database from "better-sqlite3";
import { logger } from "@/lib/logger";

const MIGRATION_KEY = "legacy-rating-definitions-v1";

type Column = { name: string; notnull: number };

function columns(database: Database.Database) {
  return database.prepare("PRAGMA table_info(rating_definitions)").all() as Column[];
}

function foreignKeyViolations(database: Database.Database) {
  return database.pragma("foreign_key_check") as unknown[];
}

export function runLegacyCompatibility(database: Database.Database) {
  database.exec(`CREATE TABLE IF NOT EXISTS munchbase_system_migrations (
    key TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  if (database.prepare("SELECT 1 FROM munchbase_system_migrations WHERE key = ?").get(MIGRATION_KEY)) {
    logger.info("Database compatibility migration already applied", { migration: MIGRATION_KEY });
    return false;
  }
  const table = database.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'rating_definitions'").get();
  // A fresh database is reconciled after Drizzle creates its baseline schema.
  if (!table) return false;

  const initialColumns = columns(database);
  const hasScope = initialColumns.some((column) => column.name === "scope");
  const hasSortOrder = initialColumns.some((column) => column.name === "sort_order");
  const listIdRequired = initialColumns.find((column) => column.name === "list_id")?.notnull === 1;

  const migrate = database.transaction(() => {
    if (!hasScope) {
      database.exec("ALTER TABLE rating_definitions ADD COLUMN scope text DEFAULT 'list' NOT NULL");
    }
    if (listIdRequired) rebuildRatingDefinitions(database, hasSortOrder);
    if (!hasSortOrder && !listIdRequired) {
      database.exec("ALTER TABLE rating_definitions ADD COLUMN sort_order integer NOT NULL DEFAULT 0");
      database.exec("UPDATE rating_definitions SET sort_order = id");
    }
    database.exec("CREATE UNIQUE INDEX IF NOT EXISTS rating_definitions_list_id_preset_key_unique ON rating_definitions (list_id, preset_key)");
    database.exec("CREATE UNIQUE INDEX IF NOT EXISTS rating_definitions_global_preset_key_unique ON rating_definitions (scope, preset_key)");
    const violations = foreignKeyViolations(database);
    if (violations.length > 0) throw new Error(`Legacy database reconciliation found ${violations.length} foreign key violation(s).`);
    database.prepare("INSERT INTO munchbase_system_migrations (key) VALUES (?)").run(MIGRATION_KEY);
  });

  // SQLite cannot change foreign-key enforcement inside a transaction.
  database.pragma("foreign_keys = OFF");
  try {
    migrate();
  } finally {
    database.pragma("foreign_keys = ON");
  }
  logger.info("Database compatibility migration applied", { migration: MIGRATION_KEY });
  return true;
}

function rebuildRatingDefinitions(database: Database.Database, hasSortOrder: boolean) {
  database.exec("DROP INDEX IF EXISTS rating_definitions_list_id_preset_key_unique");
  database.exec("DROP INDEX IF EXISTS rating_definitions_global_preset_key_unique");
  database.exec(`CREATE TABLE rating_definitions_compat_new (
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
    sort_order integer DEFAULT 0 NOT NULL,
    created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE cascade
  )`);
  const sortExpression = hasSortOrder ? "sort_order" : "id";
  database.exec(`INSERT INTO rating_definitions_compat_new
    (id, list_id, scope, preset_key, name, type, icon, options_json, min, max, active, sort_order, created_at)
    SELECT id, list_id, COALESCE(scope, 'list'), preset_key, name, type, icon, options_json, min, max, active, ${sortExpression}, created_at
    FROM rating_definitions`);
  database.exec("DROP TABLE rating_definitions");
  database.exec("ALTER TABLE rating_definitions_compat_new RENAME TO rating_definitions");
}
