import type { NextRequest } from "next/server";
import { createSession, verifyPassword } from "@/lib/auth";
import { getUserByEmail } from "@/lib/db";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { redirectTo } from "@/lib/redirect";
import { assertCsrfToken } from "@/lib/csrf";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function clientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? request.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  try {
    checkRateLimit(`login:${ip}`, 10, 15 * 60 * 1000);
  } catch {
    return redirectTo("/explore?loginError=rate_limited");
  }

  const formData = await request.formData();
  try {
    await assertCsrfToken(formData);
  } catch {
    logger.warn("Login CSRF validation failed", { ip });
    return redirectTo("/explore?loginError=csrf");
  }

  const email = text(formData, "email").toLowerCase();
  const password = text(formData, "password");
  const user = getUserByEmail(email);

  if (!user || !user.active || !(await verifyPassword(password, user.passwordHash))) {
    logger.warn("Failed login attempt", { email, ip });
    return redirectTo("/explore?loginError=invalid");
  }

  logger.info("User logged in", { userId: user.id, email, ip });
  await createSession(user.id);
  return redirectTo("/explore");
}
