import { type NextRequest, NextResponse } from "next/server";
import { CSRF_COOKIE } from "@/lib/csrf-constants";

// Security headers are set in next.config.ts. Each request the proxy handles is traced by Next.js
// as a separate root span, apart from the request's own trace, so the matcher below limits it to
// the two cases that need code: issuing the CSRF cookie and redirecting stale Server Action POSTs.

function redirectTo(request: NextRequest, path: string) {
  const proto = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  const host = request.headers.get("host") ?? new URL(request.url).host;
  return NextResponse.redirect(`${proto}://${host}${path}`);
}

export function proxy(request: NextRequest) {
  // Intercept stale server-action POSTs from old cached JS bundles. Without
  // this, Next.js logs "Failed to find Server Action" for every request from a
  // client whose service worker is still serving pre-refactor JS.
  if (request.method === "POST" && request.headers.has("Next-Action")) {
    const referer = request.headers.get("referer");
    const dest = referer ? new URL(referer).pathname : "/";
    return redirectTo(request, dest);
  }

  const response = NextResponse.next();
  if (!request.cookies.get(CSRF_COOKIE)?.value) {
    response.cookies.set(CSRF_COOKIE, crypto.randomUUID(), {
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  }
  return response;
}

// Next.js reads this config statically, so it must be literals: the cookie name repeats CSRF_COOKIE.
export const config = {
  matcher: [
    { source: "/((?!_next/static|_next/image|favicon|icons|manifest\\.json|sw\\.js).*)", missing: [{ type: "cookie", key: "munchbase_csrf" }] },
    { source: "/((?!_next/static|_next/image|favicon|icons|manifest\\.json|sw\\.js).*)", has: [{ type: "header", key: "next-action" }] },
  ],
};
