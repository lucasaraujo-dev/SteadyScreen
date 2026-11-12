// Decides whether this device should get the animated Three.js background or
// the static CSS one. Weak machines must never pay for a decoration.

const STORAGE_KEY = "steadyscreen:background";

export type StaticReason =
  | "forced" // ?bg=static in the URL
  | "remembered" // this browser was too slow on a previous visit
  | "reduced-motion" // OS setting "reduce animations"
  | "save-data" // data saver turned on
  | "weak-cpu"
  | "low-memory"
  | "no-webgl"
  | "software-gpu" // no real GPU, WebGL emulated on the CPU
  | "slow"; // measured: frames took too long

/** Checks that need no WebGL. Returns a reason to stay static, or null. */
export function staticReasonBeforeStart(): StaticReason | null {
  const forced = new URLSearchParams(window.location.search).get("bg");
  if (forced === "static") return "forced";
  if (forced === "animated") return null; // for testing on any machine

  try {
    if (localStorage.getItem(STORAGE_KEY) === "static") return "remembered";
  } catch {}

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "reduced-motion";

  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  if (nav.connection?.saveData) return "save-data";
  if (nav.hardwareConcurrency && nav.hardwareConcurrency <= 2) return "weak-cpu";
  if (nav.deviceMemory && nav.deviceMemory <= 2) return "low-memory"; // Chrome/Edge only
  return null;
}

/** True when WebGL is running on a CPU emulator instead of a graphics card. */
export function isSoftwareRenderer(gl: WebGLRenderingContext | WebGL2RenderingContext): boolean {
  let name = "";
  try {
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    name = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
  } catch {}
  return /swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic/i.test(name);
}

export type WatchdogVerdict = "ok" | "reduce" | "static";

/**
 * Watches frame times. After a warm-up it takes the median of each batch of
 * frames: the first slow batch asks for lower resolution, the second one
 * (after another warm-up) gives up on animation.
 */
export class FrameWatchdog {
  private watchFrom: number;
  private samples: number[] = [];
  private reduced = false;

  constructor(
    now: number,
    private warmupMs = 1500,
    private batch = 90,
    private slowFrameMs = 1000 / 28, // a 30 Hz monitor (33 ms) is not "slow"
  ) {
    this.watchFrom = now + warmupMs;
  }

  /** Call after a pause (e.g. hidden tab) so the gap isn't counted. */
  reset(now: number) {
    this.watchFrom = now + this.warmupMs;
    this.samples = [];
  }

  frame(now: number, dt: number): WatchdogVerdict {
    if (now < this.watchFrom) return "ok";
    this.samples.push(dt);
    if (this.samples.length < this.batch) return "ok";

    this.samples.sort((a, b) => a - b);
    const median = this.samples[this.samples.length >> 1];
    this.samples = [];
    if (median <= this.slowFrameMs) return "ok";
    if (this.reduced) return "static";
    this.reduced = true;
    this.watchFrom = now + this.warmupMs;
    return "reduce";
  }
}

/** Remember a measured failure so the next visit starts static right away. */
export function rememberStatic(reason: StaticReason) {
  if (reason !== "slow" && reason !== "software-gpu") return;
  try {
    localStorage.setItem(STORAGE_KEY, "static");
  } catch {}
}
