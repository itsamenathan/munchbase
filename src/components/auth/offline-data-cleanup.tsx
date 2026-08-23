"use client";

import { useEffect } from "react";
import {
  clearAllOfflineData,
  clearUnsafeRuntimeCaches,
  reportCacheFailure,
} from "@/lib/offline-db";

export function OfflineDataCleanup() {
  useEffect(() => {
    void Promise.all([clearAllOfflineData(), clearUnsafeRuntimeCaches()]).catch(reportCacheFailure);
  }, []);

  return null;
}
