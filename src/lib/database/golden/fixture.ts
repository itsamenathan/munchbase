import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resetDatabaseConnectionForTests } from "../connection";
import { resetDatabaseMaintenanceSchedulerForTests } from "../maintenance";
import { initializeDatabase, resetDatabaseStartupForTests } from "../startup";

const createdDirectories: string[] = [];

/**
 * Builds a throwaway database holding the same corpus a developer gets from
 * `npm run db:seed:test`, so the golden master is pinned to real data rather
 * than to fixtures invented for the test.
 *
 * The seed runs as a subprocess under whichever runtime is executing the suite,
 * which makes the seed script itself part of what the golden master covers.
 */
export function createSeededDatabase() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "munchbase-golden-"));
  createdDirectories.push(directory);
  const databasePath = path.join(directory, "munchbase.db");

  resetDatabaseMaintenanceSchedulerForTests();
  resetDatabaseStartupForTests();
  resetDatabaseConnectionForTests();
  process.env.DATABASE_PATH = databasePath;

  // Migrate first: the seed script refuses to run against an unmigrated file.
  initializeDatabase();
  // Release our handle so the subprocess writes without contending for the lock.
  resetDatabaseConnectionForTests();
  resetDatabaseStartupForTests();

  execFileSync(process.execPath, [path.resolve(process.cwd(), "scripts/seed-test-data.mjs")], {
    env: { ...process.env, DATABASE_PATH: databasePath },
    stdio: "ignore",
  });

  return databasePath;
}

export function cleanupSeededDatabases() {
  resetDatabaseMaintenanceSchedulerForTests();
  resetDatabaseStartupForTests();
  resetDatabaseConnectionForTests();
  delete process.env.DATABASE_PATH;
  for (const directory of createdDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
