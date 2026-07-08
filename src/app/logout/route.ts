import type { NextRequest } from "next/server";
import { redirectTo } from "@/lib/redirect";
import { destroySession } from "@/lib/auth";
import { assertCsrfToken } from "@/lib/csrf";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  try {
    await assertCsrfToken(formData);
  } catch {
    return redirectTo("/explore?mutationError=csrf&message=Security%20check%20failed.%20Refresh%20and%20try%20again.");
  }
  await destroySession();
  return redirectTo("/explore");
}
