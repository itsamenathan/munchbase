import fs from "node:fs/promises";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { mediaTypeForStorageKey, resolvePhotoStoragePath } from "@/lib/restaurant-photos";

export async function GET(_: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const user = await currentUser();
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { key } = await params;
  const storageKey = key.join("/");

  try {
    const filePath = resolvePhotoStoragePath(storageKey);
    const file = await fs.readFile(filePath);
    return new NextResponse(file, {
      status: 200,
      headers: {
        "content-type": mediaTypeForStorageKey(storageKey),
        "cache-control": "private, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
