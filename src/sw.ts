/// <reference lib="webworker" />

import { NetworkOnly, Serwist } from "serwist";

declare const self: ServiceWorkerGlobalScope & {
  __MUNCHBASE_MANIFEST: Array<
    | string
    | {
        url: string;
        revision?: string | null;
        integrity?: string;
      }
  >;
};

const serwist = new Serwist({
  precacheEntries: self.__MUNCHBASE_MANIFEST,
  precacheOptions: {
    cleanupOutdatedCaches: true,
  },
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  disableDevLogs: true,
  runtimeCaching: [
    {
      matcher: ({ request }) => request.mode === "navigate",
      // Authenticated documents contain the full AppState. Never put them in
      // Cache Storage, where a later account on the same browser could read them.
      handler: new NetworkOnly(),
    },
  ],
  fallbacks: {
    entries: [
      {
        url: "/offline.html",
        matcher: ({ request }) => request.mode === "navigate",
      },
    ],
  },
});

serwist.addEventListeners();

// After a new SW activates and claims all clients, tell each window to reload
// so stale cached JS bundles (which could reference old server action IDs) are replaced.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      // This cache came from the old NetworkFirst navigation rule and can hold
      // authenticated HTML. Remove it even if the cache predates this worker.
      caches.delete("pages"),
      self.clients.matchAll({ type: "window" }).then((windowClients) => {
        for (const client of windowClients) {
          client.postMessage({ type: "SW_UPDATED" });
        }
      }),
    ]),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
