"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";

const NetworkContext = createContext<boolean>(true);

export function NetworkProvider({ children }: { children: ReactNode }) {
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

  return (
    <NetworkContext.Provider value={online}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetworkStatus() {
  return useContext(NetworkContext);
}
