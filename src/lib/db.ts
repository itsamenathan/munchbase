import { initializeDatabase } from "./database/startup";
import { openDatabase } from "./database/connection";
import type { User } from "./types";

export function getDb() {
  initializeDatabase();
  return openDatabase().sqlite;
}

export function getOrm() {
  initializeDatabase();
  return openDatabase().orm;
}

export function userCount() {
  return getDb().prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number };
}

export function getUserByEmail(email: string) {
  return getDb()
    .prepare("SELECT id, name, email, role, active, password_hash AS passwordHash FROM users WHERE email = ?")
    .get(email) as (User & { passwordHash: string }) | undefined;
}

export function firstUser() {
  return getDb().prepare("SELECT id, name, email, role, active FROM users ORDER BY id LIMIT 1").get() as
    | User
    | undefined;
}

export function getUserBySession(sessionId: string) {
  return getDb()
    .prepare(
      `SELECT users.id, users.name, users.email, users.role, users.active
       FROM sessions JOIN users ON users.id = sessions.user_id
       WHERE sessions.id = ? AND sessions.expires_at > CURRENT_TIMESTAMP AND users.active = 1`,
    )
    .get(sessionId) as User | undefined;
}
