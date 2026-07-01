import { NextResponse } from "next/server";

// A relative Location header lets the browser resolve against whatever origin it
// actually used to reach us, instead of trusting client-supplied Host/X-Forwarded-Proto
// headers (which break behind proxies/tunnels that rewrite them).
export function redirectTo(path: string) {
  return new NextResponse(null, { status: 303, headers: { Location: path } });
}
