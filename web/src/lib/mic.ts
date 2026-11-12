// Our microphone, run through a tiny Web Audio graph:
//   device → gain (volume up to 200%) → output track
//                └→ analyser (level meter)
// The output track never changes, so switching device or filters doesn't
// interrupt the call: only the source feeding the graph is swapped.

export type MicSettings = {
  /** "" = the system default device. */
  deviceId: string;
  /** 0–200, 100 = unchanged. */
  volume: number;
  noiseSuppression: boolean;
  stereo: boolean;
  pushToTalk: boolean;
  /** KeyboardEvent.code, e.g. "KeyV". */
  pushToTalkKey: string;
};

export const DEFAULT_MIC: MicSettings = {
  deviceId: "",
  volume: 100,
  noiseSuppression: true,
  stereo: false,
  pushToTalk: false,
  pushToTalkKey: "KeyV",
};

const STORAGE_KEY = "steadyscreen:mic";

export function loadMicSettings(): MicSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_MIC, ...JSON.parse(raw) } : DEFAULT_MIC;
  } catch {
    return DEFAULT_MIC;
  }
}

export function saveMicSettings(s: MicSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // Private mode / storage blocked: settings just won't persist.
  }
}

export class Microphone {
  /** What we send to the room. Stable for the life of this object. */
  readonly track: MediaStreamTrack;
  private ctx: AudioContext;
  private gain: GainNode;
  private analyser: AnalyserNode;
  private source: MediaStreamAudioSourceNode | null = null;
  private raw: MediaStreamTrack | null = null;
  private levelData: Uint8Array<ArrayBuffer>;

  private constructor(
    private settings: MicSettings,
    private onEnded: () => void,
  ) {
    this.ctx = new AudioContext({ latencyHint: "interactive" });
    this.gain = this.ctx.createGain();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.levelData = new Uint8Array(this.analyser.fftSize);
    const dest = this.ctx.createMediaStreamDestination();
    dest.channelCount = 2;
    this.gain.connect(dest);
    this.gain.connect(this.analyser);
    this.track = dest.stream.getAudioTracks()[0];
    this.setVolume(settings.volume);
  }

  /** Ask for the device and start the graph. Throws if access is denied. */
  static async open(settings: MicSettings, onEnded: () => void) {
    const mic = new Microphone(settings, onEnded);
    try {
      await mic.capture();
    } catch (err) {
      mic.stop();
      throw err;
    }
    void mic.ctx.resume();
    return mic;
  }

  /** Apply new settings; re-opens the device only when the capture itself changes. */
  async update(next: MicSettings) {
    const prev = this.settings;
    this.settings = next;
    if (next.volume !== prev.volume) this.setVolume(next.volume);
    if (
      next.deviceId !== prev.deviceId ||
      next.noiseSuppression !== prev.noiseSuppression ||
      next.stereo !== prev.stereo
    ) {
      await this.capture();
    }
  }

  /** 0–1, how loud the mic is right now (after volume). */
  level(): number {
    this.analyser.getByteTimeDomainData(this.levelData);
    let peak = 0;
    for (const v of this.levelData) peak = Math.max(peak, Math.abs(v - 128));
    return Math.min(1, peak / 128);
  }

  stop() {
    this.raw?.removeEventListener("ended", this.handleEnded);
    this.raw?.stop();
    this.raw = null;
    this.track.stop();
    void this.ctx.close();
  }

  private setVolume(volume: number) {
    this.gain.gain.setTargetAtTime(volume / 100, this.ctx.currentTime, 0.02);
  }

  private async capture() {
    const s = this.settings;
    const media = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: s.deviceId ? { exact: s.deviceId } : undefined,
        noiseSuppression: s.noiseSuppression,
        // Stereo needs the echo canceller off (it mixes down to mono); headphones advised.
        echoCancellation: !s.stereo,
        autoGainControl: !s.stereo,
        channelCount: s.stereo ? { ideal: 2 } : { ideal: 1 },
      },
    });
    const raw = media.getAudioTracks()[0];
    // Swap the graph's input; the output track stays the same.
    this.source?.disconnect();
    this.raw?.removeEventListener("ended", this.handleEnded);
    this.raw?.stop();
    this.raw = raw;
    raw.addEventListener("ended", this.handleEnded);
    this.source = this.ctx.createMediaStreamSource(media);
    this.source.connect(this.gain);
  }

  private handleEnded = () => this.onEnded();
}

/** The audio inputs the browser knows about (names appear once mic access was granted). */
export async function listMicrophones(): Promise<MediaDeviceInfo[]> {
  const all = await navigator.mediaDevices.enumerateDevices();
  return all.filter(
    (d) =>
      d.kind === "audioinput" &&
      d.deviceId !== "default" &&
      d.deviceId !== "communications",
  );
}

/** "KeyV" → "V", "Space" → "Espaço"… */
export function keyLabel(code: string): string {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return `Num ${code.slice(6)}`;
  const names: Record<string, string> = {
    Space: "Espaço",
    Backquote: "`",
    ControlLeft: "Ctrl esq.",
    ControlRight: "Ctrl dir.",
    ShiftLeft: "Shift esq.",
    ShiftRight: "Shift dir.",
    AltLeft: "Alt",
    AltRight: "Alt Gr",
    CapsLock: "Caps Lock",
    Tab: "Tab",
  };
  return names[code] ?? code;
}
