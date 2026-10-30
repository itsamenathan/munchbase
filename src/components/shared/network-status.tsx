"use client";

import { useNetworkStatus } from "@/hooks/use-network-status";

export function NetworkStatus() {
  const { online, queuedCount, blockedMessage, syncedMessage, syncError, syncConflict, resolveSyncConflict, syncing, lastSyncedAt } = useNetworkStatus();

  if (syncConflict && online) {
    return (
      <div className="offline-banner conflict-sync-banner" role="alert">
        <strong>{syncConflict.message}</strong>
        <span>
          Your change while offline: {syncConflict.fields.map((field) => `${field.label} (now: ${field.display})`).join(", ")}.
        </span>
        <span className="conflict-actions">
          <button type="button" onClick={() => void resolveSyncConflict("keep")}>Keep my changes</button>
          <button type="button" className="ghost-button" onClick={() => void resolveSyncConflict("discard")}>Use their version</button>
        </span>
      </div>
    );
  }

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
