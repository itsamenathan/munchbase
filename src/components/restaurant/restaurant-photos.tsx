"use client";

import { startTransition, useEffect, useRef, useState, type TouchEvent } from "react";
import { ChevronLeft, ChevronRight, Pencil, Trash2, X } from "lucide-react";
import { deleteRestaurantPhoto, updateRestaurantPhotoDescription, uploadRestaurantPhoto } from "@/app/actions";
import { formatShortDateTime } from "@/lib/datetime";
import { useHaptics } from "@/hooks/use-haptics";
import type { Restaurant, RestaurantPhoto } from "@/lib/types";

export function RestaurantPhotos({ canWrite, entry }: { canWrite: boolean; entry: Restaurant }) {
  const haptics = useHaptics();
  const uploadFormRef = useRef<HTMLFormElement>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  return (
    <section className="photo-section">
      <div className="section-head">
        <h4>Photos</h4>
        {entry.photos.length ? <span className="pill">{entry.photos.length}</span> : null}
      </div>

      {canWrite ? (
        <form
          ref={uploadFormRef}
          action={async (formData) => {
            await uploadRestaurantPhoto(formData);
            haptics.success();
            uploadFormRef.current?.reset();
          }}
          className="photo-upload-form"
        >
          <input type="hidden" name="restaurantId" value={entry.id} />
          <label className="photo-upload-field">
            <span>Add restaurant photo</span>
            <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required />
          </label>
          <label className="photo-upload-field photo-upload-description">
            <span>Description</span>
            <textarea name="description" rows={2} placeholder="What is shown in this photo?" maxLength={280} />
          </label>
          <button type="submit" className="compact-button">Upload photo</button>
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
  const haptics = useHaptics();
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
            action={async (formData) => {
              await deleteRestaurantPhoto(formData);
              haptics.success();
              onDelete();
            }}
          >
            <input type="hidden" name="photoId" value={photo.id} />
            <button type="submit" className="ghost-button icon-button compact-icon-button photo-delete-button" aria-label="Delete photo">
              <Trash2 size={14} />
            </button>
          </form>
        </div>
      ) : null}
      {editing ? (
        <form
          action={async (formData) => {
            await updateRestaurantPhotoDescription(formData);
            haptics.success();
            setEditing(false);
          }}
          className="photo-card-edit"
        >
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
  const startX = useRef<number | null>(null);
  const currentX = useRef<number | null>(null);

  useEffect(() => {
    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousTouchAction = body.style.touchAction;
    body.style.overflow = "hidden";
    body.style.touchAction = "none";
    return () => {
      body.style.overflow = previousOverflow;
      body.style.touchAction = previousTouchAction;
    };
  }, []);

  const index = currentIndex >= 0 && currentIndex < photos.length ? currentIndex : 0;
  const photo = photos[index] ?? photos[0];
  if (!photo) return null;

  const moveTo = (nextIndex: number) => {
    if (!photos.length) return;
    const bounded = (nextIndex + photos.length) % photos.length;
    startTransition(() => setCurrentIndex(bounded));
  };

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    startX.current = event.touches[0].clientX;
    currentX.current = event.touches[0].clientX;
  };

  const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    currentX.current = event.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (startX.current === null || currentX.current === null) return;
    const delta = currentX.current - startX.current;
    if (Math.abs(delta) > 40) {
      moveTo(index + (delta < 0 ? 1 : -1));
    }
    startX.current = null;
    currentX.current = null;
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
        <div className="photo-viewer-stage">
          {photos.length > 1 ? (
            <button type="button" className="photo-viewer-nav photo-viewer-prev" onClick={() => moveTo(index - 1)} aria-label="Previous photo">
              <ChevronLeft size={18} />
            </button>
          ) : null}
          <img src={photo.imageUrl} alt={photo.description || "Restaurant photo"} className="photo-viewer-image" />
          {photos.length > 1 ? (
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
