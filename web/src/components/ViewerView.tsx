"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { MuteIcon, SoundIcon } from "@/components/icons";
import Chat from "@/components/room/Chat";
import InviteLink from "@/components/room/InviteLink";
import Participants from "@/components/room/Participants";
import Settings from "@/components/room/Settings";
import StageToolbar, { ToolButton } from "@/components/room/StageToolbar";
import LiveIcon from "@/components/room/LiveIcon";
import RoomNav from "@/components/room/RoomNav";
import { useRoom } from "@/components/room/useRoom";
import { stageStyle, useVideoAspect } from "@/components/room/useVideoAspect";
import { getConfig } from "@/lib/api";
import { loadAudioSettings, routeTo } from "@/lib/audio";
import { errorText } from "@/lib/messages";
import { loadName } from "@/lib/room";
import { ViewerSession, type ViewerStatus } from "@/lib/viewer";

const STATUS_TEXT: Record<Exclude<ViewerStatus, "live" | "error">, string> = {
  connecting: "Conectando…",
  "waiting-host": "Aguardando o anfitrião entrar na sala…",
  "waiting-stream": "Aguardando a transmissão começar…",
  starting: "Iniciando a transmissão…",
  reconnecting: "A conexão caiu. Reconectando…",
};

export default function ViewerView() {
  const { id } = useParams<{ id: string }>();
  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<ViewerSession | null>(null);
  const room = useRoom();

  const [status, setStatus] = useState<ViewerStatus>("connecting");
  const [reason, setReason] = useState<string>("");
  const [hasAudio, setHasAudio] = useState(false);
  const [muted, setMuted] = useState(true);
  const [maxViewers, setMaxViewers] = useState(5);

  const origin = useSyncExternalStore(
    noop,
    () => window.location.origin,
    () => undefined,
  );
  const link = origin ? `${origin}/sala/${id}` : "";
  const live = status === "live";
  const aspect = useVideoAspect(videoRef, live);

  const { roomEvents } = room;
  useEffect(() => {
    let cancelled = false;
    getConfig()
      .then((cfg) => {
        if (cancelled) return;
        setMaxViewers(cfg.maxViewers);
        sessionRef.current = new ViewerSession(id, loadName(), cfg.iceServers, {
          ...roomEvents,
          onStatus: (s, r) => {
            setStatus(s);
            setReason(r ?? "");
          },
          onStream: (stream) => {
            const video = videoRef.current;
            if (!video) return;
            if (video.srcObject !== stream) video.srcObject = stream;
            // Play on the speakers/headphones picked in the audio menu.
            void routeTo(video, loadAudioSettings().outputId);
            setHasAudio(!!stream?.getAudioTracks().length);
            // Muted autoplay is always allowed; sound needs a click.
            if (stream) video.play().catch(() => {});
          },
        });
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("error");
        setReason("server-offline");
      });
    return () => {
      cancelled = true;
      sessionRef.current?.stop();
      sessionRef.current = null;
    };
  }, [id, roomEvents]);

  function toggleSound() {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
    void video.play().catch(() => {});
  }

  function fullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void stageRef.current?.requestFullscreen();
  }

  if (status === "error" && reason !== "negotiation-failed") {
    return (
      <div className="room-message">
        <div className="hero glass">
          <p className="alert">{errorText(reason)}</p>
          <p style={{ marginTop: 24 }}>
            <Link className="btn" href="/" transitionTypes={["nav-back"]}>
              Voltar ao início
            </Link>
          </p>
        </div>
      </div>
    );
  }

  const host = room.participants.find((p) => p.role === "host");

  return (
    <div className="room">
      <RoomNav
        roomId={id}
        participants={room.participants}
        notices={room.notices}
        unread={room.unreadNotices}
        onOpenNotices={room.markNoticesSeen}
        onOpenSettings={room.openSettings}
      />

      <div className="room-body">
        <Participants
          participants={room.participants}
          selfId={room.selfId}
          maxViewers={maxViewers}
        />

        <section className="room-center">
          <div className="stage-area">
            <div
              ref={stageRef}
              className={`stage glass${aspect ? " is-fit" : ""}`}
              style={stageStyle(aspect)}
            >
              <div className="stage-screen">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  hidden={!live}
                  onDoubleClick={fullscreen}
                />
                {!live && (
                  <div className="stage-empty">
                    {status === "error" ? (
                      <p>{errorText(reason)}</p>
                    ) : (
                      <div className="spinner" aria-hidden />
                    )}
                    {status !== "error" && <p>{STATUS_TEXT[status]}</p>}
                  </div>
                )}
                {live && (
                  <>
                    <span className="badge stage-badge">
                      <LiveIcon kind={host?.sharing || "screen"} />
                      {host?.sharing === "camera" ? "Câmera" : "Tela"} de{" "}
                      {host?.name ?? "Anfitrião"}
                    </span>
                    <StageToolbar stageRef={stageRef} videoRef={videoRef}>
                      {hasAudio && (
                        <ToolButton
                          label={muted ? "Ativar som" : "Silenciar"}
                          onClick={toggleSound}
                          active={!muted}
                        >
                          {muted ? (
                            <MuteIcon size={18} />
                          ) : (
                            <SoundIcon size={18} />
                          )}
                        </ToolButton>
                      )}
                    </StageToolbar>
                  </>
                )}
              </div>
            </div>
          </div>

          <InviteLink link={link} />
        </section>

        <Chat
          messages={room.messages}
          selfId={room.selfId}
          disabled={!room.selfId}
          onSend={(t) => sessionRef.current?.sendChat(t)}
        />
      </div>

      <Settings
        open={room.settingsOpen}
        name={room.selfName}
        onClose={room.closeSettings}
        onRename={(n) => room.rename(n, (v) => sessionRef.current?.rename(v))}
      />
    </div>
  );
}

function noop() {
  return () => {};
}
