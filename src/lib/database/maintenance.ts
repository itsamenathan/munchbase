import type Database from "better-sqlite3";
import { logger } from "@/lib/logger";
import { openDatabase } from "./connection";

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const globalState = globalThis as typeof globalThis & { __munchbaseMaintenanceTimer?: ReturnType<typeof setInterval> };

export function runDatabaseMaintenance(database: Database.Database = openDatabase().sqlite) {
  const started = performance.now();
  const expiredSessions = database.prepare("DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP").run().changes;
  database.pragma("optimize");
  const result = { expiredSessions, durationMs: Math.round(performance.now() - started) };
  logger.info("Database maintenance completed", result);
  return result;
}

export function startDatabaseMaintenanceScheduler() {
  if (globalState.__munchbaseMaintenanceTimer) return;
  const timer = setInterval(() => {
    try {
      runDatabaseMaintenance();
    } catch (error) {
      logger.error("Database maintenance failed", { error: error instanceof Error ? error.message : String(error) });
    }
  }, SIX_HOURS_MS);
  timer.unref?.();
  globalState.__munchbaseMaintenanceTimer = timer;
}

export function resetDatabaseMaintenanceSchedulerForTests() {
  if (globalState.__munchbaseMaintenanceTimer) clearInterval(globalState.__munchbaseMaintenanceTimer);
  delete globalState.__munchbaseMaintenanceTimer;
}
