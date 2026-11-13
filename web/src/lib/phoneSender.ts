// Phone side of "use the phone as camera / microphone" (see phoneBridge.ts
// for the computer side and server/phone.go for the messages). The phone
// stays connected while its page is open; requests from the account's rooms
// show up there and only start once the person accepts on the phone.

import type { PhoneKind } from "./phoneBridge";
import { Signaling, type SignalMessage } from "./signaling";

export type PhoneRequest = { hostId: string; kind: PhoneKind; room: string };

export type Facing = "user" | "environment";

type Call = {
  hostId: string;
  kind: PhoneKind;
  pc: RTCPeerConnection;
  stream: MediaStream;
  pendingIce: RTCIceCandidateInit[];
};

type Events = {
  onConnected: (connected: boolean) => void;
  onRequest: (req: PhoneRequest) => void;
  /** Something being sent changed (started, stopped, camera flipped). */
  onCalls: () => void;
  onError: (reason: string) => void;
};

export class PhoneSender {
  private signaling: Signaling;
  private calls = new Map<PhoneKind, Call>();
  facing: Facing = "user";

  constructor(
    private iceServers: RTCIceServer[],
    private events: Events,
  ) {
    this.signaling = new Signaling(
      { role: "phone" },
      (m) => this.onMessage(m),
      () => events.onConnected(false),
    );
  }

  /** What is being sent right now. */
  active(kind: PhoneKind): MediaStream | null {
    return this.calls.get(kind)?.stream ?? null;
  }

  /** `blocked` = the person said yes but the phone didn't allow the camera/mic. */
  decline(req: PhoneRequest, blocked = false) {
    this.signaling.send("phone-reply", req.hostId, {
      kind: req.kind,
      accepted: false,
      blocked,
    });
  }

  /** The person said yes: open the camera/mic and send it. */
  async accept(req: PhoneRequest) {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(
        req.kind === "camera"
          ? { video: this.cameraConstraints(), audio: false }
          : {
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
              video: false,
            },
      );
    } catch {
      this.decline(req, true);
      this.events.onError(
        req.kind === "camera" ? "camera-denied" : "mic-denied",
      );
      return;
    }
    this.stop(req.kind, true);
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    const call: Call = {
      hostId: req.hostId,
      kind: req.kind,
      pc,
      stream,
      pendingIce: [],
    };
    this.calls.set(req.kind, call);
    for (const t of stream.getTracks()) {
      if (t.kind === "video") t.contentHint = "motion";
      pc.addTrack(t, stream);
    }
    pc.onicecandidate = (ev) => {
      if (ev.candidate)
        this.signaling.send("phone-ice", call.hostId, {
          kind: call.kind,
          candidate: ev.candidate.toJSON(),
        });
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") this.stop(call.kind, true);
    };
    await pc.setLocalDescription(await pc.createOffer());
    this.signaling.send("phone-offer", call.hostId, {
      kind: call.kind,
      sdp: pc.localDescription,
    });
    this.events.onCalls();
  }

  /** Switch between the front and back camera while sending. */
  async flip() {
    this.facing = this.facing === "user" ? "environment" : "user";
    const call = this.calls.get("camera");
    if (!call) return this.events.onCalls();
    try {
      const fresh = await navigator.mediaDevices.getUserMedia({
        video: this.cameraConstraints(),
        audio: false,
      });
      const track = fresh.getVideoTracks()[0];
      track.contentHint = "motion";
      const sender = call.pc
        .getSenders()
        .find((s) => s.track?.kind === "video");
      await sender?.replaceTrack(track);
      call.stream.getVideoTracks().forEach((t) => {
        t.stop();
        call.stream.removeTrack(t);
      });
      call.stream.addTrack(track);
    } catch {
      this.events.onError("camera-denied");
    }
    this.events.onCalls();
  }

  /** Stop sending; `tell` lets the computer know. */
  stop(kind: PhoneKind, tell = true) {
    const call = this.calls.get(kind);
    if (!call) return;
    this.calls.delete(kind);
    if (tell) this.signaling.send("phone-stop", call.hostId, { kind });
    call.stream.getTracks().forEach((t) => t.stop());
    call.pc.close();
    this.events.onCalls();
  }

  close() {
    for (const kind of [...this.calls.keys()]) this.stop(kind);
    this.signaling.close();
  }

  private cameraConstraints(): MediaTrackConstraints {
    return {
      facingMode: this.facing,
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 },
    };
  }

  private onMessage(m: SignalMessage) {
    switch (m.type) {
      case "welcome":
        this.events.onConnected(true);
        return;
      case "error":
        this.signaling.giveUp();
        this.events.onError(m.data?.reason ?? "server-offline");
        return;
      case "phone-host-gone":
        for (const c of [...this.calls.values()])
          if (c.hostId === m.from) this.stop(c.kind, false);
        return;
    }
    if (!m.from) return;
    const kind = m.data?.kind as PhoneKind;
    const call = this.calls.get(kind);
    switch (m.type) {
      case "phone-request":
        this.events.onRequest({ hostId: m.from, kind, room: m.data.room });
        break;
      case "phone-answer":
        if (call?.hostId === m.from)
          void call.pc
            .setRemoteDescription(m.data.sdp)
            .then(async () => {
              for (const c of call.pendingIce.splice(0))
                await call.pc.addIceCandidate(c).catch(() => {});
            })
            .catch(() => this.stop(kind, true));
        break;
      case "phone-ice":
        if (call?.hostId !== m.from) break;
        if (call.pc.remoteDescription)
          void call.pc.addIceCandidate(m.data.candidate).catch(() => {});
        else call.pendingIce.push(m.data.candidate);
        break;
      case "phone-stop":
        if (call?.hostId === m.from) this.stop(kind, false);
        break;
    }
  }
}
