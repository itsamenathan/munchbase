import { CSRF_COOKIE, CSRF_FIELD } from "./csrf-constants";

export function readCsrfToken() {
  if (typeof document === "undefined") return "";
  const cookies = document.cookie.split(";").map((part) => part.trim());
  const prefix = `${CSRF_COOKIE}=`;
  const raw = cookies.find((part) => part.startsWith(prefix));
  return raw ? decodeURIComponent(raw.slice(prefix.length)) : "";
}

export function appendCsrfToken(formData: FormData) {
  const token = readCsrfToken();
  if (token) formData.set(CSRF_FIELD, token);
}
