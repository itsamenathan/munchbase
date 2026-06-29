"use client";

import { startTransition, useEffect, useRef, useState, type TouchEvent } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ImagePlus, Pencil, Trash2, X } from "lucide-react";
import { formatShortDateTime } from "@/lib/datetime";
import type { Restaurant, RestaurantPhoto } from "@/lib/types";

export function RestaurantPhotos({ canWrite, entry }: { canWrite: boolean; entry: Restaurant }) {
  const router = useRouter();
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [selectedFileCount, setSelectedFileCount] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fileInput = form.elements.namedItem("photo") as HTMLInputElement;
    const files = Array.from(fileInput.files ?? []);
    if (!files.length) { setUploadError("Choose at least one image to upload."); return; }

    const description = (form.elements.namedItem("description") as HTMLTextAreaElement).value;
    const restaurantId = (form.elements.namedItem("restaurantId") as HTMLInputElement).value;

    setUploadProgress({ done: 0, total: files.length });
    setUploadError(null);

    const results = await Promise.allSettled(files.map(async (file) => {
      const fd = new FormData();
      fd.append("__action", "uploadRestaurantPhoto");
      fd.append("restaurantId", restaurantId);
      fd.append("photo", file);
      if (description) fd.append("description", description);
      const res = await fetch("/mutate", { method: "POST", body: fd });
      const finalUrl = new URL(res.url);
      const mutationError = finalUrl.searchParams.get("message");
      if (mutationError) throw new Error(mutationError);
      setUploadProgress((prev) => prev ? { ...prev, done: prev.done + 1 } : null);
    }));

    const failures = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    const anySuccess = results.some((r) => r.status === "fulfilled");

    if (failures.length) {
      const msg = failures.length === 1
        ? failures[0].reason instanceof Error ? failures[0].reason.message : "One photo failed to upload."
        : `${failures.length} photos failed to upload.`;
      setUploadError(msg);
    }

    if (anySuccess) {
      form.reset();
      setSelectedFileCount(0);
      router.refresh();
    }

    setUploadProgress(null);
  }

  const uploading = uploadProgress !== null;
  const buttonLabel = uploading
    ? `Uploading ${uploadProgress.done + 1} of ${uploadProgress.total}…`
    : selectedFileCount > 1 ? `Upload ${selectedFileCount} photos` : "Upload photo";

  return (
    <section className="photo-section">
      <div className="section-head">
        <h4>Photos</h4>
        {entry.photos.length ? <span className="pill">{entry.photos.length}</span> : null}
      </div>

      {canWrite ? (
        <form onSubmit={handleUpload} className="photo-upload-form">
          <input type="hidden" name="restaurantId" value={entry.id} />
          <label className={`photo-upload-zone${selectedFileCount > 0 ? " has-file" : ""}`}>
            <input
              name="photo"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              required
              className="photo-upload-input"
              onChange={(e) => { setSelectedFileCount(e.target.files?.length ?? 0); setUploadError(null); }}
            />
            <ImagePlus size={22} />
            <div className="photo-upload-zone-text">
              <span>{selectedFileCount === 0 ? "Add photos" : selectedFileCount === 1 ? "1 photo selected" : `${selectedFileCount} photos selected`}</span>
              {selectedFileCount === 0 ? <small>JPEG, PNG or WebP</small> : null}
            </div>
          </label>
          {uploadError ? <p className="upload-error">{uploadError}</p> : null}
          {selectedFileCount > 0 ? (
            <>
              <label className="photo-upload-field photo-upload-description">
                <span>Description <small>(optional)</small></span>
                <textarea name="description" rows={2} placeholder="What's shown in these photos?" maxLength={280} />
              </label>
              <button type="submit" className="compact-button" disabled={uploading}>{buttonLabel}</button>
            </>
          ) : null}
        </form>
      ) : null}

      {entry.photos.length ? (
        <>
          <div className="photo-grid">
            {entry.photos.map((photo, index) => (
              <PhotoCard
                canWrite={canWrite}
                key={photo.id}
                photo={photo}
                onOpen={() => setViewerIndex(index)}
                onDelete={() => {
                  if (viewerIndex !== null && entry.photos[viewerIndex]?.id === photo.id) {
                    setViewerIndex(null);
                  }
                }}
              />
            ))}
          </div>
          {viewerIndex !== null ? (
            <PhotoViewer
              key={viewerIndex}
              photos={entry.photos}
              initialIndex={viewerIndex}
              onClose={() => setViewerIndex(null)}
            />
          ) : null}
        </>
      ) : (
        <p className="muted">No photos yet.</p>
      )}
    </section>
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
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState(photo.description ?? "");

  return (
    <article className="photo-card">
      <button type="button" className="photo-thumb-button" onClick={onOpen} aria-label={`Open photo uploaded by ${photo.uploadedByName}`}>
        <img src={photo.thumbnailUrl} alt={photo.description || "Restaurant photo"} className="photo-thumb" loading="lazy" />
      </button>
      {canWrite && !editing ? (
        <div className="photo-card-toolbar">
          <button type="button" className="ghost-button icon-button compact-icon-button" onClick={() => setEditing(true)} aria-label="Edit photo description">
            <Pencil size={14} />
          </button>
          <form
            action="/mutate" method="post"
          >
            <input type="hidden" name="__action" value="deleteRestaurantPhoto" />
            <input type="hidden" name="photoId" value={photo.id} />
            <button type="submit" className="ghost-button icon-button compact-icon-button photo-delete-button" aria-label="Delete photo">
              <Trash2 size={14} />
            </button>
          </form>
        </div>
      ) : null}
      {editing ? (
        <form
          action="/mutate" method="post"
          className="photo-card-edit"
        >
          <input type="hidden" name="__action" value="updateRestaurantPhotoDescription" />
          <input type="hidden" name="photoId" value={photo.id} />
          <label className="photo-upload-field">
            <span>Description</span>
            <textarea name="description" rows={2} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={280} />
          </label>
          <div className="photo-card-actions">
            <button type="submit" className="compact-button">Save</button>
            <button type="button" className="ghost-button compact-button" onClick={() => { setDescription(photo.description ?? ""); setEditing(false); }}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="photo-card-copy">
          <strong>{photo.description || "No description yet"}</strong>
        </div>
      )}
    </article>
  );
}

function PhotoViewer({
  photos,
  initialIndex,
  onClose,
}: {
  photos: RestaurantPhoto[];
  initialIndex: number;
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

  useEffect(() => {
    const { body } = document;
    const prev = { overflow: body.style.overflow, touchAction: body.style.touchAction };
    body.style.overflow = "hidden";
    body.style.touchAction = "none";
    return () => {
      body.style.overflow = prev.overflow;
      body.style.touchAction = prev.touchAction;
    };
  }, []);


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
