"use client";

import { useNetworkStatus } from "@/hooks/use-network-status";

export function NetworkStatus() {
  const online = useNetworkStatus();

  if (online) return null;

  return (
    <div className="offline-banner" role="alert">
      You&apos;re offline. Changes will sync when connection is restored.
    </div>
  );
}
