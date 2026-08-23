"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  clearAllOfflineData,
  clearUnsafeRuntimeCaches,
  reportCacheFailure,
} from "@/lib/offline-db";

export function OfflineDataCleanup() {
  const searchParams = useSearchParams();
  const signedOut = searchParams.get("signedOut") === "1";

  useEffect(() => {
    if (!signedOut) return;
    void Promise.all([clearAllOfflineData(), clearUnsafeRuntimeCaches()]).catch(reportCacheFailure);
  }, [signedOut]);

  return null;
}
