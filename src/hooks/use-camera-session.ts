import { useSyncExternalStore } from "react";

/**
 * The in-app camera's open session: which Restaurant it is for and the photos taken so far. It lives at module level,
 * not in component state, because turning a phone sideways can cross the 760px layout breakpoint, and AppShell then
 * remounts the Restaurant detail (and the camera with it). The camera reopens on the new layout with the photos kept.
 */
export type CameraShot = { file: File; thumb: string };
type Session = { id: number; restaurantId: number; shots: CameraShot[]; taken: number };

let session: Session | null = null;
let nextId = 1;
const listeners = new Set<() => void>();

function set(next: Session | null) {
  session = next;
  listeners.forEach((listener) => listener());
}

export const cameraSession = {
  start(restaurantId: number) {
    cameraSession.end();
    set({ id: nextId++, restaurantId, shots: [], taken: 0 });
  },

  /** Close the session and hand back the photos taken. Their thumbnails are let go. */
  end(): File[] {
    const ended = session;
    if (!ended) return [];
    ended.shots.forEach((shot) => URL.revokeObjectURL(shot.thumb));
    set(null);
    return ended.shots.map((shot) => shot.file);
  },

  /** Number the next shot (1, 2, …) and say which session it belongs to. */
  nextShot(): { sessionId: number; n: number } | null {
    if (!session) return null;
    session = { ...session, taken: session.taken + 1 };
    return { sessionId: session.id, n: session.taken };
  },

  /** Keep a saved photo, unless its session has ended since the shutter was pressed. */
  add(sessionId: number, file: File) {
    if (session?.id !== sessionId) return;
    set({ ...session, shots: [...session.shots, { file, thumb: URL.createObjectURL(file) }] });
  },

  remove(thumb: string) {
    if (!session) return;
    URL.revokeObjectURL(thumb);
    set({ ...session, shots: session.shots.filter((shot) => shot.thumb !== thumb) });
  },
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCameraSession() {
  return useSyncExternalStore(subscribe, () => session, () => null);
}
