// Host side of the phase-1 transport: a P2P mesh where the sharer's browser
// keeps one RTCPeerConnection per viewer. Phase 2 swaps this for a Go SFU
// (one upload, server fans out) without changing the pages.

import { preferVideoFormats, videoFormatOf, type VideoFormat } from "./codecs";
import { PhoneBridge, type Phone } from "./phoneBridge";
import { handleRoomMessage, type RoomEvents, type Sharing } from "./room";
import { Signaling, type SignalMessage } from "./signaling";

export type Quality = "detail" | "motion";

/** What viewers receive: a height cap ("source" = as captured) and a frame rate. */
export type Resolution = "source" | 1080 | 720 | 480;
export type Fps = 15 | 30 | 60;
export type Output = { resolution: Resolution; fps: Fps };
export const DEFAULT_OUTPUT: Output = { resolution: "source", fps: 30 };

export type HostEvents = RoomEvents & {
  onConnected: () => void;
  /** watchingIds = viewers whose video connection is up. */
  onViewers: (joined: number, watching: number, watchingIds: string[]) => void;
  onError: (reason: string) => void;
  /** The account's linked phones that are online (to use as camera / mic). */
  onPhones?: (phones: Phone[]) => void;
};

const QUALITY: Record<
  Quality,
  { maxBitrate: number; degradation: RTCDegradationPreference }
> = {
  // Text, code, slides: keep resolution sharp, drop frames if needed.
  detail: { maxBitrate: 6_000_000, degradation: "maintain-resolution" },
  // Video, games: keep motion fluid, drop resolution if needed.
  motion: { maxBitrate: 8_000_000, degradation: "maintain-framerate" },
};

type Peer = {
  pc: RTCPeerConnection;
  pendingIce: RTCIceCandidateInit[];
  retry?: number;
};

export class HostSession {
  private signaling: Signaling;
  private viewers = new Set<string>();
  private peers = new Map<string, Peer>();
  private stream: MediaStream | null = null;
  private quality: Quality = "detail";
  private output: Output = DEFAULT_OUTPUT;
  private sharing: Sharing = "";
  private stopped = false;
  /** Talks to the account's phones (camera / mic from the phone). */
  readonly phones: PhoneBridge;

  constructor(
    roomId: string,
    token: string,
    name: string,
    private iceServers: RTCIceServer[],
    private events: HostEvents,
  ) {
    this.signaling = new Signaling(
      { room: roomId, role: "host", token, name },
      (m) => this.onMessage(m),
    );
    this.phones = new PhoneBridge(
      (type, to, data) => this.signaling.send(type, to, data),
      iceServers,
    );
  }

  /** Start (or replace) the shared stream; pass null to pause sharing. */
  setStream(
    stream: MediaStream | null,
    quality: Quality,
    sharing: Sharing = stream ? "screen" : "",
  ) {
    this.stream = stream;
    this.quality = quality;
    this.sharing = stream ? sharing : "";
    void this.applyCaptureRate();
    this.signaling.send("state", undefined, { sharing: this.sharing });
    for (const id of this.viewers) {
      if (stream) this.connectViewer(id);
      else {
        this.closePeer(id);
        this.signaling.send("bye", id);
      }
    }
    this.emitViewers();
  }

  /** Change the encoding preset without renegotiating. */
  async setQuality(quality: Quality) {
    this.quality = quality;
    const video = this.stream?.getVideoTracks()[0];
    if (video) video.contentHint = this.contentHint();
    await Promise.all(
      [...this.peers.values()].map((p) => this.applyQuality(p.pc)),
    );
  }

  /** Change resolution / frame rate for every viewer, without renegotiating. */
  async setOutput(output: Output) {
    this.output = output;
    await this.applyCaptureRate();
    await Promise.all(
      [...this.peers.values()].map((p) => this.applyQuality(p.pc)),
    );
  }

  /** The video formats in use right now (one per viewer, duplicates merged). */
  async videoFormats(): Promise<VideoFormat[]> {
    const live = [...this.peers.values()].filter(
      (p) => p.pc.connectionState === "connected",
    );
    const found = await Promise.all(
      live.map((p) => videoFormatOf(p.pc).catch(() => null)),
    );
    const seen = new Map<string, VideoFormat>();
    for (const f of found) if (f) seen.set(`${f.name}|${f.onCard}`, f);
    return [...seen.values()];
  }

  sendChat(text: string) {
    this.signaling.send("chat", undefined, { text });
  }

  rename(name: string) {
    this.signaling.send("rename", undefined, { name });
  }

  stop() {
    this.stopped = true;
    for (const id of [...this.peers.keys()]) this.closePeer(id);
    this.phones.stopAll();
    this.signaling.close();
  }

  private onMessage(m: SignalMessage) {
    if (handleRoomMessage(m, this.events)) return;
    if (m.type === "phones") {
      this.events.onPhones?.(m.data ?? []);
      return;
    }
    if (this.phones.handle(m)) return;
    switch (m.type) {
      case "welcome":
        {
          // After a reconnect the server's list is the truth: drop viewers who left meanwhile.
          const now = new Set(m.data.viewers as string[]);
          for (const id of [...this.viewers])
            if (!now.has(id)) this.closePeer(id);
          this.viewers = now;
        }
        this.events.onConnected();
        // After a reconnect, tell the room again what we are sharing.
        if (this.sharing)
          this.signaling.send("state", undefined, { sharing: this.sharing });
        if (this.stream) for (const id of this.viewers) this.connectViewer(id);
        this.emitViewers();
        break;
      case "viewer-joined":
        this.viewers.add(m.data.peerId);
        if (this.stream) this.connectViewer(m.data.peerId);
        this.emitViewers();
        break;
      case "viewer-left":
        this.viewers.delete(m.data.peerId);
        this.closePeer(m.data.peerId);
        this.emitViewers();
        break;
      case "answer":
        if (m.from) void this.onAnswer(m.from, m.data.sdp);
        break;
      case "ice":
        if (m.from) void this.onIce(m.from, m.data.candidate);
        break;
      case "error":
        // The server closes the socket right after; keep this reason, not "disconnected".
        this.stopped = true;
        this.signaling.giveUp();
        this.events.onError(m.data?.reason ?? "unknown");
        break;
    }
  }

  private async connectViewer(id: string) {
    this.closePeer(id);
    const stream = this.stream;
    if (!stream) return;

    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    const peer: Peer = { pc, pendingIce: [] };
    this.peers.set(id, peer);

    for (const track of stream.getTracks()) pc.addTrack(track, stream);
    pc.onicecandidate = (ev) => {
      if (ev.candidate)
        this.signaling.send("ice", id, { candidate: ev.candidate.toJSON() });
    };
    pc.onconnectionstatechange = () => {
      this.emitViewers();
      // Connection lost: try again with a fresh peer while the viewer is still here.
      if (pc.connectionState === "failed" && this.peers.get(id) === peer) {
        peer.retry = window.setTimeout(() => {
          if (this.peers.get(id) === peer && this.viewers.has(id))
            this.connectViewer(id);
        }, 2000);
      }
    };

    try {
      // AV1 / HEVC / H.264 on the graphics card first, when it has them.
      await preferVideoFormats(pc);
      if (this.peers.get(id) !== peer) return;
      await this.applyQuality(pc);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      if (this.peers.get(id) !== peer) return; // replaced meanwhile
      this.signaling.send("offer", id, { sdp: pc.localDescription });
    } catch (err) {
      console.error("offer failed", err);
    }
  }

  private async applyQuality(pc: RTCPeerConnection) {
    const preset = QUALITY[this.quality];
    for (const sender of pc.getSenders()) {
      if (sender.track?.kind !== "video") continue;
      sender.track.contentHint = this.contentHint();
      const params = sender.getParameters();
      if (!params.encodings?.length) params.encodings = [{}];
      params.encodings[0].maxBitrate = preset.maxBitrate;
      params.encodings[0].maxFramerate = this.output.fps;
      params.encodings[0].scaleResolutionDownBy = this.downscale(sender.track);
      (
        params as RTCRtpSendParameters & {
          degradationPreference?: RTCDegradationPreference;
        }
      ).degradationPreference = preset.degradation;
      try {
        await sender.setParameters(params);
      } catch {
        // Some browsers reject degradationPreference or encodings before negotiation; defaults are fine.
      }
    }
  }

  private async onAnswer(id: string, sdp: RTCSessionDescriptionInit) {
    const peer = this.peers.get(id);
    if (!peer) return;
    try {
      await peer.pc.setRemoteDescription({
        type: sdp.type,
        sdp: withStereoOpus(sdp.sdp ?? ""),
      });
      for (const c of peer.pendingIce.splice(0))
        await peer.pc.addIceCandidate(c);
      await this.applyQuality(peer.pc);
    } catch (err) {
      console.error("answer failed", err);
    }
  }

  private async onIce(id: string, candidate: RTCIceCandidateInit) {
    const peer = this.peers.get(id);
    if (!peer) return;
    if (!peer.pc.remoteDescription) {
      peer.pendingIce.push(candidate);
      return;
    }
    try {
      await peer.pc.addIceCandidate(candidate);
    } catch (err) {
      console.warn("ice candidate rejected", err);
    }
  }

  private closePeer(id: string) {
    const peer = this.peers.get(id);
    if (!peer) return;
    window.clearTimeout(peer.retry);
    peer.pc.onconnectionstatechange = null;
    peer.pc.close();
    this.peers.delete(id);
  }

  /** How much to shrink the picture so its height fits the chosen resolution. */
  private downscale(track: MediaStreamTrack): number {
    if (this.output.resolution === "source") return 1;
    const height = track.getSettings().height ?? 0;
    return height > this.output.resolution
      ? height / this.output.resolution
      : 1;
  }

  /** Ask the capture itself for the chosen frame rate (60 fps needs it; lower saves CPU). */
  private async applyCaptureRate() {
    const video = this.stream?.getVideoTracks()[0];
    if (!video) return;
    try {
      await video.applyConstraints({
        ...video.getConstraints(),
        frameRate: { ideal: this.output.fps, max: this.output.fps },
      });
    } catch {
      // The source can't do it; the encoder cap still applies.
    }
  }

  /** A camera is always "motion"; a screen follows the quality preset. */
  private contentHint(): string {
    return this.sharing === "camera" ? "motion" : this.quality;
  }

  private emitViewers() {
    const watchingIds: string[] = [];
    for (const [id, p] of this.peers)
      if (p.pc.connectionState === "connected") watchingIds.push(id);
    this.events.onViewers(this.viewers.size, watchingIds.length, watchingIds);
  }
}

/**
 * Let Opus carry stereo and a higher bitrate. The viewer's answer decides what
 * we may send, so we mark it as stereo-capable before applying it. A mono mic
 * still goes out as mono; a stereo mic or system audio keeps left/right.
 */
function withStereoOpus(sdp: string): string {
  const pt = sdp.match(/a=rtpmap:(\d+) opus\/48000\/2/i)?.[1];
  if (!pt) return sdp;
  return sdp.replace(
    new RegExp(`a=fmtp:${pt} ([^\\r\\n]*)`),
    (line, params: string) => {
      let next = params;
      if (!/stereo=/.test(next)) next += ";stereo=1;sprop-stereo=1";
      if (!/maxaveragebitrate=/.test(next)) next += ";maxaveragebitrate=128000";
      return line.replace(params, next);
    },
  );
}
