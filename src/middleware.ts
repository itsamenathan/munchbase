import { type NextRequest, NextResponse } from "next/server";

const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

const CSP = [
  "default-src 'self'",
  "img-src 'self' data: blob: https:",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self' https://nominatim.openstreetmap.org",
  "font-src 'self'",
  "frame-ancestors 'none'",
].join("; ");

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  if (process.env.NODE_ENV === "production") {
    response.headers.set("Content-Security-Policy", CSP);
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon|icons|manifest\\.json|sw\\.js).*)"],
};
