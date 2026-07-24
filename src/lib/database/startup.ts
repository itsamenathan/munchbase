import "@/lib/env";
import { logger } from "@/lib/logger";
import { openDatabase } from "./connection";
import { runLegacyCompatibility } from "./compatibility";
import { migrateDatabase } from "./migrations";
import { runDatabaseMaintenance, startDatabaseMaintenanceScheduler } from "./maintenance";
import { syncApplicationPresets } from "./presets";

export type DatabaseStatus = "uninitialized" | "initializing" | "ready" | "failed";
type StartupState = { status: DatabaseStatus; error?: unknown };
const globalState = globalThis as typeof globalThis & { __munchbaseStartup?: StartupState };

function state() {
  return (globalState.__munchbaseStartup ??= { status: "uninitialized" });
}

export function getDatabaseStatus() {
  return state().status;
}

export function initializeDatabase() {
  const current = state();
  if (current.status === "ready") return;
  if (current.status === "initializing") throw new Error("Database initialization is already in progress.");
  if (current.status === "failed") throw current.error;
  current.status = "initializing";
  try {
    const { sqlite } = openDatabase();
    runLegacyCompatibility(sqlite);
    migrateDatabase();
    // Fresh databases have no rating table until the baseline migration runs.
    runLegacyCompatibility(sqlite);
    syncApplicationPresets(sqlite);
    runDatabaseMaintenance(sqlite);
    current.status = "ready";
    startDatabaseMaintenanceScheduler();
    logger.info("Database initialization completed");
  } catch (error) {
    current.status = "failed";
    current.error = error;
    logger.error("Database initialization failed", { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

export function resetDatabaseStartupForTests() {
  delete globalState.__munchbaseStartup;
}
