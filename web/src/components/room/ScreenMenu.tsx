"use client";

import {
  CameraIcon,
  ScreenIcon,
  TabIcon,
  WindowIcon,
} from "@/components/icons";
import { Toggle } from "@/components/room/MenuControls";

export type Surface = "monitor" | "window" | "browser";

type Props = {
  /** What is being shared right now ("camera" when the camera is the source). */
  current: Surface | "camera" | null;
  /** Name the browser gives the shared screen/window/tab, if any. */
  currentLabel?: string;
  onPick: (surface: Surface) => void;
  systemAudio: boolean;
  onSystemAudio: (on: boolean) => void;
};

const CHOICES: {
  surface: Surface;
  label: string;
  hint: string;
  icon: React.ReactNode;
}[] = [
  {
    surface: "monitor",
    label: "Tela inteira",
    hint: "Um monitor inteiro",
    icon: <ScreenIcon size={22} />,
  },
  {
    surface: "window",
    label: "Janela",
    hint: "Só um programa",
    icon: <WindowIcon size={22} />,
  },
  {
    surface: "browser",
    label: "Aba",
    hint: "Uma aba do navegador",
    icon: <TabIcon size={22} />,
  },
];

/** Options under the share button's arrow: switch what is shared, and system audio. */
export default function ScreenMenu({
  current,
  currentLabel,
  onPick,
  systemAudio,
  onSystemAudio,
}: Props) {
  const now =
    current === "camera"
      ? "Câmera"
      : (CHOICES.find((c) => c.surface === current)?.label ?? "Tela");

  return (
    <div className="mic-menu screen-menu">
      <h3 className="menu-title">Transmissão</h3>

      <div className="screen-now">
        <span className="screen-now-icon">
          {current === "camera" ? (
            <CameraIcon size={16} />
          ) : (
            <ScreenIcon size={16} />
          )}
        </span>
        <span className="screen-now-text">
          <small>Compartilhando agora</small>
          <strong title={currentLabel}>
            {currentLabel && current !== "camera"
              ? `${now} · ${currentLabel}`
              : now}
          </strong>
        </span>
      </div>

      <div className="menu-field">
        <span>Trocar para</span>
        <div className="screen-choices">
          {CHOICES.map((c) => (
            <button
              key={c.surface}
              type="button"
              className={`screen-choice${c.surface === current ? " is-current" : ""}`}
              onClick={() => onPick(c.surface)}
              title={c.hint}
            >
              {c.icon}
              <span>{c.label}</span>
            </button>
          ))}
        </div>
        <small className="menu-note">
          O navegador abre a lista para você escolher qual. A sala continua
          conectada.
        </small>
      </div>

      <Toggle
        label="Som do computador"
        hint="Envia o áudio da tela junto. Vale na próxima troca."
        checked={systemAudio}
        onChange={onSystemAudio}
      />
    </div>
  );
}
