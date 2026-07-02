"use client";

import { useEffect, useState, useCallback } from "react";

let deferredPrompt: Event | null = null;

function isIosSafari() {
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return isIos && !isStandalone;
}

export function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);

  const handleBeforeInstall = useCallback((e: Event) => {
    e.preventDefault();
    deferredPrompt = e;
    if (!sessionStorage.getItem("pwainstall-dismissed")) {
      setShow(true);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    // iOS Safari never fires beforeinstallprompt, so fall back to manual instructions.
    if (isIosSafari() && !sessionStorage.getItem("pwainstall-dismissed")) {
      setIos(true);
      setShow(true);
    }
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, [handleBeforeInstall]);

  if (!show) return null;

  const dismiss = () => {
    sessionStorage.setItem("pwainstall-dismissed", "1");
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
