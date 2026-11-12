// Room features shared by hosts and viewers: who is in the room, the chat,
// and the display name. Mirrors server/room.go.

import type { SignalMessage } from "./signaling";

export type Sharing = "" | "screen" | "camera";

export type Participant = {
  id: string;
  name: string;
  role: "host" | "viewer";
  sharing?: Sharing;
};

export type ChatMessage = {
  id: string;
  from: string;
  name: string;
  text: string;
  at: number; // unix ms
};

export type RoomEvents = {
  /** Our own peer id, known once the server welcomes us. */
  onSelf?: (peerId: string) => void;
  onParticipants?: (list: Participant[]) => void;
  /** Called with the full history on join, then once per new message. */
  onChat?: (messages: ChatMessage[], isHistory: boolean) => void;
};

/** Handles the room-level messages. Returns true when the message was one of them. */
export function handleRoomMessage(m: SignalMessage, events: RoomEvents): boolean {
  switch (m.type) {
    case "welcome":
      events.onSelf?.(m.data.peerId);
      if (m.data.participants) events.onParticipants?.(m.data.participants);
      events.onChat?.(m.data.chat ?? [], true);
      return false; // sessions also need "welcome"
    case "participants":
      events.onParticipants?.(m.data ?? []);
      return true;
    case "chat":
      events.onChat?.([m.data], false);
      return true;
  }
  return false;
}

export const MAX_CHAT_LENGTH = 500;
export const MAX_NAME_LENGTH = 32;

const NAME_KEY = "steadyscreen:name";

/** The name this browser uses in rooms; a random guest name the first time. */
export function loadName(): string {
  try {
    const saved = localStorage.getItem(NAME_KEY);
    if (saved) return saved;
    const name = `Convidado ${Math.floor(100 + Math.random() * 900)}`;
    localStorage.setItem(NAME_KEY, name);
    return name;
  } catch {
    return "Convidado";
  }
}

export function saveName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {}
}

/** Up to two initials for an avatar. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}
