// Where we hear the room (output device) and the "stop listening" shortcut.

export type AudioSettings = {
  /** "" = the system default speakers/headphones. */
  outputId: string;
  deafenShortcut: boolean;
  /** KeyboardEvent.code that toggles "stop listening". */
  deafenKey: string;
};

export const DEFAULT_AUDIO: AudioSettings = {
  outputId: "",
  deafenShortcut: false,
  deafenKey: "KeyD",
};

const STORAGE_KEY = "steadyscreen:audio";

export function loadAudioSettings(): AudioSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_AUDIO, ...JSON.parse(raw) } : DEFAULT_AUDIO;
  } catch {
    return DEFAULT_AUDIO;
  }
}

export function saveAudioSettings(s: AudioSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // Storage blocked: settings just won't persist.
  }
}

/** Chrome/Edge can route audio to a chosen device; Firefox/Safari mostly can't. */
export function canPickOutput(): boolean {
  return (
    typeof HTMLMediaElement !== "undefined" &&
    "setSinkId" in HTMLMediaElement.prototype
  );
}

export async function listOutputs(): Promise<MediaDeviceInfo[]> {
  const all = await navigator.mediaDevices.enumerateDevices();
  return all.filter(
    (d) =>
      d.kind === "audiooutput" &&
      d.deviceId !== "default" &&
      d.deviceId !== "communications",
  );
}

/** Send a media element's sound to the chosen device (no-op where unsupported). */
export async function routeTo(el: HTMLMediaElement, outputId: string) {
  const media = el as HTMLMediaElement & {
    setSinkId?: (id: string) => Promise<void>;
  };
  if (!media.setSinkId) return;
  try {
    await media.setSinkId(outputId);
  } catch {
    // Device gone or not allowed: keep the current output.
  }
}

/** A short two-note chime on the chosen output, to check it works. */
export async function playTestSound(outputId: string) {
  const ctx = new AudioContext() as AudioContext & {
    setSinkId?: (id: string) => Promise<void>;
  };
  if (outputId && ctx.setSinkId) {
    try {
      await ctx.setSinkId(outputId);
    } catch {
      // Fall back to the default output.
    }
  }
  const now = ctx.currentTime;
  [660, 880].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const t = now + i * 0.18;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.25, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.36);
  });
  window.setTimeout(() => void ctx.close(), 900);
}
