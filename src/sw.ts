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
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  disableDevLogs: true,
});

// Next.js RSC navigation fetches include these headers. If the service worker
// serves a cached HTML response to these requests, Next.js sees the wrong
// content-type and throws "An unexpected response was received from the server."
// Always go network-only for RSC requests.
serwist.registerRoute(
  ({ request }) =>
    request.headers.has("RSC") ||
    request.headers.has("Next-Router-State-Tree") ||
    request.headers.has("Next-Router-Prefetch"),
  new NetworkOnly(),
);

serwist.addEventListeners();

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
