import Database from "better-sqlite3";
import { databasePath } from "../src/lib/database/connection";

const command = process.argv[2];

if (command === "migrate") {
  const { initializeDatabase } = await import("../src/lib/database/startup");
  initializeDatabase();
} else if (command === "integrity") {
  const target = databasePath();
  const database = new Database(target, { readonly: true, fileMustExist: true });
  try {
    const quickCheck = database.pragma("quick_check") as Array<{ quick_check: string }>;
    const foreignKeys = database.pragma("foreign_key_check") as unknown[];
    if (quickCheck.length !== 1 || quickCheck[0]?.quick_check !== "ok" || foreignKeys.length > 0) {
      console.error(JSON.stringify({ status: "error", quickCheck, foreignKeyViolations: foreignKeys.length }));
      process.exitCode = 1;
    } else {
      console.info(JSON.stringify({ status: "ok", databasePath: target }));
    }
  } finally {
    database.close();
  }
} else {
  console.error("Usage: tsx scripts/database-cli.ts <migrate|integrity>");
  process.exitCode = 2;
}
