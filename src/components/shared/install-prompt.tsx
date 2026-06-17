"use client";

import { useEffect, useState, useCallback } from "react";

let deferredPrompt: Event | null = null;

export function InstallPrompt() {
  const [show, setShow] = useState(false);

  const handleBeforeInstall = useCallback((e: Event) => {
    e.preventDefault();
    deferredPrompt = e;
    if (!sessionStorage.getItem("pwainstall-dismissed")) {
      setShow(true);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, [handleBeforeInstall]);

  if (!show) return null;

  return (
    <div className="install-prompt" role="dialog" aria-label="Install app">
      <p>Add Munchbase to your home screen for quick access.</p>
      <button
        onClick={async () => {
          if (deferredPrompt) {
            (deferredPrompt as unknown as { prompt: () => Promise<void> }).prompt();
            deferredPrompt = null;
          }
          setShow(false);
        }}
      >
        Install
      </button>
      <button
        className="ghost-button"
        style={{ width: "auto" }}
        onClick={() => {
          sessionStorage.setItem("pwainstall-dismissed", "1");
          setShow(false);
        }}
      >
        Later
      </button>
    </div>
  );
}
