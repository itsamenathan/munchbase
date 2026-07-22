import type Database from "better-sqlite3";
import { NOTE_SECTION_PRESETS } from "@/lib/note-sections";
import { RATING_PRESETS } from "@/lib/ratings";
import { logger } from "@/lib/logger";

export function syncApplicationPresets(database: Database.Database) {
  for (const preset of RATING_PRESETS) {
    database.prepare(`INSERT INTO rating_definitions
      (list_id, scope, preset_key, name, type, icon, options_json, min, max, active)
      VALUES (NULL, 'global', ?, ?, ?, ?, ?, ?, ?, 1)
      ON CONFLICT(scope, preset_key) DO UPDATE SET
        name = excluded.name, type = excluded.type, icon = excluded.icon,
        options_json = excluded.options_json, min = excluded.min, max = excluded.max`)
      .run(preset.key, preset.name, preset.type, preset.icon, JSON.stringify(preset.options), preset.min, preset.max);
  }
  NOTE_SECTION_PRESETS.forEach((preset, index) => {
    database.prepare(`INSERT INTO note_sections (preset_key, name, sort_order) VALUES (?, ?, ?)
      ON CONFLICT(preset_key) DO UPDATE SET sort_order = excluded.sort_order`)
      .run(preset.key, preset.name, index);
  });
  logger.info("Application presets synchronized", {
    ratingPresets: RATING_PRESETS.length,
    noteSectionPresets: NOTE_SECTION_PRESETS.length,
  });
}
