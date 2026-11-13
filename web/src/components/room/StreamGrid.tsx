"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MuteIcon, SoundIcon } from "@/components/icons";
import LiveIcon from "@/components/room/LiveIcon";
import { routeTo } from "@/lib/audio";
import type { Sharing } from "@/lib/room";

export type GridTile = {
  id: string;
  name: string;
  kind: Exclude<Sharing, "">;
  stream: MediaStream;
  self?: boolean;
};

/** How loud we hear one person's screen. */
export type TileSound = { volume: number; muted: boolean };
export const DEFAULT_SOUND: TileSound = { volume: 100, muted: false };

/**
 * Every screen in the room. Without `mainId`: a grid of equal tiles. With it:
 * that screen big on top and the rest in a row below, all kept at 16:9.
 * Tiles are never reordered in the DOM (only with CSS `order`), so their
 * videos keep playing when the layout changes.
 */
export default function StreamGrid({
  tiles,
  mainId,
  onPick,
  sounds,
  onSound,
  outputId,
}: {
  tiles: GridTile[];
  mainId?: string | null;
  onPick: (id: string) => void;
  sounds: Record<string, TileSound>;
  onSound: (id: string, sound: TileSound) => void;
  /** Speakers chosen in the audio menu. */
  outputId?: string;
}) {
  const spotlight = !!mainId && tiles.some((t) => t.id === mainId);
  // Columns that keep the tiles as large as possible: 1, 2, 2, 2, 3…
  const cols = Math.ceil(Math.sqrt(tiles.length));
  return (
    <div
      className={`stream-grid${spotlight ? " is-spotlight" : ""}`}
      style={
        {
          "--cols": cols,
          "--rows": Math.ceil(tiles.length / cols),
          "--others": Math.max(tiles.length - 1, 1),
        } as React.CSSProperties
      }
    >
      {tiles.map((t) => {
        const main = spotlight && t.id === mainId;
        const sound = sounds[t.id] ?? DEFAULT_SOUND;
        return (
          // A div, not a <button>: the sound button lives inside it.
          <div
            key={t.id}
            role="button"
            tabIndex={0}
            className={`grid-tile${main ? " is-main" : ""}`}
            onClick={() => onPick(t.id)}
            onKeyDown={(e) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onPick(t.id);
              }
            }}
            aria-label={main ? `Ver só ${label(t)}` : `Ampliar ${label(t)}`}
          >
            <StreamVideo
              stream={t.stream}
              mirrored={t.kind === "camera"}
              // We never hear our own screen (it would echo).
              sound={t.self ? undefined : sound}
              outputId={outputId}
            />
            <span className="grid-name">
              <LiveIcon kind={t.kind} size={14} />
              {label(t)}
            </span>
            {!t.self && (
              <SoundControl
                name={t.name}
                sound={sound}
                onChange={(s) => onSound(t.id, s)}
              />
            )}
          </div>
        );
      })}
      {/* Line break between the big screen and the row below it. */}
      {spotlight && <span className="grid-break" aria-hidden />}
    </div>
  );
}

/** Speaker button on a tile: click opens mute + volume for that screen. */
export function SoundControl({
  name,
  sound,
  onChange,
}: {
  name: string;
  sound: TileSound;
  onChange: (s: TileSound) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const silent = sound.muted || sound.volume === 0;

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div
      ref={ref}
      className={`tile-sound${open ? " is-open" : ""}${silent ? " is-silent" : ""}`}
      // Clicks here adjust the sound; they must not open the screen.
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {open && (
        <div className="tile-sound-panel">
          <button
            type="button"
            className="tile-sound-mute"
            onClick={() => onChange({ ...sound, muted: !sound.muted })}
            aria-label={sound.muted ? `Ativar som de ${name}` : `Mutar ${name}`}
          >
            {silent ? <MuteIcon size={16} /> : <SoundIcon size={16} />}
          </button>
          <input
            type="range"
            className="volume-range tile-sound-range"
            min={0}
            max={100}
            step={1}
            value={sound.muted ? 0 : sound.volume}
            onChange={(e) =>
              onChange({ volume: Number(e.target.value), muted: false })
            }
            style={
              {
                "--fill": `${sound.muted ? 0 : sound.volume}%`,
              } as React.CSSProperties
            }
            aria-label={`Volume de ${name}`}
          />
          <span className="tile-sound-value">
            {sound.muted ? 0 : sound.volume}%
          </span>
        </div>
      )}
      <button
        type="button"
        className="tile-sound-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Som de ${name}`}
        aria-expanded={open}
      >
        {silent ? <MuteIcon size={16} /> : <SoundIcon size={16} />}
      </button>
    </div>
  );
}

export function label(t: Pick<GridTile, "name" | "kind" | "self">) {
  const what = t.kind === "camera" ? "Câmera" : "Tela";
  return t.self ? `${what} de ${t.name} (você)` : `${what} de ${t.name}`;
}

/**
 * A <video> playing a stream (srcObject can't be set as a prop). Silent unless
 * `sound` is given; then it plays at that volume on the chosen speakers.
 */
export function StreamVideo({
  stream,
  mirrored,
  sound,
  outputId,
}: {
  stream: MediaStream;
  mirrored?: boolean;
  sound?: TileSound;
  outputId?: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const attach = useCallback(
    (el: HTMLVideoElement | null) => {
      videoRef.current = el;
      if (el && el.srcObject !== stream) el.srcObject = stream;
    },
    [stream],
  );

  const muted = !sound || sound.muted || sound.volume === 0;
  const volume = sound?.volume ?? 100;
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = muted;
    el.volume = Math.min(1, volume / 100);
  }, [muted, volume]);

  useEffect(() => {
    if (videoRef.current && outputId !== undefined && !muted)
      void routeTo(videoRef.current, outputId);
  }, [outputId, muted]);

  return (
    <video
      ref={attach}
      autoPlay
      muted
      playsInline
      className={mirrored ? "is-mirrored" : undefined}
    />
  );
}
