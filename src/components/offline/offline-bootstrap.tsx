"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/app-shell";
import { NetworkProvider } from "@/hooks/use-network-status";
import { getActiveCachedAppState, reportCacheFailure } from "@/lib/offline-db";
import type { AppState } from "@/lib/types";

type LoadState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "ready"; state: AppState; manualOffline: boolean };

async function originIsAvailable() {
  if (!navigator.onLine) return false;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch("/api/health/live", {
      cache: "no-store",
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}

function openCanonicalApp() {
  const current = new URL(window.location.href);
  const existingReturnTo = current.searchParams.get("__offlineReturnTo");
  current.searchParams.delete("__offlineReconnect");
  current.searchParams.delete("__offlineReturnTo");
  const returnTo = existingReturnTo ?? `${current.pathname}${current.search}${current.hash}`;
  // Load a known canonical document first. AppShell then restores the route the
  // user was viewing and removes these internal parameters.
  const url = new URL("/explore", window.location.origin);
  url.searchParams.set("__offlineReconnect", String(Date.now()));
  url.searchParams.set("__offlineReturnTo", returnTo);
  window.location.replace(url);
}

export function OfflineBootstrap() {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const manualOffline = window.location.pathname === "/offline";
      if (!manualOffline && await originIsAvailable()) {
        openCanonicalApp();
        return;
      }
      try {
        const cached = await getActiveCachedAppState();
        if (cancelled) return;
        setLoadState(cached
          ? { status: "ready", state: cached.state, manualOffline }
          : { status: "empty" });
      } catch (error) {
        reportCacheFailure(error);
        if (!cancelled) setLoadState({ status: "empty" });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (loadState.status !== "ready" || loadState.manualOffline) return;
    let cancelled = false;
    const reconnect = async () => {
      if (!await originIsAvailable() || cancelled) return;
      openCanonicalApp();
    };
    void reconnect();
    const interval = window.setInterval(() => void reconnect(), 5000);
    window.addEventListener("online", reconnect);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("online", reconnect);
    };
  }, [loadState]);

  if (loadState.status === "ready") {
    return (
      <NetworkProvider
        userId={loadState.state.user.id}
        initiallyOffline
        checkOrigin={false}
      >
        <AppShell state={loadState.state} offlineShell />
      </NetworkProvider>
    );
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <p className="kicker">Munchbase offline</p>
        {loadState.status === "loading" ? (
          <>
            <h1>Opening saved Restaurants</h1>
            <p>Reading the latest data saved on this device.</p>
          </>
        ) : (
          <>
            <h1>No offline data yet</h1>
            <p>Connect once and open Munchbase to save Restaurants and Lists on this device.</p>
            <a className="ghost-button" href="/explore">Try again</a>
          </>
        )}
      </section>
    </main>
  );
}
