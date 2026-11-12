// Viewer side of the phase-1 P2P transport (see host.ts).

import { handleRoomMessage, type RoomEvents } from "./room";
import { Signaling, type SignalMessage } from "./signaling";

export type ViewerStatus =
  | "connecting" // talking to the server
  | "waiting-host" // room exists, sharer is not online
  | "waiting-stream" // sharer is online but not sharing yet
  | "starting" // WebRTC negotiation in progress
  | "live"
  | "reconnecting"
  | "error";

export type ViewerEvents = RoomEvents & {
  onStatus: (status: ViewerStatus, reason?: string) => void;
  onStream: (stream: MediaStream | null) => void;
};

export class ViewerSession {
  private signaling: Signaling;
  private pc: RTCPeerConnection | null = null;
  private pendingIce: RTCIceCandidateInit[] = [];
  private stopped = false;

  constructor(
    roomId: string,
    name: string,
    private iceServers: RTCIceServer[],
    private events: ViewerEvents,
  ) {
    events.onStatus("connecting");
    this.signaling = new Signaling(
      { room: roomId, role: "viewer", name },
      (m) => this.onMessage(m),
      (unexpected) => {
        if (unexpected && !this.stopped) this.events.onStatus("error", "disconnected");
      },
    );
  }

  sendChat(text: string) {
    this.signaling.send("chat", undefined, { text });
  }

  rename(name: string) {
    this.signaling.send("rename", undefined, { name });
  }

  stop() {
    this.stopped = true;
    this.closePeer();
    this.signaling.close();
  }

  private onMessage(m: SignalMessage) {
    if (handleRoomMessage(m, this.events)) return;
    switch (m.type) {
      case "welcome":
        this.events.onStatus(m.data.hostOnline ? "waiting-stream" : "waiting-host");
        break;
      case "host-online":
        this.events.onStatus("waiting-stream");
        break;
      case "host-left":
        this.closePeer();
        this.events.onStatus("waiting-host");
        break;
      case "bye":
        this.closePeer();
        this.events.onStatus("waiting-stream");
        break;
      case "offer":
        void this.onOffer(m.data.sdp);
        break;
      case "ice":
        void this.onIce(m.data.candidate);
        break;
      case "error":
        // The server closes the socket right after; keep this reason, not "disconnected".
        this.stopped = true;
        this.events.onStatus("error", m.data?.reason ?? "unknown");
        break;
    }
  }

  private async onOffer(sdp: RTCSessionDescriptionInit) {
    this.closePeer();
    this.events.onStatus("starting");

    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    this.pc = pc;
    const stream = new MediaStream();

    pc.ontrack = (ev) => {
      stream.addTrack(ev.track);
      this.events.onStream(stream);
    };
    pc.onicecandidate = (ev) => {
      if (ev.candidate) this.signaling.send("ice", undefined, { candidate: ev.candidate.toJSON() });
    };
    pc.onconnectionstatechange = () => {
      if (this.pc !== pc) return;
      switch (pc.connectionState) {
        case "connected":
          this.events.onStatus("live");
          break;
        case "disconnected":
        case "failed":
          // The host retries failed peers with a new offer.
          this.events.onStatus("reconnecting");
          break;
      }
    };

    try {
      await pc.setRemoteDescription(sdp);
      for (const c of this.pendingIce.splice(0)) await pc.addIceCandidate(c);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      if (this.pc !== pc) return;
      this.signaling.send("answer", undefined, { sdp: pc.localDescription });
    } catch (err) {
      console.error("answer failed", err);
      this.events.onStatus("error", "negotiation-failed");
    }
  }

  private async onIce(candidate: RTCIceCandidateInit) {
    if (!this.pc || !this.pc.remoteDescription) {
      this.pendingIce.push(candidate);
      return;
    }
    try {
      await this.pc.addIceCandidate(candidate);
    } catch (err) {
      console.warn("ice candidate rejected", err);
    }
  }

  private closePeer() {
    if (this.pc) {
      this.pc.onconnectionstatechange = null;
      this.pc.ontrack = null;
      this.pc.close();
      this.pc = null;
    }
    this.pendingIce = [];
    this.events.onStream(null);
  }
}
