"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  CameraIcon,
  ChevronUpIcon,
  HeadsetIcon,
  HeadsetOffIcon,
  MicIcon,
  MicOffIcon,
  PhoneOffIcon,
  ScreenStopIcon,
} from "@/components/icons";

type Props = {
  micOn: boolean;
  deafened: boolean;
  cameraOn: boolean;
  /** Push-to-talk key label, when that mode is on. */
  pushToTalkKey?: string;
  /** Contents of the mic's options menu. */
  micOptions?: ReactNode;
  /** Contents of the headset's options menu. */
  headsetOptions?: ReactNode;
  /** Contents of the camera's options menu. */
  cameraOptions?: ReactNode;
  /** Contents of the share button's options menu. */
  screenOptions?: ReactNode;
  onToggleMic: () => void;
  onToggleDeafen: () => void;
  onToggleCamera: () => void;
  onStopSharing: () => void;
  onLeaveCall: () => void;
};

/** Call controls at the bottom center of the stage (host, while sharing). */
export default function CallBar(p: Props) {
  const micLive = p.micOn && !p.deafened;
  let micLabel = micLive ? "Silenciar microfone" : "Ativar microfone";
  if (micLive && p.pushToTalkKey)
    micLabel = `Segure ${p.pushToTalkKey} para falar`;

  return (
    <div className="call-bar" role="toolbar" aria-label="Controles da chamada">
      <CallButton
        label={micLabel}
        state={micLive ? "on" : "off"}
        onClick={p.onToggleMic}
        optionsLabel="Opções do microfone"
        options={p.micOptions}
      >
        {micLive ? <MicIcon size={20} /> : <MicOffIcon size={20} />}
      </CallButton>

      <CallButton
        label={p.deafened ? "Voltar a ouvir" : "Parar de ouvir"}
        state={p.deafened ? "off" : "on"}
        onClick={p.onToggleDeafen}
        optionsLabel="Opções de áudio"
        options={p.headsetOptions}
      >
        {p.deafened ? <HeadsetOffIcon size={20} /> : <HeadsetIcon size={20} />}
      </CallButton>

      <CallButton
        label={p.cameraOn ? "Parar câmera" : "Compartilhar câmera"}
        state={p.cameraOn ? "active" : "on"}
        onClick={p.onToggleCamera}
        // Off: the click opens the list to pick which camera (webcam or phone).
        clickOpens={!p.cameraOn}
        optionsLabel="Opções da câmera"
        options={p.cameraOptions}
      >
        <CameraIcon size={20} />
      </CallButton>

      <CallButton
        label="Parar de transmitir"
        state="stop"
        big
        onClick={p.onStopSharing}
        optionsLabel="Opções da transmissão"
        options={p.screenOptions}
      >
        <ScreenStopIcon size={24} />
      </CallButton>

      <CallButton label="Sair da chamada" state="leave" onClick={p.onLeaveCall}>
        <PhoneOffIcon size={22} />
      </CallButton>
    </div>
  );
}

function CallButton({
  label,
  state,
  big,
  onClick,
  optionsLabel,
  options,
  clickOpens,
  children,
}: {
  label: string;
  state: "on" | "off" | "active" | "stop" | "leave";
  big?: boolean;
  onClick: () => void;
  /** Shows the small arrow on the corner. */
  optionsLabel?: string;
  /** What the arrow opens; without it the arrow does nothing yet. */
  options?: ReactNode;
  /** The main click opens the options instead of acting. */
  clickOpens?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on a click outside or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={ref}
      className={`call-group is-${state}${big ? " is-big" : ""}${open ? " is-open" : ""}`}
    >
      <button
        type="button"
        className="call-btn"
        onClick={() => (clickOpens && options ? setOpen((o) => !o) : onClick())}
        aria-label={label}
      >
        {children}
        <span className="tool-tip" aria-hidden>
          {label}
        </span>
      </button>
      {optionsLabel && (
        <button
          type="button"
          className="call-more"
          aria-label={optionsLabel}
          aria-expanded={options ? open : undefined}
          aria-disabled={options ? undefined : "true"}
          onClick={() => options && setOpen((o) => !o)}
        >
          <ChevronUpIcon size={14} />
        </button>
      )}
      {open && options && (
        <div
          className="call-menu"
          role="dialog"
          aria-label={optionsLabel}
          // Picking a source (a webcam, a phone) closes the menu.
          onClick={(e) =>
            (e.target as HTMLElement).closest("[data-pick]") && setOpen(false)
          }
        >
          {options}
        </div>
      )}
    </div>
  );
}
