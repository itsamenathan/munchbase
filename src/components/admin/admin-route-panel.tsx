"use client";

import { useRouter } from "next/navigation";
import { AdminDrawer } from "./admin-panel";
import type { AdminData } from "@/lib/types";

export function AdminRoutePanel({ data, returnTo }: { data: AdminData; returnTo: string }) {
  const router = useRouter();
  const close = () => router.replace(returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/explore", { scroll: false });
  return <AdminDrawer data={data} onClose={close} />;
}
