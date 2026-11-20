import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CAMERA_KEY,
  UNCLAIMED_MS,
  canFocus,
  canTapToFocus,
  cameraFailureReason,
  focusAt,
  keepFocused,
  openCamera,
  photoFileName,
  takeWarmCamera,
  warmCamera,
  type Media,
  type Store,
} from "./camera-pick";

interface FakeCam {
  id: string;
  facing: "environment" | "user";
  focus?: string[];
  poi?: boolean;
  /** No getCapabilities at all (Firefox). */
  noCaps?: boolean;
}

const named = (name: string) => Object.assign(new Error(name), { name });

/** A phone: cameras in the order the browser lists them; `facingMode: environment` opens `envPick`. */
function phone(cams: FakeCam[], envPick = cams.find((c) => c.facing === "environment")?.id, refuse?: string) {
  const opened: string[] = [];
  const live = new Set<string>();
  const applied: unknown[] = [];
  const stream = (cam: FakeCam) => {
    if (live.size) throw named("NotReadableError"); // one camera at a time
    live.add(cam.id);
    opened.push(cam.id);
    const track = {
      label: cam.facing === "user" ? "camera2 1, facing front" : "camera2 0, facing back",
      get readyState() {
        return live.has(cam.id) ? "live" : "ended";
      },
      getSettings: () => ({ deviceId: cam.id, facingMode: cam.facing }),
      ...(cam.noCaps
        ? {}
        : {
          getCapabilities: () => ({
            ...(cam.focus ? { focusMode: cam.focus } : {}),
            ...(cam.poi ? { pointsOfInterest: {} } : {}),
          }),
        }),
      applyConstraints: async (constraints: unknown) => void applied.push(constraints),
      stop: () => live.delete(cam.id),
    } as unknown as MediaStreamTrack;
    return { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream;
  };
  const media: Media = {
    async getUserMedia(constraints) {
      if (refuse) throw named(refuse);
      const video = constraints.video as { deviceId?: { exact: string }; facingMode?: { exact?: string } };
      if (video.deviceId) {
        const cam = cams.find((c) => c.id === video.deviceId!.exact);
        if (!cam) throw named("OverconstrainedError");
        return stream(cam);
      }
      const cam = cams.find((c) => c.id === envPick);
      if (!cam) {
        if (video.facingMode?.exact) throw named("OverconstrainedError");
        return stream(cams[0]!);
      }
      return stream(cam);
    },
    enumerateDevices: async () => cams.map((c) => ({ kind: "videoinput", deviceId: c.id })),
  };
  return { media, opened, live, applied };
}

function memory(): Store & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

const AF = ["manual", "single-shot", "continuous"];
const idOf = (stream: MediaStream) => stream.getVideoTracks()[0]!.getSettings().deviceId;
const trackOf = (stream: MediaStream) => stream.getVideoTracks()[0];

afterEach(() => {
  vi.useRealTimers();
  takeWarmCamera();
});

describe("openCamera", () => {
  it("keeps the back camera that opened when it can focus, and remembers it", async () => {
    const p = phone([
      { id: "main", facing: "environment", focus: AF },
      { id: "front", facing: "user", focus: AF },
    ]);
    const store = memory();
    expect(idOf(await openCamera(p.media, store))).toBe("main");
    expect(p.opened).toEqual(["main"]);
    expect(store.data.get(CAMERA_KEY)).toBe("main");
  });

  it("moves off a fixed-focus lens (the ultra-wide) to a back camera that can focus", async () => {
    const p = phone(
      [
        { id: "wide", facing: "environment", focus: ["manual"] },
        { id: "front", facing: "user", focus: AF },
        { id: "main", facing: "environment", focus: AF },
      ],
      "wide",
    );
    const store = memory();
    const stream = await openCamera(p.media, store);
    expect(idOf(stream)).toBe("main");
    expect(p.opened).toEqual(["wide", "front", "main"]); // the front camera is skipped though it can focus
    expect(p.live).toEqual(new Set(["main"])); // nothing else left running
    expect(store.data.get(CAMERA_KEY)).toBe("main");

    // Next time: straight to the remembered camera.
    stream.getTracks().forEach((track) => track.stop());
    p.opened.length = 0;
    expect(idOf(await openCamera(p.media, store))).toBe("main");
    expect(p.opened).toEqual(["main"]);
  });

  it("settles for the first camera when none can focus, without searching again", async () => {
    const p = phone(
      [
        { id: "a", facing: "environment" },
        { id: "b", facing: "environment" },
      ],
      "a",
    );
    const store = memory();
    expect(idOf(await openCamera(p.media, store))).toBe("a");
    expect(store.data.get(CAMERA_KEY)).toBe("a");
    expect(p.live).toEqual(new Set(["a"]));
  });

  it("trusts a browser that reports no capabilities (Firefox)", async () => {
    const p = phone([
      { id: "ff", facing: "environment", noCaps: true },
      { id: "other", facing: "environment", focus: AF },
    ]);
    expect(idOf(await openCamera(p.media, memory()))).toBe("ff");
    expect(p.opened).toEqual(["ff"]);
  });

  it("chooses again when the remembered camera is gone, and uses any camera without a back one", async () => {
    const p = phone([{ id: "webcam", facing: "user", focus: AF }], undefined);
    const store = memory();
    store.setItem(CAMERA_KEY, "old-phone-camera");
    expect(idOf(await openCamera(p.media, store))).toBe("webcam");
    expect(store.data.get(CAMERA_KEY)).toBe("webcam");
  });

  it("keeps the remembered camera and gives up at once when the camera is refused", async () => {
    const p = phone([{ id: "main", facing: "environment", focus: AF }], "main", "NotAllowedError");
    const store = memory();
    store.setItem(CAMERA_KEY, "main");
    await expect(openCamera(p.media, store)).rejects.toMatchObject({ name: "NotAllowedError" });
    expect(store.data.get(CAMERA_KEY)).toBe("main");
  });

  it("does not retry without a back camera when the camera is busy", async () => {
    const calls: unknown[] = [];
    const media: Media = {
      getUserMedia: async (constraints) => {
        calls.push(constraints);
        throw named("NotReadableError");
      },
      enumerateDevices: async () => [],
    };
    await expect(openCamera(media, null)).rejects.toMatchObject({ name: "NotReadableError" });
    expect(calls).toHaveLength(1);
  });
});

describe("focus", () => {
  it("treats browsers without capabilities as able to focus", () => {
    expect(canFocus({} as MediaStreamTrack)).toBe(true);
  });

  it("keeps focusing on its own where the camera supports it", async () => {
    const p = phone([{ id: "main", facing: "environment", focus: AF }]);
    keepFocused(trackOf(await openCamera(p.media, null)));
    expect(p.applied).toContainEqual({ advanced: [{ focusMode: "continuous" }] });
  });

  it("taps to focus at a point, then goes back to continuous, and says when the camera can't", async () => {
    vi.useFakeTimers();
    const p = phone([{ id: "main", facing: "environment", focus: AF, poi: true }]);
    const track = trackOf(await openCamera(p.media, null));
    expect(canTapToFocus(track)).toBe(true);
    expect(focusAt(track, 0.25, 0.5)).toBe(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(p.applied).toContainEqual({
      advanced: [{ pointsOfInterest: [{ x: 0.25, y: 0.5 }], focusMode: "single-shot" }],
    });
    await vi.advanceTimersByTimeAsync(3000);
    expect(p.applied.at(-1)).toEqual({
      advanced: [{ pointsOfInterest: [{ x: 0.25, y: 0.5 }], focusMode: "continuous" }],
    });

    const fixed = phone([{ id: "f", facing: "environment", focus: ["manual"] }]);
    const fixedTrack = trackOf(await openCamera(fixed.media, null));
    expect(canTapToFocus(fixedTrack)).toBe(false);
    expect(focusAt(fixedTrack, 0.5, 0.5)).toBe(false);
  });
});

describe("warmCamera", () => {
  it("hands the stream started on the tap to the overlay", async () => {
    const p = phone([{ id: "main", facing: "environment", focus: AF }]);
    warmCamera(p.media, null);
    const taken = takeWarmCamera();
    expect(taken).not.toBeNull();
    expect(idOf(await taken!)).toBe("main");
    expect(takeWarmCamera()).toBeNull();
  });

  it("stops a camera nobody takes, so its light goes off", async () => {
    vi.useFakeTimers();
    const p = phone([{ id: "main", facing: "environment", focus: AF }]);
    warmCamera(p.media, null);
    await vi.advanceTimersByTimeAsync(0);
    expect(p.live).toEqual(new Set(["main"]));
    await vi.advanceTimersByTimeAsync(UNCLAIMED_MS);
    expect(p.live.size).toBe(0);
    expect(takeWarmCamera()).toBeNull();
  });
});

describe("helpers", () => {
  it("names photos by date and time, numbering later shots", () => {
    const at = new Date(2026, 10, 20, 9, 5, 7);
    expect(photoFileName(at, 1)).toBe("photo-2026-11-20-090507.jpg");
    expect(photoFileName(at, 3)).toBe("photo-2026-11-20-090507-3.jpg");
  });

  it("explains why the camera could not start", () => {
    expect(cameraFailureReason(named("NotAllowedError"))).toMatch(/access is off/);
    expect(cameraFailureReason(named("NotFoundError"))).toMatch(/No camera/);
    expect(cameraFailureReason(named("NotReadableError"))).toMatch(/busy/);
    expect(cameraFailureReason(new Error("?"))).toMatch(/couldn't start/);
  });
});
