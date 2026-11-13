import { wsUrl } from "./api";

/** Envelope used by server/client.go (type Message). */
export type SignalMessage = {
  type: string;
  from?: string;
  to?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
};

/** Wrapper around the signaling WebSocket. If the connection drops (Wi-Fi
 * hiccup, server restart) it quietly connects again, waiting a little longer
 * each time. The server sends "welcome" again, so sessions pick up where they
 * left off. It only gives up when close() or giveUp() is called. */
export class Signaling {
  private ws!: WebSocket;
  private closedByUs = false;
  private tries = 0;
  private timer = 0;

  constructor(
    private params: Record<string, string>,
    private onMessage: (m: SignalMessage) => void,
    private onLost?: () => void,
  ) {
    this.open();
  }

  private open() {
    const ws = new WebSocket(wsUrl(this.params));
    this.ws = ws;
    ws.onmessage = (ev) => {
      try {
        const m = JSON.parse(ev.data) as SignalMessage;
        if (m.type === "welcome") this.tries = 0;
        this.onMessage(m);
      } catch (err) {
        console.error("bad signaling message", err);
      }
    };
    ws.onclose = () => {
      if (this.closedByUs || this.ws !== ws) return;
      this.onLost?.();
      const wait = Math.min(1000 * 2 ** this.tries, 10000);
      this.tries++;
      this.timer = window.setTimeout(() => {
        if (!this.closedByUs) this.open();
      }, wait);
    };
  }

  send(type: string, to: string | undefined, data?: unknown) {
    if (this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type, to, data }));
  }

  /** Stop for good without reconnecting (e.g. the server refused us). */
  giveUp() {
    this.closedByUs = true;
    window.clearTimeout(this.timer);
  }

  close() {
    this.giveUp();
    this.ws.close();
  }
}
