// Host side of the phase-1 transport: a P2P mesh where the sharer's browser
// keeps one RTCPeerConnection per viewer. Phase 2 swaps this for a Go SFU
// (one upload, server fans out) without changing the pages.

import { Signaling, type SignalMessage } from "./signaling";

export type Quality = "detail" | "motion";

export type HostEvents = {
  onConnected: () => void;
  onViewers: (joined: number, watching: number) => void;
  onError: (reason: string) => void;
};

const QUALITY: Record<Quality, { maxBitrate: number; maxFramerate: number; degradation: RTCDegradationPreference }> = {
  // Text, code, slides: keep resolution sharp, drop frames if needed.
  detail: { maxBitrate: 6_000_000, maxFramerate: 30, degradation: "maintain-resolution" },
  // Video, games: keep motion fluid, drop resolution if needed.
  motion: { maxBitrate: 8_000_000, maxFramerate: 60, degradation: "maintain-framerate" },
};

type Peer = { pc: RTCPeerConnection; pendingIce: RTCIceCandidateInit[]; retry?: number };

export class HostSession {
  private signaling: Signaling;
  private viewers = new Set<string>();
  private peers = new Map<string, Peer>();
  private stream: MediaStream | null = null;
  private quality: Quality = "detail";
  private stopped = false;

  constructor(
    roomId: string,
    token: string,
    private iceServers: RTCIceServer[],
    private events: HostEvents,
  ) {
    this.signaling = new Signaling(
      { room: roomId, role: "host", token },
      (m) => this.onMessage(m),
      (unexpected) => {
        if (unexpected && !this.stopped) this.events.onError("disconnected");
      },
    );
  }

  /** Start (or replace) the shared stream; pass null to pause sharing. */
  setStream(stream: MediaStream | null, quality: Quality) {
    this.stream = stream;
    this.quality = quality;
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
    if (video) video.contentHint = quality;
    await Promise.all([...this.peers.values()].map((p) => this.applyQuality(p.pc)));
  }

  stop() {
    this.stopped = true;
    for (const id of [...this.peers.keys()]) this.closePeer(id);
    this.signaling.close();
  }

  private onMessage(m: SignalMessage) {
    switch (m.type) {
      case "welcome":
        for (const id of m.data.viewers as string[]) this.viewers.add(id);
        this.events.onConnected();
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
      if (ev.candidate) this.signaling.send("ice", id, { candidate: ev.candidate.toJSON() });
    };
    pc.onconnectionstatechange = () => {
      this.emitViewers();
      // Connection lost: try again with a fresh peer while the viewer is still here.
      if (pc.connectionState === "failed" && this.peers.get(id) === peer) {
        peer.retry = window.setTimeout(() => {
          if (this.peers.get(id) === peer && this.viewers.has(id)) this.connectViewer(id);
        }, 2000);
      }
    };

    try {
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
      sender.track.contentHint = this.quality;
      const params = sender.getParameters();
      if (!params.encodings?.length) params.encodings = [{}];
      params.encodings[0].maxBitrate = preset.maxBitrate;
      params.encodings[0].maxFramerate = preset.maxFramerate;
      (params as RTCRtpSendParameters & { degradationPreference?: RTCDegradationPreference }).degradationPreference =
        preset.degradation;
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
      await peer.pc.setRemoteDescription(sdp);
      for (const c of peer.pendingIce.splice(0)) await peer.pc.addIceCandidate(c);
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

  private emitViewers() {
    let watching = 0;
    for (const p of this.peers.values()) if (p.pc.connectionState === "connected") watching++;
    this.events.onViewers(this.viewers.size, watching);
  }
}
