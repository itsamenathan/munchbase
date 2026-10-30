"use client";

// Photos are user uploads served from /media/[...key] and already resized on upload
// (see src/lib/restaurant-photos.ts), so next/image's loader adds nothing here — and
// self-hosted deployments have no image optimization backend to route through.
/* eslint-disable @next/next/no-img-element */

import { startTransition, useEffect, useRef, useState, type TouchEvent } from "react";
import { useRouter } from "next/navigation";
import { Camera, ChevronLeft, ChevronRight, ImagePlus, Images, Pencil, Trash2, X } from "lucide-react";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { useToast } from "@/hooks/use-toast";
import { appendCsrfToken } from "@/lib/csrf-client";
import { formatShortDateTime } from "@/lib/datetime";
import { submitMutationData } from "@/lib/mutation-client";
import type { Restaurant, RestaurantPhoto } from "@/lib/types";

type PendingPhoto = {
  key: string;
  file: File;
  preview: string;
  status: "uploading" | "failed" | "done";
  photoId: number | null;
  error: string | null;
};

export function RestaurantPhotos({
  canWrite,
  entry,
  activePhotoId,
  onOpenPhoto,
  onSelectPhoto,
  onClosePhoto,
}: {
  canWrite: boolean;
  entry: Restaurant;
  activePhotoId: number | null;
  onOpenPhoto: (photoId: number) => void;
  onSelectPhoto: (photoId: number) => void;
  onClosePhoto: () => void;
}) {
  const router = useRouter();
  const viewerIndex = activePhotoId ? entry.photos.findIndex((photo) => photo.id === activePhotoId) : -1;
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  const pendingRef = useRef<PendingPhoto[]>([]);
  const nextKey = useRef(0);

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  useEffect(() => () => {
    pendingRef.current.forEach((p) => URL.revokeObjectURL(p.preview));
  }, []);

  function patchPending(key: string, patch: Partial<PendingPhoto>) {
    setPending((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  }

  // A finished upload stays in the list until the grid shows the saved photo, so the tile never blinks out.
  const visiblePending = pending.filter((p) => p.status !== "done" || !entry.photos.some((photo) => photo.id === p.photoId));

  async function uploadPending(item: PendingPhoto) {
    patchPending(item.key, { status: "uploading", error: null });
    const fd = new FormData();
    fd.append("__action", "uploadRestaurantPhoto");
    fd.append("restaurantId", String(entry.id));
    fd.append("photo", item.file);
    try {
      const result = await submitMutationData(fd);
      if (!result.ok) throw new Error(result.message);
      patchPending(item.key, { status: "done", photoId: result.photoId ?? null });
      router.refresh();
    } catch (error) {
      patchPending(item.key, { status: "failed", error: error instanceof Error ? error.message : "Photo failed to upload." });
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.currentTarget.value = "";
    const added: PendingPhoto[] = files.map((file) => ({
      key: String(nextKey.current++),
      file,
      preview: URL.createObjectURL(file),
      status: "uploading",
      photoId: null,
      error: null,
    }));
    setPending((prev) => [...prev, ...added]);
    added.forEach((item) => void uploadPending(item));
  }

  function removePending(key: string) {
    const item = pendingRef.current.find((p) => p.key === key);
    if (item) URL.revokeObjectURL(item.preview);
    setPending((prev) => prev.filter((p) => p.key !== key));
  }

  const hasPhotos = entry.photos.length > 0 || visiblePending.length > 0;

  return (
    <section className="detail-section-card photo-section">
      <div className="section-head">
        <span className="detail-section-title"><Images size={16} /><h4>Photos</h4></span>
        {entry.photos.length ? <span className="pill">{entry.photos.length}</span> : null}
      </div>

      {!hasPhotos && canWrite ? <p className="muted">No photos yet. Take or choose one below.</p> : null}
      {hasPhotos ? (
        <div className="photo-grid">
          {visiblePending.map((item) => (
            <PendingPhotoTile
              key={item.key}
              item={item}
              onRetry={() => void uploadPending(item)}
              onRemove={() => removePending(item.key)}
            />
          ))}
          {entry.photos.map((photo) => (
            <PhotoCard
              canWrite={canWrite}
              key={photo.id}
              photo={photo}
              onOpen={() => onOpenPhoto(photo.id)}
              onDelete={() => { if (activePhotoId === photo.id) onClosePhoto(); }}
            />
          ))}
        </div>
      ) : !canWrite ? (
        <p className="muted">No photos yet.</p>
      ) : null}

      {viewerIndex >= 0 ? (
        <PhotoViewer
          key={viewerIndex}
          photos={entry.photos}
          initialIndex={viewerIndex}
          onSelect={(photoId) => onSelectPhoto(photoId)}
          onClose={onClosePhoto}
        />
      ) : null}

      {canWrite ? (
        <div className="photo-upload-actions">
          <label className="photo-upload-zone">
            <input
              name="cameraPhoto"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/*"
              capture="environment"
              className="photo-upload-input"
              onChange={handleFileChange}
            />
            <Camera size={18} />
            <div className="photo-upload-zone-text">
              <span>Take photo</span>
              <small>Use camera</small>
            </div>
          </label>
          <label className="photo-upload-zone">
            <input
              name="photo"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/*"
              className="photo-upload-input"
              onChange={handleFileChange}
            />
            <ImagePlus size={18} />
            <div className="photo-upload-zone-text">
              <span>Choose photos</span>
              <small>From library</small>
            </div>
          </label>
        </div>
      ) : null}
    </section>
  );
}

function PendingPhotoTile({
  item,
  onRetry,
  onRemove,
}: {
  item: PendingPhoto;
  onRetry: () => void;
  onRemove: () => void;
}) {
  const failed = item.status === "failed";
  return (
    <article className={`photo-card photo-card-pending ${item.status}`}>
      <div className="photo-thumb-button">
        <img src={item.preview} alt="" className="photo-thumb" />
        {item.status !== "done" ? (
          <span className="photo-pending-overlay">{failed ? "Didn't upload" : "Uploading…"}</span>
        ) : null}
      </div>
      {failed ? (
        <div className="photo-pending-actions">
          <button type="button" className="compact-button" onClick={onRetry}>Try again</button>
          <button type="button" className="ghost-button compact-button" onClick={onRemove}>Remove</button>
        </div>
      ) : null}
    </article>
  );
}

function PhotoCard({
  canWrite,
  photo,
  onOpen,
  onDelete,
}: {
  canWrite: boolean;
  photo: RestaurantPhoto;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const router = useRouter();
  const savedDescription = photo.description ?? "";
  // Null until the description is edited, so the card shows the saved text otherwise.
  const [draft, setDraft] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const { show } = useToast();
  const shownDescription = draft ?? savedDescription;

  // The photo hides at once but is only deleted when the toast lapses, so Undo can bring it back.
  function handleDelete() {
    setRemoved(true);
    show({
      message: "Photo deleted",
      actionLabel: "Undo",
      durationMs: 6000,
      onAction: () => setRemoved(false),
      onExpire: () => void deletePhoto(),
    });
  }

  async function deletePhoto() {
    const fd = new FormData();
    fd.append("__action", "deleteRestaurantPhoto");
    appendCsrfToken(fd);
    fd.append("photoId", String(photo.id));
    try {
      // keepalive lets the request finish if the page is closed while the toast is still showing.
      await fetch("/mutate", { method: "POST", body: fd, keepalive: true });
    } catch {
      // The photo comes back on the next refresh if this did not go through.
    }
    onDelete();
    router.refresh();
  }

  function startEditing() {
    setDraft(shownDescription);
    setSaveError(null);
    setEditing(true);
  }

  async function finishEditing() {
    setEditing(false);
    const next = (draft ?? savedDescription).trim();
    if (next === savedDescription) return;
    const fd = new FormData();
    fd.append("__action", "updateRestaurantPhotoDescription");
    fd.append("photoId", String(photo.id));
    fd.append("description", next);
    try {
      const result = await submitMutationData(fd);
      if (!result.ok) throw new Error(result.message);
      setDraft(next);
      router.refresh();
    } catch (error) {
      setDraft(null);
      setSaveError(error instanceof Error ? error.message : "Couldn't save the description.");
    }
  }

  if (removed) return null;

  return (
    <article className="photo-card">
      <div className="photo-thumb-wrap">
        <button type="button" className="photo-thumb-button" onClick={onOpen} aria-label={`Open photo uploaded by ${photo.uploadedByName}`}>
          <img src={photo.thumbnailUrl} alt={shownDescription || "Restaurant photo"} className="photo-thumb" loading="lazy" />
        </button>
        {canWrite ? (
          <div className="photo-card-toolbar">
            <button type="button" className="ghost-button icon-button compact-icon-button photo-delete-button" onClick={handleDelete} aria-label="Delete photo">
              <Trash2 size={14} />
            </button>
          </div>
        ) : null}
      </div>
      {canWrite ? (
        <div className="photo-description-box">
          {editing ? (
            <input
              type="text"
              className="photo-description-input"
              aria-label="Photo description"
              placeholder="Add a description"
              maxLength={280}
              autoFocus
              value={draft ?? savedDescription}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => void finishEditing()}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
            />
          ) : (
            <button type="button" className="photo-description-text" onClick={startEditing} aria-label="Edit description">
              <span className={`photo-description-label${shownDescription ? "" : " empty"}`}>
                {shownDescription || "Add a description"}
              </span>
              <Pencil size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      ) : shownDescription ? (
        <div className="photo-card-copy">
          <strong>{shownDescription}</strong>
        </div>
      ) : null}
      {saveError ? <small className="photo-save-status error">{saveError}</small> : null}
    </article>
  );
}

function PhotoViewer({
  photos,
  initialIndex,
  onSelect,
  onClose,
}: {
  photos: RestaurantPhoto[];
  initialIndex: number;
  onSelect: (photoId: number) => void;
  onClose: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Swipe refs (single finger, zoom = 1)
  const swipeStartX = useRef<number | null>(null);
  const swipeCurrentX = useRef<number | null>(null);

  // Pinch refs (two fingers)
  const pinchStartDist = useRef<number | null>(null);
  const pinchStartZoom = useRef(1);
  const pinchStartPan = useRef({ x: 0, y: 0 });
  const pinchFocal = useRef({ x: 0, y: 0 }); // midpoint of pinch relative to stage center
  const stageRef = useRef<HTMLDivElement>(null);
  const isPinching = useRef(false); // used synchronously in touch handlers
  const [pinching, setPinching] = useState(false); // mirrors isPinching for render

  // Pan refs (single finger, zoom > 1)
  const panStart = useRef<{ tx: number; ty: number; px: number; py: number } | null>(null);

  // Double-tap ref
  const lastTap = useRef(0);

  useBodyScrollLock(true, { touchNone: true });


  const index = currentIndex >= 0 && currentIndex < photos.length ? currentIndex : 0;
  const photo = photos[index] ?? photos[0];
  if (!photo) return null;

  const moveTo = (nextIndex: number) => {
    if (!photos.length) return;
    const bounded = (nextIndex + photos.length) % photos.length;
    startTransition(() => {
      setCurrentIndex(bounded);
      setZoom(1);
      setPan({ x: 0, y: 0 });
    });
    onSelect(photos[bounded].id);
  };

  function touchDist(touches: React.TouchList) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 2) {
      isPinching.current = true;
      setPinching(true);
      swipeStartX.current = null;
      pinchStartDist.current = touchDist(event.touches);
      pinchStartZoom.current = zoom;
      pinchStartPan.current = { x: pan.x, y: pan.y };
      // Capture pinch midpoint relative to stage center
      const stage = stageRef.current;
      if (stage) {
        const rect = stage.getBoundingClientRect();
        const midX = (event.touches[0].clientX + event.touches[1].clientX) / 2;
        const midY = (event.touches[0].clientY + event.touches[1].clientY) / 2;
        pinchFocal.current = { x: midX - (rect.left + rect.width / 2), y: midY - (rect.top + rect.height / 2) };
      }
    } else if (event.touches.length === 1 && !isPinching.current) {
      const t = event.touches[0];
      if (zoom > 1) {
        panStart.current = { tx: t.clientX, ty: t.clientY, px: pan.x, py: pan.y };
      } else {
        swipeStartX.current = t.clientX;
        swipeCurrentX.current = t.clientX;
      }
    }
  };

  const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 2 && pinchStartDist.current !== null) {
      const dist = touchDist(event.touches);
      const next = Math.min(5, Math.max(1, pinchStartZoom.current * (dist / pinchStartDist.current)));
      if (next <= 1) {
        setZoom(1);
        setPan({ x: 0, y: 0 });
      } else {
        const s0 = pinchStartZoom.current;
        const { x: fx, y: fy } = pinchFocal.current;
        const { x: p0x, y: p0y } = pinchStartPan.current;
        const ratio = next / s0;
        setZoom(next);
        setPan({ x: fx * (1 - ratio) + p0x * ratio, y: fy * (1 - ratio) + p0y * ratio });
      }
    } else if (event.touches.length === 1) {
      const t = event.touches[0];
      if (zoom > 1 && panStart.current) {
        setPan({ x: panStart.current.px + t.clientX - panStart.current.tx, y: panStart.current.py + t.clientY - panStart.current.ty });
      } else if (!isPinching.current) {
        swipeCurrentX.current = t.clientX;
      }
    }
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    // Pinch ended (one or both fingers lifted)
    if (isPinching.current && event.touches.length < 2) {
      isPinching.current = false;
      setPinching(false);
      pinchStartDist.current = null;
      if (zoom < 1.15) { setZoom(1); setPan({ x: 0, y: 0 }); }
      swipeStartX.current = null;
      swipeCurrentX.current = null;
      panStart.current = null;
      return;
    }

    if (event.touches.length === 0) {
      const changedTouch = event.changedTouches[0];

      if (zoom > 1) {
        // While zoomed: detect double-tap to reset
        if (panStart.current && changedTouch) {
          const moved = Math.abs(changedTouch.clientX - panStart.current.tx) + Math.abs(changedTouch.clientY - panStart.current.ty);
          if (moved < 10) {
            const now = Date.now();
            if (now - lastTap.current < 300) { setZoom(1); setPan({ x: 0, y: 0 }); lastTap.current = 0; }
            else lastTap.current = now;
          }
        }
      } else if (swipeStartX.current !== null && swipeCurrentX.current !== null) {
        const delta = swipeCurrentX.current - swipeStartX.current;
        if (Math.abs(delta) > 40) {
          moveTo(index + (delta < 0 ? 1 : -1));
        } else {
          // Detect double-tap to zoom in
          const now = Date.now();
          if (now - lastTap.current < 300) { setZoom(2.5); lastTap.current = 0; }
          else lastTap.current = now;
        }
      }

      swipeStartX.current = null;
      swipeCurrentX.current = null;
      panStart.current = null;
    }
  };

  const imageStyle: React.CSSProperties = {
    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
    transformOrigin: "center center",
    cursor: zoom > 1 ? "grab" : "default",
    touchAction: zoom > 1 ? "none" : "pan-x",
    transition: pinching ? "none" : "transform 0.15s ease-out",
  };

  return (
    <div className="photo-viewer-backdrop" onClick={onClose}>
      <div
        className="photo-viewer"
        role="dialog"
        aria-modal="true"
        aria-label="Restaurant photos"
        onClick={(event) => event.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="photo-viewer-head">
          <div>
            <h3>Photos</h3>
            <p>{index + 1} of {photos.length}</p>
          </div>
          <button type="button" className="ghost-button icon-button" onClick={onClose} aria-label="Close photo viewer">
            <X size={18} />
          </button>
        </div>
        <div ref={stageRef} className="photo-viewer-stage" style={{ overflow: "hidden" }}>
          {photos.length > 1 && zoom === 1 ? (
            <button type="button" className="photo-viewer-nav photo-viewer-prev" onClick={() => moveTo(index - 1)} aria-label="Previous photo">
              <ChevronLeft size={18} />
            </button>
          ) : null}
          <img src={photo.imageUrl} alt={photo.description || "Restaurant photo"} className="photo-viewer-image" style={imageStyle} />
          {photos.length > 1 && zoom === 1 ? (
            <button type="button" className="photo-viewer-nav photo-viewer-next" onClick={() => moveTo(index + 1)} aria-label="Next photo">
              <ChevronRight size={18} />
            </button>
          ) : null}
        </div>
        <div className="photo-viewer-copy">
          <strong>{photo.description || "No description yet"}</strong>
          <small>Uploaded by {photo.uploadedByName} on {formatShortDateTime(photo.createdAt)}</small>
        </div>
        {photos.length > 1 ? (
          <div className="photo-viewer-strip" role="tablist" aria-label="Photo thumbnails">
            {photos.map((item, itemIndex) => (
              <button
                type="button"
                key={item.id}
                className={`photo-viewer-strip-button ${itemIndex === index ? "active" : ""}`}
                onClick={() => moveTo(itemIndex)}
                aria-label={`View photo ${itemIndex + 1}`}
              >
                <img src={item.thumbnailUrl} alt="" className="photo-viewer-strip-image" />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
