"use client";

import { useNetworkStatus } from "@/hooks/use-network-status";

export function NetworkStatus() {
  const { online, queuedCount, blockedMessage, syncedMessage } = useNetworkStatus();

  if (online) {
    if (!syncedMessage) return null;
    return (
      <div className="offline-banner" role="status">
        {syncedMessage}
      </div>
    );
  }

  return (
    <div className="offline-banner" role="alert">
      {blockedMessage
        ? blockedMessage
        : queuedCount > 0
          ? `You're offline. ${queuedCount} change${queuedCount === 1 ? "" : "s"} queued — will sync when you're back online.`
          : "You're offline."}
    </div>
  );
}
