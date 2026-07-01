import { redirectTo } from "@/lib/redirect";
import { destroySession } from "@/lib/auth";

export async function POST() {
  await destroySession();
  return redirectTo("/explore");
}
