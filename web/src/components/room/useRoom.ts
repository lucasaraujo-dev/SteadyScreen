"use client";

import { useMemo, useState } from "react";
import { saveName, type ChatMessage, type Participant, type RoomEvents } from "@/lib/room";

/** Participants, chat and our own identity, fed by a Host/Viewer session. */
export function useRoom() {
  const [selfId, setSelfId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Stable callbacks to hand to the session.
  const roomEvents: RoomEvents = useMemo(
    () => ({
      onSelf: setSelfId,
      onParticipants: setParticipants,
      onChat: (list, isHistory) => setMessages((prev) => (isHistory ? list : [...prev, ...list])),
    }),
    [],
  );

  // The server is the source of truth for our name.
  const selfName = participants.find((p) => p.id === selfId)?.name ?? "";

  return {
    selfId,
    selfName,
    participants,
    messages,
    roomEvents,
    settingsOpen,
    openSettings: () => setSettingsOpen(true),
    closeSettings: () => setSettingsOpen(false),
    /** Persist locally and tell the room. */
    rename: (name: string, send: (n: string) => void) => {
      saveName(name);
      send(name);
    },
  };
}
