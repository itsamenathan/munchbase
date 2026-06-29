/// <reference lib="webworker" />

import { Serwist } from "serwist";

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
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  disableDevLogs: true,
});

// Next.js RSC navigation fetches carry these headers. If the service worker
// serves a cached HTML response to them, Next.js sees the wrong content-type
// and throws "An unexpected response was received from the server."
// Register our listener first so it wins the respondWith race for RSC requests;
// non-RSC requests fall through to Serwist's listener unchanged.
self.addEventListener("fetch", (event) => {
  if (
    event.request.headers.has("RSC") ||
    event.request.headers.has("Next-Router-State-Tree") ||
    event.request.headers.has("Next-Router-Prefetch")
  ) {
    event.respondWith(fetch(event.request));
  }
});

serwist.addEventListeners();

// After a new SW activates and claims all clients, tell each window to reload
// so stale cached JS bundles (which could reference old server action IDs) are replaced.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((windowClients) => {
      for (const client of windowClients) {
        client.postMessage({ type: "SW_UPDATED" });
      }
    }),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
