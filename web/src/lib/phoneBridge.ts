// Computer side of "use the phone as camera / microphone". The room's host
// asks one of the account's linked phones (server/phone.go relays the
// messages); the phone accepts on its screen and sends the media straight
// to this browser over WebRTC. From here it is shared like a local webcam
// or mic.

import type { SignalMessage } from "./signaling";

export type Phone = { id: string; name: string };
export type PhoneKind = "camera" | "mic";

type Handlers = {
  /** The phone accepted and its media arrived. */
  onStream: (stream: MediaStream) => void;
  /** The phone said no (`blocked`: it said yes but the phone didn't allow it). */
  onDeclined: (blocked: boolean) => void;
  /** It stopped: the phone ended it, closed the page or lost connection. */
  onEnded: () => void;
};

type Call = {
  phoneId: string;
  kind: PhoneKind;
  handlers: Handlers;
  pc?: RTCPeerConnection;
  stream?: MediaStream;
  pendingIce: RTCIceCandidateInit[];
  ended: boolean;
};

const key = (phoneId: string, kind: PhoneKind) => `${phoneId}:${kind}`;

export class PhoneBridge {
  private calls = new Map<string, Call>();

  constructor(
    private send: (type: string, to: string, data: unknown) => void,
    private iceServers: RTCIceServer[],
  ) {}

  /** Ask a phone for its camera or mic. Replaces an earlier ask of the same kind. */
  request(phoneId: string, kind: PhoneKind, handlers: Handlers) {
    for (const c of [...this.calls.values()])
      if (c.kind === kind) this.stop(c.phoneId, kind);
    this.calls.set(key(phoneId, kind), {
      phoneId,
      kind,
      handlers,
      pendingIce: [],
      ended: false,
    });
    this.send("phone-request", phoneId, { kind });
  }

  /** Stop using a phone's camera or mic (tells the phone). */
  stop(phoneId: string, kind: PhoneKind) {
    const call = this.calls.get(key(phoneId, kind));
    if (!call) return;
    this.send("phone-stop", phoneId, { kind });
    this.end(call, false);
  }

  /** Ask the phone to switch between its front and back camera. */
  flip(phoneId: string) {
    if (this.calls.has(key(phoneId, "camera")))
      this.send("phone-flip", phoneId, { kind: "camera" });
  }

  /** Stop whatever call delivered this stream (when sharing stops here). */
  release(stream: MediaStream | null) {
    if (!stream) return;
    for (const c of [...this.calls.values()]) {
      const ours = c.stream?.getTracks() ?? [];
      if (ours.some((t) => stream.getTracks().includes(t)))
        this.stop(c.phoneId, c.kind);
    }
  }

  /** Is this track coming from a phone? */
  isPhoneTrack(track: MediaStreamTrack | null) {
    if (!track) return false;
    return [...this.calls.values()].some((c) =>
      c.stream?.getTracks().includes(track),
    );
  }

  stopAll() {
    for (const c of [...this.calls.values()]) this.stop(c.phoneId, c.kind);
  }

  /** Handles phone-* messages; returns false for anything else. */
  handle(m: SignalMessage): boolean {
    if (m.type === "phone-gone") {
      for (const c of [...this.calls.values()])
        if (c.phoneId === m.from) this.end(c, true);
      return true;
    }
    if (!m.type.startsWith("phone-") || !m.from) return false;
    const kind = m.data?.kind as PhoneKind;
    const call = this.calls.get(key(m.from, kind));
    if (!call) return true;
    switch (m.type) {
      case "phone-reply":
        if (!m.data?.accepted) {
          this.calls.delete(key(call.phoneId, call.kind));
          call.ended = true;
          call.handlers.onDeclined(!!m.data?.blocked);
        }
        break;
      case "phone-offer":
        void this.onOffer(call, m.data.sdp);
        break;
      case "phone-ice":
        if (call.pc?.remoteDescription)
          void call.pc.addIceCandidate(m.data.candidate).catch(() => {});
        else call.pendingIce.push(m.data.candidate);
        break;
      case "phone-stop":
        this.end(call, true);
        break;
    }
    return true;
  }

  private async onOffer(call: Call, sdp: RTCSessionDescriptionInit) {
    call.pc?.close();
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    call.pc = pc;
    pc.onicecandidate = (ev) => {
      if (ev.candidate)
        this.send("phone-ice", call.phoneId, {
          kind: call.kind,
          candidate: ev.candidate.toJSON(),
        });
    };
    pc.ontrack = (ev) => {
      if (call.stream) return;
      call.stream = new MediaStream([ev.track]);
      call.handlers.onStream(call.stream);
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") this.end(call, true);
    };
    try {
      await pc.setRemoteDescription(sdp);
      for (const c of call.pendingIce.splice(0))
        await pc.addIceCandidate(c).catch(() => {});
      await pc.setLocalDescription(await pc.createAnswer());
      this.send("phone-answer", call.phoneId, {
        kind: call.kind,
        sdp: pc.localDescription,
      });
    } catch (err) {
      console.error("phone connection", err);
      this.end(call, true);
    }
  }

  private end(call: Call, notify: boolean) {
    if (call.ended) return;
    call.ended = true;
    this.calls.delete(key(call.phoneId, call.kind));
    call.stream?.getTracks().forEach((t) => t.stop());
    call.pc?.close();
    if (notify) call.handlers.onEnded();
  }
}
