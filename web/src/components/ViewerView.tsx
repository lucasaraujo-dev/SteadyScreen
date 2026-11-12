"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getConfig } from "@/lib/api";
import { errorText } from "@/lib/messages";
import { ViewerSession, type ViewerStatus } from "@/lib/viewer";

const STATUS_TEXT: Record<Exclude<ViewerStatus, "live" | "error">, string> = {
  connecting: "Conectando…",
  "waiting-host": "Aguardando quem vai compartilhar entrar na sala…",
  "waiting-stream": "Aguardando a transmissão começar…",
  starting: "Iniciando a transmissão…",
  reconnecting: "A conexão caiu. Reconectando…",
};

export default function ViewerView() {
  const { id } = useParams<{ id: string }>();
  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [status, setStatus] = useState<ViewerStatus>("connecting");
  const [reason, setReason] = useState<string>("");
  const [hasAudio, setHasAudio] = useState(false);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    let session: ViewerSession | null = null;
    let cancelled = false;
    getConfig()
      .then((cfg) => {
        if (cancelled) return;
        session = new ViewerSession(id, cfg.iceServers, {
          onStatus: (s, r) => {
            setStatus(s);
            setReason(r ?? "");
          },
          onStream: (stream) => {
            const video = videoRef.current;
            if (!video) return;
            if (video.srcObject !== stream) video.srcObject = stream;
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
      session?.stop();
    };
  }, [id]);

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
      <div className="hero glass">
        <p className="alert">{errorText(reason)}</p>
        <p style={{ marginTop: 24 }}>
          <Link className="btn" href="/">
            Voltar ao início
          </Link>
        </p>
      </div>
    );
  }

  const live = status === "live";

  return (
    <div className="session" style={{ gridTemplateColumns: "1fr" }}>
      <div ref={stageRef} className="stage glass">
        <div className="stage-screen">
          <video ref={videoRef} autoPlay muted playsInline hidden={!live} onDoubleClick={fullscreen} />
          {!live && (
            <div className="stage-empty">
              {status === "error" ? <p>{errorText(reason)}</p> : <div className="spinner" aria-hidden />}
              {status !== "error" && <p>{STATUS_TEXT[status]}</p>}
            </div>
          )}
          {live && (
            <div className="stage-toolbar">
              {hasAudio && (
                <button className="btn" onClick={toggleSound}>
                  {muted ? "Ativar som" : "Silenciar"}
                </button>
              )}
              <button className="btn" onClick={fullscreen}>
                Tela cheia
              </button>
            </div>
          )}
        </div>
      </div>
      <div>
        {live ? <span className="badge badge-live">Ao vivo</span> : <span className="badge">Sala {id}</span>}
      </div>
    </div>
  );
}
