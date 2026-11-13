// Which video format (codec) the sharer's browser should offer first.
//
// The browser does the compressing. When the graphics card can encode a
// format (NVIDIA NVENC, AMD AMF, Intel Quick Sync), the browser uses it on
// its own; we can't pick the chip from a web page, but we can put the
// formats the card handles first. The viewer's browser then takes the first
// one it can play, so nobody is left without video.

const FORMATS = ["AV1", "H265", "H264", "VP9", "VP8"] as const;
type Format = (typeof FORMATS)[number];

/** Software order: H.264 and VP8 are light on the processor; AV1 and HEVC
 * without the card are heavy, so they go last. */
const SOFTWARE_ORDER: Format[] = ["H264", "VP8", "VP9", "AV1", "H265"];

/** Friendly names for the settings panel. */
export const FORMAT_NAMES: Record<string, string> = {
  AV1: "AV1",
  H265: "HEVC (H.265)",
  H264: "H.264",
  VP9: "VP9",
  VP8: "VP8",
};

const formatOf = (mimeType: string) =>
  mimeType.replace(/^video\//i, "").toUpperCase();

/** Can this computer encode `format` with the graphics card? */
async function onTheCard(format: Format): Promise<boolean> {
  try {
    const info = await navigator.mediaCapabilities.encodingInfo({
      type: "webrtc",
      video: {
        contentType: `video/${format}`,
        width: 1920,
        height: 1080,
        bitrate: 6_000_000,
        framerate: 30,
      },
    });
    return info.supported && info.powerEfficient;
  } catch {
    return false;
  }
}

let cached: Promise<{ order: Format[]; hardware: Format[] }> | null = null;

function check() {
  cached ??= (async () => {
    const onCard = await Promise.all(FORMATS.map(onTheCard));
    const hardware = FORMATS.filter((_, i) => onCard[i]);
    const order = [
      ...hardware,
      ...SOFTWARE_ORDER.filter((f) => !hardware.includes(f)),
    ];
    return { order, hardware };
  })();
  return cached;
}

/** Formats in the order we want them: the card's ones first (best first),
 * then the light software ones. Worked out once per page. */
export async function preferredFormats(): Promise<Format[]> {
  return (await check()).order;
}

/** Every format in the order we offer it, and whether the card encodes it. */
export async function formatPlan(): Promise<VideoFormat[]> {
  const { order, hardware } = await check();
  return order.map((f) => ({
    name: FORMAT_NAMES[f],
    onCard: hardware.includes(f),
  }));
}

/** Friendly names of the formats this computer's graphics card encodes. */
export async function cardFormats(): Promise<string[]> {
  return (await check()).hardware.map((f) => FORMAT_NAMES[f]);
}

/**
 * Put our preferred formats first on a connection's video. The helper
 * entries (rtx, red, ulpfec…) stay after the video formats. Browsers that
 * can't reorder just keep their own order.
 */
export async function preferVideoFormats(pc: RTCPeerConnection) {
  const transceiver = pc
    .getTransceivers()
    .find((t) => t.sender.track?.kind === "video");
  const caps = RTCRtpReceiver.getCapabilities?.("video")?.codecs;
  if (!transceiver?.setCodecPreferences || !caps?.length) return;

  const order = await preferredFormats();
  const rank = (c: RTCRtpCodec) => {
    const i = order.indexOf(formatOf(c.mimeType) as Format);
    return i === -1 ? order.length : i; // helpers after every format
  };
  // Stable sort: within one format (several H.264 profiles) keep the
  // browser's own order.
  const sorted = caps
    .map((c, i) => ({ c, i }))
    .sort((a, b) => rank(a.c) - rank(b.c) || a.i - b.i)
    .map((x) => x.c);
  try {
    transceiver.setCodecPreferences(sorted);
  } catch {
    // Not allowed here: the browser's default order still works.
  }
}

/** What one viewer's video is actually using right now. */
export type VideoFormat = { name: string; onCard: boolean };

/** Read the format in use from a connection's stats. `onCard` comes from the
 * stats when the browser shares it (often it hides it for privacy); if not,
 * from whether the card encodes that format on this computer. */
export async function videoFormatOf(
  pc: RTCPeerConnection,
): Promise<VideoFormat | null> {
  const stats = await pc.getStats();
  let out:
    | (RTCOutboundRtpStreamStats & {
        powerEfficientEncoder?: boolean;
        encoderImplementation?: string;
      })
    | undefined;
  stats.forEach((s) => {
    if (s.type === "outbound-rtp" && s.kind === "video") out = s;
  });
  if (!out?.codecId) return null;
  const codec = stats.get(out.codecId) as { mimeType: string } | undefined;
  if (!codec) return null;
  const format = formatOf(codec.mimeType);
  const onCard =
    out.powerEfficientEncoder ??
    (await check()).hardware.includes(format as Format);
  return { name: FORMAT_NAMES[format] ?? format, onCard };
}
