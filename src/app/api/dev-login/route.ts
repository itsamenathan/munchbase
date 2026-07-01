import { NextResponse } from "next/server";
import { createSession, hashPassword } from "@/lib/auth";
import { env } from "@/lib/env";
import { firstUser, getDb } from "@/lib/db";
import { redirectTo } from "@/lib/redirect";

export async function GET() {
  if (env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }

  let userId: number;
  const existing = firstUser();
  if (existing) {
    userId = existing.id;
  } else {
    const email = env.DEV_LOGIN_EMAIL ?? "dev@localhost";
    const password = env.DEV_LOGIN_PASSWORD ?? "devpassword123";
    const passwordHash = await hashPassword(password);
    const db = getDb();
    const result = db
      .prepare("INSERT INTO users (name, email, password_hash, role, active) VALUES (?, ?, ?, 'admin', 1)")
      .run("Dev", email, passwordHash);
    userId = Number(result.lastInsertRowid);
    db.prepare("INSERT INTO lists (name, description, created_by) VALUES ('Places to Eat', 'Default shared list', ?)").run(
      userId,
    );
    db.prepare("INSERT OR IGNORE INTO app_settings (id, self_signup_enabled) VALUES (1, 0)").run();
  }

  await createSession(userId);
  return redirectTo("/explore");
}
