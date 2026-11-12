"use client";

import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";
import {
  ExpandIcon,
  EyeIcon,
  EyeOffIcon,
  GridIcon,
  PipIcon,
  ShrinkIcon,
} from "@/components/icons";

type Props = {
  stageRef: RefObject<HTMLElement | null>;
  videoRef: RefObject<HTMLVideoElement | null>;
  /** Host only: hide our own preview while still sharing. */
  previewHidden?: boolean;
  onTogglePreview?: () => void;
  /** Show every screen side by side. */
  grid?: boolean;
  onToggleGrid?: () => void;
  /** Extra buttons placed first (e.g. the viewer's sound toggle). */
  children?: ReactNode;
};

/** Bottom-right controls over the stage: hide preview, picture-in-picture, fullscreen. */
export default function StageToolbar({
  stageRef,
  videoRef,
  previewHidden,
  onTogglePreview,
  grid,
  onToggleGrid,
  children,
}: Props) {
  const fullscreen = useSyncExternalStore(
    subscribeFullscreen,
    () => !!document.fullscreenElement,
    () => false,
  );
  const pipSupported = useSyncExternalStore(
    noopSubscribe,
    () => !!document.pictureInPictureEnabled,
    () => false,
  );
  const [pip, setPip] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const on = () => setPip(true);
    const off = () => setPip(false);
    video.addEventListener("enterpictureinpicture", on);
    video.addEventListener("leavepictureinpicture", off);
    return () => {
      video.removeEventListener("enterpictureinpicture", on);
      video.removeEventListener("leavepictureinpicture", off);
    };
  }, [videoRef]);

  useIdleControls(stageRef);

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void stageRef.current?.requestFullscreen();
  }

  function togglePip() {
    if (document.pictureInPictureElement) void document.exitPictureInPicture();
    else void videoRef.current?.requestPictureInPicture().catch(() => {});
  }

  return (
    <div className="stage-toolbar">
      {onToggleGrid && (
        <ToolButton
          label={grid ? "Sair da grade" : "Ver todas as telas"}
          onClick={onToggleGrid}
          active={grid}
        >
          <GridIcon size={18} />
        </ToolButton>
      )}
      {children}
      {onTogglePreview && (
        <ToolButton
          label={previewHidden ? "Mostrar minha tela" : "Esconder minha tela"}
          onClick={onTogglePreview}
          active={previewHidden}
        >
          {previewHidden ? <EyeIcon size={18} /> : <EyeOffIcon size={18} />}
        </ToolButton>
      )}
      {pipSupported && (
        <ToolButton
          label={pip ? "Sair do Picture in Picture" : "Picture in Picture"}
          onClick={togglePip}
          active={pip}
        >
          <PipIcon size={18} />
        </ToolButton>
      )}
      <ToolButton
        label={fullscreen ? "Sair da tela cheia" : "Tela cheia"}
        onClick={toggleFullscreen}
      >
        {fullscreen ? <ShrinkIcon size={18} /> : <ExpandIcon size={18} />}
      </ToolButton>
    </div>
  );
}

export function ToolButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`tool-btn${active ? " is-active" : ""}`}
      onClick={onClick}
      aria-label={label}
    >
      {children}
      <span className="tool-tip" aria-hidden>
        {label}
      </span>
    </button>
  );
}

/** Like video players: after this long without moving the mouse, the controls fade out. */
const IDLE_MS = 3000;

/**
 * Marks the stage with data-idle when the mouse rests on it; any movement,
 * click or key brings the controls back. Never hides while the mouse is on
 * the controls themselves or a menu is open.
 */
function useIdleControls(stageRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let timer = 0;

    const sleep = () => {
      const busy = stage.querySelector(
        ".stage-toolbar:hover, .call-bar:hover, .stream-menu.is-open, .call-group.is-open",
      );
      if (busy) wake();
      else stage.dataset.idle = "";
    };
    const wake = () => {
      delete stage.dataset.idle;
      window.clearTimeout(timer);
      timer = window.setTimeout(sleep, IDLE_MS);
    };
    const leave = () => {
      window.clearTimeout(timer);
      delete stage.dataset.idle;
    };

    stage.addEventListener("pointermove", wake);
    stage.addEventListener("pointerdown", wake);
    stage.addEventListener("keydown", wake);
    stage.addEventListener("pointerleave", leave);
    return () => {
      leave();
      stage.removeEventListener("pointermove", wake);
      stage.removeEventListener("pointerdown", wake);
      stage.removeEventListener("keydown", wake);
      stage.removeEventListener("pointerleave", leave);
    };
  }, [stageRef]);
}

function subscribeFullscreen(cb: () => void) {
  document.addEventListener("fullscreenchange", cb);
  return () => document.removeEventListener("fullscreenchange", cb);
}

function noopSubscribe() {
  return () => {};
}
