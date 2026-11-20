"use client";

// Thumbnails are local object URLs of photos just taken; next/image has nothing to optimize.
/* eslint-disable @next/next/no-img-element */

/**
 * The in-app camera behind Take photo: a full-screen viewfinder (getUserMedia), so several photos can be taken in a
 * row without leaving the page for the phone's camera app, where the browser sits in the background and the phone may
 * close the page to free memory. Done hands the photos to the normal upload path; "Camera app" and "Gallery" hand over
 * to the file inputs, keeping the photos already taken. Photos are held only as JPEG files.
 *
 * The camera is on only while this is shown: every track is stopped when it unmounts or the page is hidden, so the
 * camera light goes off.
 */

import { useEffect, useEffectEvent, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Camera, Check, Focus, ImagePlus, LoaderCircle, X } from "lucide-react";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { cameraSession, type CameraShot } from "@/hooks/use-camera-session";
import {
  cameraFailureReason,
  canTapToFocus,
  focusAt,
  isCameraRefusal,
  keepFocused,
  openCamera,
  photoFileName,
  stopStream,
  storage,
  takeWarmCamera,
} from "@/lib/camera-pick";

/** JPEG quality for photos taken here; the server resizes them again on upload. */
const JPEG_QUALITY = 0.9;

/**
 * The photo is the frame on screen when the shutter is pressed, so the shot takes ~15 ms. (`ImageCapture.takePhoto`
 * switches Android cameras into still mode and refocuses on every shot: 2–4 s each.)
 */
async function frameToFile(frame: ImageBitmap, n: number): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = frame.width;
  canvas.height = frame.height;
  try {
    canvas.getContext("2d")?.drawImage(frame, 0, 0);
    frame.close();
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't save the photo."))), "image/jpeg", JPEG_QUALITY),
    );
    return new File([blob], photoFileName(new Date(), n), { type: "image/jpeg" });
  } finally {
    frame.close();
    // Phones count canvas memory against a hard limit and free it late: empty it now.
    canvas.width = 0;
    canvas.height = 0;
  }
}

/**
 * The photos taken are kept in `cameraSession` (not here), so they survive this overlay remounting when the phone
 * turns and the layout changes. The parent ends the session on Done, Close, Back and the hand-overs.
 */
export function PhotoCamera({
  shots,
  onDone,
  onClose,
  onCameraApp,
  onGallery,
  onRefused,
}: {
  shots: CameraShot[];
  /** Upload the photos taken (at least one). */
  onDone: () => void;
  onClose: () => void;
  /** Use the phone's camera app, keeping the photos taken. Called from the tap, so it may open the chooser. */
  onCameraApp: () => void;
  /** Choose from the library, keeping the photos taken. Called from the tap. */
  onGallery: () => void;
  /** The camera was refused for this site: later taps on Take photo go straight to the camera app. */
  onRefused: () => void;
}) {
  const [saving, setSaving] = useState(0);
  const [failed, setFailed] = useState<string | null>(null);
  const close = useEffectEvent(onClose);

  useBodyScrollLock(true, { touchNone: true });

  // Escape closes the camera only, not a dialog or pane underneath.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopImmediatePropagation();
      event.preventDefault();
      close();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  function take(frame: ImageBitmap) {
    const shot = cameraSession.nextShot();
    if (!shot) {
      frame.close();
      return;
    }
    setSaving((n) => n + 1);
    frameToFile(frame, shot.n)
      .then((file) => cameraSession.add(shot.sessionId, file))
      .catch(() => {})
      .finally(() => setSaving((n) => n - 1));
  }

  function fail(error: unknown) {
    if (isCameraRefusal(error)) onRefused();
    setFailed(cameraFailureReason(error));
  }

  return createPortal(
    <div className="camera-overlay" role="dialog" aria-modal="true" aria-label="Take photos">
      <header className="camera-head">
        <button type="button" className="camera-head-button" onClick={onClose} aria-label="Close camera">
          <X size={22} />
        </button>
        <h2>
          Photo
          {shots.length > 0 ? <span className="camera-head-count"> · {shots.length} taken</span> : null}
        </h2>
        <span className="camera-head-button" aria-hidden="true" />
      </header>

      {shots.length > 0 ? (
        <ul className="camera-shots" aria-label="Photos taken">
          {shots.map((shot, index) => (
            <li key={shot.thumb}>
              <img src={shot.thumb} alt={`Photo ${index + 1}`} />
              <button type="button" onClick={() => cameraSession.remove(shot.thumb)} aria-label={`Remove photo ${index + 1}`}>
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {failed ? (
        <>
          <div className="camera-stage camera-message">
            <p>{failed}</p>
            <button type="button" onClick={() => onCameraApp()}>
              <Camera size={18} /> Open camera app
            </button>
          </div>
          {shots.length > 0 ? (
            <footer className="camera-foot">
              <div className="camera-side" />
              <div className="camera-side">
                <CameraButton label="Done" icon={<Check size={24} strokeWidth={2.6} />} primary count={shots.length} onClick={() => onDone()} />
              </div>
            </footer>
          ) : null}
        </>
      ) : (
        <Viewfinder
          onPhoto={take}
          onFail={fail}
          left={
            <>
              <CameraButton label="Camera app" icon={<Camera size={22} />} disabled={saving > 0} onClick={() => onCameraApp()} />
              <CameraButton label="Gallery" icon={<ImagePlus size={22} />} disabled={saving > 0} onClick={() => onGallery()} />
            </>
          }
          right={
            shots.length > 0 ? (
              <CameraButton
                label="Done"
                icon={<Check size={24} strokeWidth={2.6} />}
                primary
                count={shots.length}
                disabled={saving > 0}
                onClick={() => onDone()}
              />
            ) : null
          }
        />
      )}
    </div>,
    document.body,
  );
}

function Viewfinder({
  onPhoto,
  onFail,
  left,
  right,
}: {
  /** The frame on screen when the shutter was pressed (the receiver closes it). */
  onPhoto: (frame: ImageBitmap) => void;
  /** The camera cannot be used (refused, missing, busy). */
  onFail: (error: unknown) => void;
  left?: ReactNode;
  right?: ReactNode;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [shooting, setShooting] = useState(false);
  // Bumped on each shot: a quick white flash over the picture says the photo was taken.
  const [flash, setFlash] = useState(0);
  const [tappable, setTappable] = useState(false);
  // Where the last tap-to-focus was (CSS px in the frame), shown as a ring for a moment.
  const [ring, setRing] = useState<{ x: number; y: number; key: number } | null>(null);
  // The picture's shape (width / height): the frame around the video is exactly the picture, so overlays sit on it.
  const [shape, setShape] = useState(3 / 4);
  const fail = useEffectEvent(onFail);

  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      if (streamRef.current || document.hidden) return;
      try {
        // Started by the Take photo tap where it could be (`warmCamera`), so it opens while this overlay appears.
        const stream = await (takeWarmCamera() ?? openCamera(navigator.mediaDevices, storage()));
        // Closed, hidden, or a second start won the race while this one waited: keep only one stream.
        if (cancelled || document.hidden || streamRef.current) return stopStream(stream);
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play().catch(() => {});
        if (cancelled || streamRef.current !== stream) return;
        // Some phones only report focus controls once the picture is flowing.
        const track = stream.getVideoTracks()[0];
        keepFocused(track);
        setTappable(canTapToFocus(track));
        setReady(true);
      } catch (error) {
        if (!cancelled) fail(error);
      }
    };
    const end = () => {
      stopStream(streamRef.current);
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setReady(false);
    };
    // A hidden page keeps no camera: stop it, and start again when the page is back.
    const onVisibility = () => (document.hidden ? end() : void start());
    document.addEventListener("visibilitychange", onVisibility);
    void start();
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      end();
    };
  }, []);

  async function shoot() {
    const video = videoRef.current;
    if (!video || !streamRef.current || shooting) return;
    setShooting(true);
    try {
      const frame = await createImageBitmap(video);
      setFlash((n) => n + 1);
      onPhoto(frame);
    } catch {
      // A frame that could not be read is simply not taken.
    } finally {
      setShooting(false);
    }
  }

  /** Tap to focus there: the tap's place in the picture (the frame is exactly the picture). */
  function tapToFocus(event: PointerEvent<HTMLDivElement>) {
    if (!ready) return;
    const box = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width;
    const y = (event.clientY - box.top) / box.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    if (focusAt(streamRef.current?.getVideoTracks()[0], x, y)) {
      setRing({ x: event.clientX - box.left, y: event.clientY - box.top, key: Date.now() });
    }
  }

  function measure() {
    const video = videoRef.current;
    if (video?.videoWidth && video.videoHeight) setShape(video.videoWidth / video.videoHeight);
  }

  return (
    <>
      <div className="camera-stage camera-live">
        <div className="camera-frame" style={{ "--shape": shape } as CSSProperties} onPointerUp={tapToFocus}>
          <video ref={videoRef} playsInline muted autoPlay aria-label="Camera" onLoadedMetadata={measure} onResize={measure} />
          {ring ? (
            <span
              key={ring.key}
              className="camera-focus-ring"
              style={{ left: ring.x, top: ring.y }}
              onAnimationEnd={() => setRing(null)}
              aria-hidden="true"
            />
          ) : null}
          {ready && tappable ? (
            <p className="camera-hint">
              <Focus size={15} aria-hidden="true" />
              Tap to focus
            </p>
          ) : null}
          {flash > 0 ? <span key={flash} className="camera-flash" aria-hidden="true" /> : null}
        </div>
        {!ready ? (
          <p className="camera-starting">
            <LoaderCircle size={18} className="camera-spinner" aria-hidden="true" />
            Starting the camera…
          </p>
        ) : null}
      </div>
      <footer className="camera-foot">
        <div className="camera-side">{left}</div>
        <button type="button" className="camera-shutter" aria-label="Take photo" disabled={!ready || shooting} onClick={() => void shoot()}>
          <span aria-hidden="true" />
        </button>
        <div className="camera-side">{right}</div>
      </footer>
    </>
  );
}

/** A round button beside the shutter: an icon with a caption under it (and a count, for Done). */
function CameraButton({
  label,
  icon,
  onClick,
  disabled,
  primary,
  count,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  count?: number;
}) {
  return (
    <button
      type="button"
      className={`camera-side-button${primary ? " primary" : ""}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={count ? `${label} (${count})` : label}
    >
      <span className="camera-side-icon">
        {icon}
        {count ? <span className="camera-side-count">{count}</span> : null}
      </span>
      <span className="camera-side-label" aria-hidden="true">{label}</span>
    </button>
  );
}
