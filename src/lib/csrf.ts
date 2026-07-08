import { cookies } from "next/headers";
import { CSRF_COOKIE, CSRF_FIELD } from "./csrf-constants";

export class CsrfError extends Error {
  constructor() {
    super("Security check failed. Refresh and try again.");
  }
}

export async function getCsrfTokenFromCookies() {
  const cookieStore = await cookies();
  return cookieStore.get(CSRF_COOKIE)?.value ?? "";
}

export async function assertCsrfToken(formData: FormData) {
  const expected = await getCsrfTokenFromCookies();
  const actual = formData.get(CSRF_FIELD);
  if (!expected || typeof actual !== "string" || actual !== expected) {
    throw new CsrfError();
  }
}
