import { type NextRequest, NextResponse } from "next/server";

const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(self)",
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

function redirectTo(request: NextRequest, path: string) {
  const proto = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  const host = request.headers.get("host") ?? new URL(request.url).host;
  return NextResponse.redirect(`${proto}://${host}${path}`);
}

export function middleware(request: NextRequest) {
  // Intercept stale server-action POSTs from old cached JS bundles. Without
  // this, Next.js logs "Failed to find Server Action" for every request from a
  // client whose service worker is still serving pre-refactor JS.
  if (request.method === "POST" && request.headers.has("Next-Action")) {
    const referer = request.headers.get("referer");
    const dest = referer ? new URL(referer).pathname : "/";
    return redirectTo(request, dest);
  }

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
