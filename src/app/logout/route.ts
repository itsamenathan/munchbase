import { NextResponse, type NextRequest } from "next/server";
import { destroySession } from "@/lib/auth";

function redirectTo(request: NextRequest, path: string) {
  const proto = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  const host = request.headers.get("host") ?? new URL(request.url).host;
  return NextResponse.redirect(`${proto}://${host}${path}`);
}

export async function POST(request: NextRequest) {
  await destroySession();
  return redirectTo(request, "/explore");
}
