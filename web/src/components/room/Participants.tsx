"use client";

import { useState } from "react";
import {
  CameraIcon,
  HeadsetIcon,
  HeadsetOffIcon,
  ScreenIcon,
} from "@/components/icons";
import { DEFAULT_SOUND, type TileSound } from "@/components/room/StreamGrid";
import { initials, type Participant } from "@/lib/room";

type Props = {
  participants: Participant[];
  selfId: string | null;
  maxViewers: number;
  /** Host only: viewers whose video is connected, to show "assistindo". */
  watchingIds?: string[];
  hostSharing?: boolean;
  /** How loud we hear each other person, by participant id. */
  sounds: Record<string, TileSound>;
  onSound: (id: string, sound: TileSound) => void;
};

/**
 * Participants as a "dynamic island": a slim black pill of avatars that
 * springs open on hover (or keyboard focus) to show names and status.
 */
export default function Participants({
  participants,
  selfId,
  maxViewers,
  watchingIds,
  hostSharing,
  sounds,
  onSound,
}: Props) {
  // Whose volume slider is open (one at a time).
  const [openId, setOpenId] = useState<string | null>(null);
  const viewers = participants.filter((p) => p.role === "viewer").length;
  return (
    <aside className="people-rail" aria-label="Participantes">
      <div className="island" tabIndex={0}>
        <header className="island-head">
          <span className="island-title">Participantes</span>
          <span className="island-count">
            {viewers}/{maxViewers}
          </span>
        </header>

        <ul className="island-list">
          {participants.map((p) => {
            const isSelf = p.id === selfId;
            let status: React.ReactNode = null;
            let dot = "";
            if (p.role === "host" && p.sharing) {
              dot = "is-live";
              status = (
                <span className="person-status is-live">
                  {p.sharing === "camera" ? (
                    <CameraIcon size={13} />
                  ) : (
                    <ScreenIcon size={13} />
                  )}
                  {p.sharing === "camera" ? "Câmera" : "Tela"}
                </span>
              );
            } else if (p.role === "viewer" && watchingIds && hostSharing) {
              const watching = watchingIds.includes(p.id);
              dot = watching ? "is-watching" : "";
              status = (
                <span className="person-status">
                  {watching ? "Assistindo" : "Conectando…"}
                </span>
              );
            }
            return (
              <li
                key={p.id}
                className={`person${openId === p.id && !isSelf ? " is-open" : ""}`}
              >
                <span
                  className={`avatar${p.role === "host" ? " is-host" : ""}${isSelf ? " is-self" : ""}${p.avatar ? " has-photo" : ""}`}
                  aria-hidden
                >
                  {p.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element -- tiny photo from our own API
                    <img
                      className="avatar-photo"
                      src={p.avatar}
                      alt=""
                      draggable={false}
                    />
                  ) : (
                    initials(p.name)
                  )}
                  {dot === "is-live" ? (
                    // Sharing: a thin blue ring with a light running around it.
                    <span className="avatar-ring" />
                  ) : (
                    dot && <span className={`avatar-dot ${dot}`} />
                  )}
                </span>
                <span className="person-main">
                  <span className="person-name">
                    {p.name}
                    {isSelf && <span className="person-you"> (você)</span>}
                  </span>
                  <span className="person-role">
                    {p.role === "host" ? "Anfitrião" : "Convidado"}
                  </span>
                </span>
                {status}
                {!isSelf && (
                  <PersonSound
                    name={p.name}
                    sound={sounds[p.id] ?? DEFAULT_SOUND}
                    open={openId === p.id}
                    onToggle={() =>
                      setOpenId((o) => (o === p.id ? null : p.id))
                    }
                    onChange={(s) => onSound(p.id, s)}
                  />
                )}
              </li>
            );
          })}
          {participants.length === 0 && (
            <li className="person" aria-label="Conectando">
              <span className="avatar is-loading" aria-hidden />
            </li>
          )}
        </ul>
      </div>
    </aside>
  );
}

/** Headphones at the end of someone's row: opens mute + volume for them. */
function PersonSound({
  name,
  sound,
  open,
  onToggle,
  onChange,
}: {
  name: string;
  sound: TileSound;
  open: boolean;
  onToggle: () => void;
  onChange: (s: TileSound) => void;
}) {
  const silent = sound.muted || sound.volume === 0;
  const level = sound.muted ? 0 : sound.volume;
  return (
    <>
      <button
        type="button"
        className={`person-sound${silent ? " is-silent" : ""}${open ? " is-open" : ""}`}
        onClick={onToggle}
        aria-label={`Volume de ${name}`}
        aria-expanded={open}
      >
        {silent ? <HeadsetOffIcon size={17} /> : <HeadsetIcon size={17} />}
      </button>
      {open && (
        <div className="person-sound-panel">
          <button
            type="button"
            className={`person-sound-mute${sound.muted ? " is-on" : ""}`}
            onClick={() =>
              onChange(
                silent
                  ? { volume: sound.volume || 100, muted: false }
                  : { ...sound, muted: true },
              )
            }
            aria-label={silent ? `Ativar som de ${name}` : `Mutar ${name}`}
          >
            {silent ? <HeadsetOffIcon size={15} /> : <HeadsetIcon size={15} />}
          </button>
          <input
            type="range"
            className="volume-range person-sound-range"
            min={0}
            max={100}
            step={1}
            value={level}
            onChange={(e) =>
              onChange({ volume: Number(e.target.value), muted: false })
            }
            onDoubleClick={() => onChange({ volume: 100, muted: false })}
            style={{ "--fill": `${level}%` } as React.CSSProperties}
            aria-label={`Volume de ${name}`}
          />
          <span className="person-sound-value">{level}%</span>
        </div>
      )}
    </>
  );
}
