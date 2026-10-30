import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * The notes and ratings as stored right now. The edit form loads this when it
 * opens so a person starts from what is saved, not from a screen that may have
 * gone stale while the app sat in the background.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const restaurantId = Number((await params).id);
  if (!Number.isInteger(restaurantId) || restaurantId <= 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const db = getDb();
  const restaurant = db.prepare("SELECT notes FROM restaurants WHERE id = ?").get(restaurantId) as { notes: string | null } | undefined;
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ratings = db
    .prepare("SELECT definition_id AS definitionId, value FROM rating_values WHERE restaurant_id = ?")
    .all(restaurantId) as Array<{ definitionId: number; value: string }>;
  return NextResponse.json({ notes: restaurant.notes, ratings }, { headers: { "Cache-Control": "no-store" } });
}
