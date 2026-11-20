/**
 * Which camera the in-app camera opens, and how it focuses. No React here, so it is tested in Node with fake devices
 * (`camera-pick.test.ts`).
 *
 * Phones have several back cameras, and asking for "environment" can land on one that cannot focus (often the
 * ultra-wide, fixed focus), which never takes a sharp close-up of a dish or a menu. So when the camera that opened
 * cannot focus, the other cameras are tried for a back one that can, and the choice is remembered on the device.
 */

/** The parts of `navigator.mediaDevices` used here. */
export interface Media {
  getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream>;
  enumerateDevices(): Promise<{ kind: string; deviceId: string }[]>;
}

/** The parts of `localStorage` used here. */
export interface Store {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const CAMERA_KEY = "munchbase.camera";

/**
 * A sharp 4:3 picture, the shape of phone sensors (2560×1920 ≈ 4.9 MP); cameras that cannot give it pick their nearest
 * size. The photo is a frame of this stream (see photo-camera.tsx), so the stream's size is the photo's size.
 */
const SIZE = { width: { ideal: 2560 }, height: { ideal: 1920 } };

type Caps = { focusMode?: string[]; pointsOfInterest?: unknown };

const errorName = (error: unknown) => (error as { name?: string } | null)?.name;

export const capsOf = (track: MediaStreamTrack | undefined): Caps =>
  (track?.getCapabilities?.() as Caps | undefined) ?? {};

/**
 * Whether the camera can focus. Browsers that do not report capabilities at all (Firefox) are trusted to; a camera
 * that reports them without any focus mode is fixed-focus.
 */
export function canFocus(track: MediaStreamTrack | undefined) {
  if (!track?.getCapabilities) return true;
  return !!capsOf(track).focusMode?.some((mode) => mode === "continuous" || mode === "single-shot");
}

function isBack(track: MediaStreamTrack) {
  const facing = track.getSettings?.().facingMode;
  return facing ? facing === "environment" : !/front|user|face/i.test(track.label);
}

export function stopStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((track) => track.stop());
}

const videoTrack = (stream: MediaStream) => stream.getVideoTracks()[0];

async function backCamera(media: Media) {
  try {
    return await media.getUserMedia({ audio: false, video: { facingMode: { exact: "environment" }, ...SIZE } });
  } catch (error) {
    // No back camera (a laptop): any camera will do. Refusals and busy cameras are real errors.
    const name = errorName(error);
    if (name !== "OverconstrainedError" && name !== "NotFoundError") throw error;
    return media.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, ...SIZE } });
  }
}

const byId = (media: Media, deviceId: string) =>
  media.getUserMedia({ audio: false, video: { deviceId: { exact: deviceId }, ...SIZE } });

/** Open the camera: the remembered one, else a back camera that can focus. */
export async function openCamera(media: Media, store: Store | null): Promise<MediaStream> {
  const saved = store?.getItem(CAMERA_KEY);
  if (saved) {
    try {
      return await byId(media, saved);
    } catch (error) {
      if (errorName(error) === "NotAllowedError") throw error;
      store?.removeItem(CAMERA_KEY); // unplugged or renumbered: choose again
    }
  }
  let stream = await backCamera(media);
  const first = videoTrack(stream);
  const firstId = first?.getSettings?.().deviceId;
  if (!first || canFocus(first)) {
    if (firstId) store?.setItem(CAMERA_KEY, firstId);
    return stream;
  }
  // This lens cannot focus: try the others, one at a time (phones cannot open two cameras at once).
  const others = (await media.enumerateDevices()).filter((d) => d.kind === "videoinput" && d.deviceId !== firstId);
  stopStream(stream);
  for (const device of others) {
    try {
      stream = await byId(media, device.deviceId);
    } catch {
      continue;
    }
    const track = videoTrack(stream);
    if (track && isBack(track) && canFocus(track)) {
      store?.setItem(CAMERA_KEY, device.deviceId);
      return stream;
    }
    stopStream(stream);
  }
  // None can focus: the first one it is (remembered, so the search is not repeated every time).
  stream = firstId ? await byId(media, firstId) : await backCamera(media);
  if (firstId) store?.setItem(CAMERA_KEY, firstId);
  return stream;
}

const apply = (track: MediaStreamTrack, constraints: Record<string, unknown>) =>
  track.applyConstraints({ advanced: [constraints as MediaTrackConstraintSet] }).catch(() => {});

/** Keep refocusing on its own, where the camera lets us choose. */
export function keepFocused(track: MediaStreamTrack | undefined) {
  if (track && capsOf(track).focusMode?.includes("continuous")) void apply(track, { focusMode: "continuous" });
}

/** Whether tapping can focus this camera (on a point, or at least a one-off refocus). */
export function canTapToFocus(track: MediaStreamTrack | undefined) {
  const caps = capsOf(track);
  return caps.pointsOfInterest !== undefined || !!caps.focusMode?.includes("single-shot");
}

/** How long a tap-to-focus holds before the camera goes back to refocusing on its own. */
export const TAP_FOCUS_MS = 3000;

/**
 * Focus on a point (0–1 across and down the picture), like tapping in a camera app. Returns false when the camera
 * cannot do it. Goes back to refocusing on its own after a few seconds, still weighted to that point.
 */
export function focusAt(track: MediaStreamTrack | undefined, x: number, y: number): boolean {
  if (!track || !canTapToFocus(track)) return false;
  const caps = capsOf(track);
  const modes = caps.focusMode ?? [];
  const point = caps.pointsOfInterest !== undefined ? { pointsOfInterest: [{ x, y }] } : {};
  void apply(track, { ...point, focusMode: modes.includes("single-shot") ? "single-shot" : "continuous" }).then(() => {
    if (!modes.includes("continuous")) return;
    setTimeout(() => {
      if (track.readyState === "live") void apply(track, { ...point, focusMode: "continuous" });
    }, TAP_FOCUS_MS);
  });
  return true;
}

/** localStorage, where the browser allows it (private modes may refuse). */
export function storage(): Store | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Whether this browser can show a live camera here: a camera API, on https or localhost. */
export function canUseCamera() {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    globalThis.isSecureContext !== false
  );
}

/** Why the camera could not start, shown above the "Open camera app" button. */
export function cameraFailureReason(error: unknown) {
  const name = errorName(error);
  if (name === "NotAllowedError" || name === "SecurityError") return "Camera access is off for this site.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No camera found on this device.";
  if (name === "NotReadableError" || name === "AbortError") return "The camera is busy in another app.";
  return "The camera couldn't start.";
}

export const isCameraRefusal = (error: unknown) => {
  const name = errorName(error);
  return name === "NotAllowedError" || name === "SecurityError";
};

/**
 * Opening a camera takes about 1 s on a real phone, whatever the picture size, so the Take photo button starts it on
 * the tap while the overlay appears; the overlay then takes it over (`takeWarmCamera`). A camera nobody takes within a
 * few seconds is stopped, so its light never stays on.
 */
let warm: Promise<MediaStream> | null = null;
let warmTimer: ReturnType<typeof setTimeout> | undefined;
export const UNCLAIMED_MS = 8000;

export function warmCamera(media: Media | undefined = globalThis.navigator?.mediaDevices, store = storage()) {
  if (warm || !media?.getUserMedia) return;
  const opening = openCamera(media, store);
  opening.catch(() => {}); // reported by whoever takes it
  warm = opening;
  warmTimer = setTimeout(() => {
    if (warm !== opening) return;
    warm = null;
    void opening.then(stopStream, () => {});
  }, UNCLAIMED_MS);
}

/** The camera started by the last tap, if it has not been taken (or stopped) yet. */
export function takeWarmCamera(): Promise<MediaStream> | null {
  const taken = warm;
  warm = null;
  clearTimeout(warmTimer);
  return taken;
}

/** `photo-2026-11-20-143005.jpg`, with `-2`, `-3`… for later shots in the same session. */
export function photoFileName(date: Date, n: number) {
  const pad = (value: number) => String(value).padStart(2, "0");
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `photo-${day}-${time}${n > 1 ? `-${n}` : ""}.jpg`;
}
