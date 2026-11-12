import { wsUrl } from "./api";

/** Envelope used by server/client.go (type Message). */
export type SignalMessage = {
  type: string;
  from?: string;
  to?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
};

/** Thin wrapper around the signaling WebSocket. */
export class Signaling {
  private ws: WebSocket;
  private closedByUs = false;

  constructor(
    params: Record<string, string>,
    onMessage: (m: SignalMessage) => void,
    onClose: (unexpected: boolean) => void,
  ) {
    this.ws = new WebSocket(wsUrl(params));
    this.ws.onmessage = (ev) => {
      try {
        onMessage(JSON.parse(ev.data));
      } catch (err) {
        console.error("bad signaling message", err);
      }
    };
    this.ws.onclose = () => onClose(!this.closedByUs);
  }

  send(type: string, to: string | undefined, data?: unknown) {
    if (this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type, to, data }));
  }

  close() {
    this.closedByUs = true;
    this.ws.close();
  }
}
