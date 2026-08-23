"use client";

import { useNetworkStatus } from "@/hooks/use-network-status";

export function NetworkStatus() {
  const { online, queuedCount, blockedMessage, syncedMessage, syncError, syncing, lastSyncedAt } = useNetworkStatus();

  if (blockedMessage) {
    return <div className="offline-banner" role="alert">{blockedMessage}</div>;
  }

  if (online) {
    if (syncError) {
      return (
        <div className="offline-banner" role="alert">
          {queuedCount > 0 ? `${queuedCount} pending. ` : ""}Sync failed: {syncError}
        </div>
      );
    }
    if (syncing && queuedCount > 0) {
      return <div className="offline-banner" role="status">Syncing {queuedCount} pending change{queuedCount === 1 ? "" : "s"}...</div>;
    }
    if (queuedCount > 0) {
      return <div className="offline-banner" role="status">{queuedCount} change{queuedCount === 1 ? "" : "s"} saved on this device.</div>;
    }
    if (!syncedMessage) return null;
    return (
      <div className="offline-banner" role="status">
        {syncedMessage}
      </div>
    );
  }

  return (
    <div className="offline-banner" role="alert">
      {queuedCount > 0
        ? `You're offline. ${queuedCount} change${queuedCount === 1 ? "" : "s"} saved on this device and waiting to sync.`
        : `You're offline.${lastSyncedAt ? ` Last synced ${new Date(lastSyncedAt).toLocaleString()}.` : ""}`}
    </div>
  );
}
