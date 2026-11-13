"use client";

import { useMemo, useRef, useState } from "react";
import {
  saveName,
  type ChatMessage,
  type Participant,
  type RoomEvents,
} from "@/lib/room";

/** Something that happened in the room, for the bell in the navbar. */
export type RoomNotice = {
  id: number;
  text: string;
  at: number;
  kind: "join" | "leave" | "live";
};

/** Participants, chat and our own identity, fed by a Host/Viewer session. */
export function useRoom() {
  const [selfId, setSelfId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notices, setNotices] = useState<RoomNotice[]>([]);
  const [seenNotices, setSeenNotices] = useState(0);
  const prevPeople = useRef<Participant[] | null>(null);
  const noticeId = useRef(0);
  const selfRef = useRef<string | null>(null);

  // Stable callbacks to hand to the session.
  const roomEvents: RoomEvents = useMemo(
    () => ({
      onSelf: (id) => {
        selfRef.current = id;
        setSelfId(id);
      },
      onParticipants: (list) => {
        // Compare with the last list to tell who came, left or went live.
        // The first list (on joining) is just who was already here.
        const before = prevPeople.current;
        prevPeople.current = list;
        setParticipants(list);
        if (!before) return;
        const now = Date.now();
        const fresh: RoomNotice[] = [];
        const add = (text: string, kind: RoomNotice["kind"]) =>
          fresh.push({ id: ++noticeId.current, text, at: now, kind });
        for (const p of list) {
          if (p.id === selfRef.current) continue; // nothing to tell about ourselves
          const old = before.find((b) => b.id === p.id);
          if (!old) add(`${p.name} entrou na sala`, "join");
          else if (p.sharing && !old.sharing)
            add(
              `${p.name} começou a compartilhar a ${p.sharing === "camera" ? "câmera" : "tela"}`,
              "live",
            );
        }
        for (const b of before)
          if (b.id !== selfRef.current && !list.some((p) => p.id === b.id))
            add(`${b.name} saiu da sala`, "leave");
        if (fresh.length)
          setNotices((all) => [...fresh.reverse(), ...all].slice(0, 30));
      },
      onChat: (list, isHistory) =>
        setMessages((prev) => (isHistory ? list : [...prev, ...list])),
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
    notices,
    /** Notices that arrived since the bell was last opened. */
    unreadNotices: notices.filter((n) => n.id > seenNotices).length,
    markNoticesSeen: () => setSeenNotices(noticeId.current),
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
