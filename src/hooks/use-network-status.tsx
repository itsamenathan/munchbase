"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  createOfflineMutationId,
  enqueueMutationWithState,
  getOfflineMetadata,
  getQueuedActions,
  markOfflineDataSynced,
  removeQueuedAction,
  restaurantIdFromQueuedAction,
  updateQueuedActionFailure,
  type SerializedFormData,
} from "@/lib/offline-db";
import { restoreMutationFormData } from "@/lib/offline-mutations";
import { submitMutationData } from "@/lib/mutation-client";
import { CSRF_FIELD } from "@/lib/csrf-constants";
import { readCsrfToken } from "@/lib/csrf-client";
import type { AppState } from "@/lib/types";

type NetworkState = {
  online: boolean;
  queuedCount: number;
  pendingRestaurantIds: number[];
  blockedMessage: string | null;
  syncedMessage: string | null;
  syncError: string | null;
  syncing: boolean;
  lastSyncedAt: number | null;
  queueMutation: (
    action: string,
    payload: SerializedFormData,
    state: AppState,
    mutationId: string,
  ) => Promise<void>;
  createMutationId: () => string;
  reportBlocked: (message: string) => void;
  markOriginUnavailable: () => void;
};

const NetworkContext = createContext<NetworkState | null>(null);

function onlineSnapshot() {
  return navigator.onLine;
}

async function submitQueuedMutation(formData: FormData) {
  try {
    return await submitMutationData(formData);
  } catch {
    return submitMutationData(formData);
  }
}

export function NetworkProvider({
  children,
  userId,
  initiallyOffline = false,
  checkOrigin = true,
}: {
  children: ReactNode;
  userId: number;
  initiallyOffline?: boolean;
  checkOrigin?: boolean;
}) {
  const router = useRouter();
  const browserOnline = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener("online", onStoreChange);
      window.addEventListener("offline", onStoreChange);
      return () => {
        window.removeEventListener("online", onStoreChange);
        window.removeEventListener("offline", onStoreChange);
      };
    },
    onlineSnapshot,
    () => true,
  );
  const [originAvailable, setOriginAvailable] = useState(!initiallyOffline);
  const online = browserOnline && originAvailable;
  const [queuedCount, setQueuedCount] = useState(0);
  const [pendingRestaurantIds, setPendingRestaurantIds] = useState<number[]>([]);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const [syncedMessage, setSyncedMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const draining = useRef(false);
  const blockedTimer = useRef<number | null>(null);

  const refreshQueueState = useCallback(async () => {
    const [actions, metadata] = await Promise.all([
      getQueuedActions(userId),
      getOfflineMetadata(),
    ]);
    setQueuedCount(actions.length);
    const restaurantIds = new Set<number>();
    for (const action of actions) {
      const restaurantId = restaurantIdFromQueuedAction(action);
      if (restaurantId !== null) restaurantIds.add(restaurantId);
    }
    setPendingRestaurantIds([...restaurantIds]);
    if (metadata?.userId === userId) setLastSyncedAt(metadata.lastSyncedAt);
  }, [userId]);

  const reportBlocked = useCallback((message: string) => {
    setBlockedMessage(message);
    if (blockedTimer.current !== null) window.clearTimeout(blockedTimer.current);
    blockedTimer.current = window.setTimeout(() => setBlockedMessage(null), 5000);
  }, []);

  const markOriginUnavailable = useCallback(() => setOriginAvailable(false), []);

  useEffect(() => {
    if (!checkOrigin || !browserOnline || originAvailable) return;
    let cancelled = false;
    const check = async () => {
      try {
        const response = await fetch("/api/health/live", { cache: "no-store" });
        if (!cancelled && response.ok) setOriginAvailable(true);
      } catch {
        // Stay offline and try again. The queue must not drain against a dead origin.
      }
    };
    void check();
    const interval = window.setInterval(() => void check(), 10000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [browserOnline, checkOrigin, originAvailable]);

  useEffect(() => () => {
    if (blockedTimer.current !== null) window.clearTimeout(blockedTimer.current);
  }, []);

  useEffect(() => {
    // IndexedDB is external state; seed the queue badge after the client mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshQueueState().catch((error) => {
      console.warn("Munchbase offline queue unavailable", error);
    });
  }, [refreshQueueState]);

  const queueMutation = useCallback(async (
    action: string,
    payload: SerializedFormData,
    state: AppState,
    mutationId: string,
  ) => {
    await enqueueMutationWithState(userId, action, payload, state, mutationId);
    await refreshQueueState();
    setSyncError(null);
  }, [refreshQueueState, userId]);

  // Logout remains a normal server request, but it still needs a fresh CSRF
  // token. Keep cached data when a session merely expires; explicit logout is
  // the path that clears it.
  useEffect(() => {
    function handleSubmit(event: SubmitEvent) {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      const url = new URL(form.action, window.location.href);
      if (url.pathname !== "/logout") return;
      if (!online) {
        event.preventDefault();
        reportBlocked("Sign out needs a connection.");
        return;
      }
      let csrfInput = form.querySelector<HTMLInputElement>(`input[name="${CSRF_FIELD}"]`);
      if (!csrfInput) {
        csrfInput = document.createElement("input");
        csrfInput.type = "hidden";
        csrfInput.name = CSRF_FIELD;
        form.prepend(csrfInput);
      }
      csrfInput.value = readCsrfToken();
    }

    document.addEventListener("submit", handleSubmit);
    return () => document.removeEventListener("submit", handleSubmit);
  }, [online, reportBlocked]);

  useEffect(() => {
    if (!online || draining.current) return;
    draining.current = true;
    setSyncing(true);
    setSyncError(null);

    void (async () => {
      let succeeded = 0;
      try {
        const actions = await getQueuedActions(userId);
        for (const action of actions) {
          const formData = restoreMutationFormData(action.payload);
          formData.set(CSRF_FIELD, readCsrfToken());
          formData.set("__mutationId", action.mutationId || createOfflineMutationId());
          try {
            const result = await submitQueuedMutation(formData);
            if (!result.ok) {
              await updateQueuedActionFailure(action.id, result.message);
              setSyncError(result.message);
              break;
            }
            await removeQueuedAction(action.id);
            succeeded++;
          } catch (error) {
            const message = error instanceof Error ? error.message : "Sync failed.";
            await updateQueuedActionFailure(action.id, message);
            setSyncError(message);
            setOriginAvailable(false);
            break;
          }
        }
        if (succeeded) {
          await markOfflineDataSynced(userId);
          setLastSyncedAt(Date.now());
          setSyncedMessage(`Synced ${succeeded} change${succeeded === 1 ? "" : "s"}.`);
          window.setTimeout(() => setSyncedMessage(null), 4000);
          router.refresh();
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Sync failed.";
        setSyncError(message);
      } finally {
        draining.current = false;
        setSyncing(false);
        await refreshQueueState().catch(() => undefined);
      }
    })();
  }, [online, refreshQueueState, router, userId]);

  return (
    <NetworkContext.Provider value={{
      online,
      queuedCount,
      pendingRestaurantIds,
      blockedMessage,
      syncedMessage,
      syncError,
      syncing,
      lastSyncedAt,
      queueMutation,
      createMutationId: createOfflineMutationId,
      reportBlocked,
      markOriginUnavailable,
    }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetworkStatus() {
  const context = useContext(NetworkContext);
  if (!context) throw new Error("useNetworkStatus must be used inside NetworkProvider.");
  return context;
}
