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
  precacheEntries: [
    ...self.__MUNCHBASE_MANIFEST,
    // This route contains no user data. It mounts AppShell from IndexedDB when
    // an authenticated route cannot reach the server.
    { url: "/offline", revision: null },
  ],
  precacheOptions: {
    cleanupOutdatedCaches: true,
  },
  skipWaiting: true,
  clientsClaim: true,
  // The navigation strategy must inspect the response status so a deployment
  // proxy's 5xx page can fall through to the offline shell. Navigation preload
  // bypasses strategy response plugins, so keep it disabled here.
  navigationPreload: false,
  disableDevLogs: true,
  runtimeCaching: [
    {
      matcher: ({ request }) => request.mode === "navigate",
      // Authenticated documents contain the full AppState. Never put them in
      // Cache Storage, where a later account on the same browser could read them.
      handler: new NetworkOnly({
        networkTimeoutSeconds: 8,
        plugins: [
          {
            fetchDidSucceed: ({ response }) => {
              // Some deployment proxies return their own 5xx document when the
              // Munchbase origin is unreachable. Treat that like a network
              // failure so Serwist serves the offline shell.
              if (response.status >= 500) throw new Error(`Navigation failed with ${response.status}.`);
              return response;
            },
          },
        ],
      }),
    },
  ],
  fallbacks: {
    entries: [
      {
        url: "/offline",
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
      // Older Munchbase workers enabled this on the registration. Explicitly
      // disable it because the setting survives service-worker upgrades.
      self.registration.navigationPreload?.disable() ?? Promise.resolve(),
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
