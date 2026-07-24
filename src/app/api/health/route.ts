import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getDatabaseStatus } from "@/lib/database/startup";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (getDatabaseStatus() !== "ready") throw new Error("Database is not ready.");
    getDb().prepare("SELECT 1").get();
    return NextResponse.json({ status: "ok", database: "ready" });
  } catch (err) {
    logger.error("Database readiness check failed", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json(
      { status: "error", database: "unavailable" },
      { status: 503 },
    );
  }
}
