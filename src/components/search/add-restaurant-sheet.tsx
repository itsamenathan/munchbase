"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { AddRestaurantsPanel, type AddRestaurantsPanelProps } from "./add-restaurants";

export function AddRestaurantSheet({
  activeListName,
  onClose,
  ...panelProps
}: AddRestaurantsPanelProps & {
  activeListName: string;
  onClose: () => void;
}) {
  const [overlayEnabled, setOverlayEnabled] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1079px)");
    const syncOverlay = () => setOverlayEnabled(media.matches);
    syncOverlay();
    media.addEventListener("change", syncOverlay);
    return () => media.removeEventListener("change", syncOverlay);
  }, []);

  useEffect(() => {
    if (!overlayEnabled) return;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, overlayEnabled]);

  useEffect(() => {
    if (!overlayEnabled) return;

    const viewport = window.visualViewport;
    const syncViewport = () => {
      const backdrop = backdropRef.current;
      if (!backdrop || !viewport) return;
      backdrop.style.setProperty("--add-viewport-top", `${viewport.offsetTop}px`);
      backdrop.style.setProperty("--add-viewport-left", `${viewport.offsetLeft}px`);
      backdrop.style.setProperty("--add-viewport-width", `${viewport.width}px`);
      backdrop.style.setProperty("--add-viewport-height", `${viewport.height}px`);
    };
    const focusSearch = () => {
      searchInputRef.current?.focus({ preventScroll: true });
      contentRef.current?.scrollTo({ top: 0 });
      syncViewport();
    };

    syncViewport();
    const frame = window.requestAnimationFrame(focusSearch);
    viewport?.addEventListener("resize", syncViewport);
    viewport?.addEventListener("scroll", syncViewport);
    return () => {
      window.cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", syncViewport);
      viewport?.removeEventListener("scroll", syncViewport);
    };
  }, [overlayEnabled]);

  if (!overlayEnabled) return null;

  return (
    <div ref={backdropRef} className="add-restaurant-sheet-backdrop" onClick={onClose}>
      <section
        id="add-restaurant-sheet"
        className="add-restaurant-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-restaurant-sheet-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="add-restaurant-sheet-header">
          <div>
            <p className="kicker">{activeListName}</p>
            <h2 id="add-restaurant-sheet-title">Add restaurant</h2>
          </div>
          <button type="button" className="ghost-button icon-button" onClick={onClose} aria-label="Close Add restaurant">
            <X size={18} />
          </button>
        </header>
        <div ref={contentRef} className="add-restaurant-sheet-content">
          <AddRestaurantsPanel {...panelProps} showListContext={false} searchInputRef={searchInputRef} />
        </div>
      </section>
    </div>
  );
}
