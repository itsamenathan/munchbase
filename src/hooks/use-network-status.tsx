"use client";

import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { enqueueAction, getQueuedActions, removeQueuedAction } from "@/lib/offline-db";

const MUTATE_PATH = "/mutate";

type NetworkState = {
  online: boolean;
  queuedCount: number;
  blockedMessage: string | null;
  syncedMessage: string | null;
};

const NetworkContext = createContext<NetworkState>({
  online: true,
  queuedCount: 0,
  blockedMessage: null,
  syncedMessage: null,
});

export function NetworkProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const online = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener("online", onStoreChange);
      window.addEventListener("offline", onStoreChange);
      return () => {
        window.removeEventListener("online", onStoreChange);
        window.removeEventListener("offline", onStoreChange);
      };
    },
    () => navigator.onLine,
    () => true,
  );

  const [queuedCount, setQueuedCount] = useState(0);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const [syncedMessage, setSyncedMessage] = useState<string | null>(null);
  const draining = useRef(false);

  const refreshQueueCount = async () => {
    const actions = await getQueuedActions();
    setQueuedCount(actions.length);
  };

  useEffect(() => {
    void refreshQueueCount();
  }, []);

  // Queue mutations submitted while offline instead of letting the native
  // form POST fail outright. Runs in the bubble phase (after any per-form
  // onSubmit handler, e.g. the delete-restaurant confirm() guard) so a
  // cancelled confirmation is respected via event.defaultPrevented.
  useEffect(() => {
    function handleSubmit(event: SubmitEvent) {
      if (event.defaultPrevented) return;
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      let url: URL;
      try {
        url = new URL(form.action, window.location.href);
      } catch {
        return;
      }
      if (url.pathname !== MUTATE_PATH || navigator.onLine) return;

      const formData = new FormData(form);
      const hasFile = [...formData.values()].some((value) => value instanceof File);
      event.preventDefault();

      if (hasFile) {
        setBlockedMessage("You're offline — photo uploads need a connection.");
        window.setTimeout(() => setBlockedMessage(null), 4000);
        return;
      }

      const entries: Record<string, string> = {};
      formData.forEach((value, key) => {
        entries[key] = String(value);
      });
      void enqueueAction("mutate", entries).then(refreshQueueCount);
    }

    document.addEventListener("submit", handleSubmit);
    return () => document.removeEventListener("submit", handleSubmit);
  }, []);

  // Drain the queue once connectivity returns.
  useEffect(() => {
    if (!online || draining.current) return;
    draining.current = true;
    (async () => {
      const actions = await getQueuedActions();
      let succeeded = 0;
      for (const action of actions) {
        const formData = new FormData();
        Object.entries(action.payload as Record<string, string>).forEach(([key, value]) => {
          formData.set(key, value);
        });
        try {
          await fetch(MUTATE_PATH, { method: "POST", body: formData, redirect: "manual" });
          await removeQueuedAction(action.id);
          succeeded++;
        } catch {
          break; // still offline, or a real error — leave the rest queued for next time
        }
      }
      draining.current = false;
      await refreshQueueCount();
      if (succeeded) {
        setSyncedMessage(`Synced ${succeeded} change${succeeded === 1 ? "" : "s"}.`);
        window.setTimeout(() => setSyncedMessage(null), 4000);
        router.refresh();
      }
    })();
  }, [online, router]);

  return (
    <NetworkContext.Provider value={{ online, queuedCount, blockedMessage, syncedMessage }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetworkStatus() {
  return useContext(NetworkContext);
}
