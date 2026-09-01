"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  clearAllOfflineData,
  clearUnsafeRuntimeCaches,
  reportCacheFailure,
} from "@/lib/offline-db";

export function OfflineDataCleanup() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const signedOut = searchParams.get("signedOut") === "1";

  useEffect(() => {
    if (!signedOut) return;
    void Promise.all([clearAllOfflineData(), clearUnsafeRuntimeCaches()]).catch(reportCacheFailure);
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("signedOut");
    const query = nextParams.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
  }, [pathname, router, searchParams, signedOut]);

  return null;
}
