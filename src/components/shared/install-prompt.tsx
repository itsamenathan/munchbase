"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, useCallback } from "react";

let deferredPrompt: Event | null = null;

const DISMISSED_KEY = "pwainstall-dismissed";

function isIosSafari() {
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return isIos && !isStandalone;
}

export function InstallPrompt() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);
  const hiddenOnThisScreen = pathname.startsWith("/restaurants/") || pathname.startsWith("/map") || pathname.includes("/settings");

  const revealPrompt = useCallback(() => {
    if (hiddenOnThisScreen || localStorage.getItem(DISMISSED_KEY)) return;
    setShow(true);
  }, [hiddenOnThisScreen]);

  const handleBeforeInstall = useCallback((e: Event) => {
    e.preventDefault();
    deferredPrompt = e;
    revealPrompt();
  }, [revealPrompt]);

  useEffect(() => {
    if (hiddenOnThisScreen) {
      setShow(false);
      return;
    }
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    // iOS Safari never fires beforeinstallprompt, so fall back to manual instructions.
    if (isIosSafari() && !localStorage.getItem(DISMISSED_KEY)) {
      setIos(true);
      revealPrompt();
    }
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, [handleBeforeInstall, hiddenOnThisScreen, revealPrompt]);

  if (!show) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setShow(false);
  };

  if (ios) {
    return (
      <div className="install-prompt" role="dialog" aria-label="Install app">
        <p>Add Munchbase to your home screen: tap Share, then &quot;Add to Home Screen&quot;.</p>
        <button className="ghost-button" style={{ width: "auto" }} onClick={dismiss}>
          Got it
        </button>
      </div>
    );
  }

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
      <button className="ghost-button" style={{ width: "auto" }} onClick={dismiss}>
        Later
      </button>
    </div>
  );
}
