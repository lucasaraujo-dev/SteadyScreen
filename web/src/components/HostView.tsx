"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getConfig, loadHostToken } from "@/lib/api";
import { HostSession, type Quality } from "@/lib/host";
import { errorText } from "@/lib/messages";

export default function HostView() {
  const { id } = useParams<{ id: string }>();
  const sessionRef = useRef<HostSession | null>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [quality, setQuality] = useState<Quality>("detail");
  const [viewers, setViewers] = useState({ joined: 0, watching: 0, max: 5 });
  // Browser-only values: undefined during server prerender.
  const origin = useSyncExternalStore(noop, () => window.location.origin, () => undefined);
  const token = useSyncExternalStore(noop, () => loadHostToken(id), () => undefined);
  const link = origin ? `${origin}/sala/${id}` : "";
  const [copied, setCopied] = useState(false);

  // Connect to the signaling server as this room's host.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    getConfig()
      .then((cfg) => {
        if (cancelled) return;
        setViewers((v) => ({ ...v, max: cfg.maxViewers }));
        sessionRef.current = new HostSession(id, token, cfg.iceServers, {
          onConnected: () => setReady(true),
          onViewers: (joined, watching) => setViewers((v) => ({ ...v, joined, watching })),
          onError: (reason) => setError(reason),
        });
      })
      .catch(() => !cancelled && setError("server-offline"));
    return () => {
      cancelled = true;
      sessionRef.current?.stop();
      sessionRef.current = null;
    };
  }, [id, token]);

  // Stop capturing when leaving the page.
  useEffect(() => () => stream?.getTracks().forEach((t) => t.stop()), [stream]);

  useEffect(() => {
    streamRef.current = stream;
    if (previewRef.current) previewRef.current.srcObject = stream;
  }, [stream]);

  async function startSharing() {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError("unsupported");
      return;
    }
    try {
      const media = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: quality === "motion" ? 60 : 30 } },
        audio: true, // system/tab audio when the browser allows it
        // Chrome-only hints; other browsers ignore them.
        ...({ surfaceSwitching: "include", selfBrowserSurface: "exclude", systemAudio: "include" } as object),
      });
      const video = media.getVideoTracks()[0];
      video.contentHint = quality;
      // The browser's own "Stop sharing" button ends the track.
      video.addEventListener("ended", () => stopSharing(media));
      streamRef.current = media;
      setStream(media);
      sessionRef.current?.setStream(media, quality);
    } catch (err) {
      // NotAllowedError = the user closed the picker; nothing to report.
      if ((err as DOMException).name !== "NotAllowedError") console.error(err);
    }
  }

  function stopSharing(media: MediaStream | null = stream) {
    media?.getTracks().forEach((t) => t.stop());
    // An old capture ending after "Trocar tela" must not stop the new one.
    if (media && streamRef.current !== media) return;
    sessionRef.current?.setStream(null, quality);
    setStream((current) => (current === media ? null : current));
  }

  function changeQuality(q: Quality) {
    setQuality(q);
    void sessionRef.current?.setQuality(q);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  const problem = token === null ? "bad-token" : error;
  if (problem === "bad-token" || problem === "server-offline" || problem === "unsupported") {
    return (
      <div className="hero">
        <p className="alert">{errorText(problem)}</p>
        <p style={{ marginTop: 24 }}>
          <Link className="btn btn-primary" href="/">
            Criar uma nova sala
          </Link>
        </p>
      </div>
    );
  }
  const isLocalhost = link.includes("//localhost") || link.includes("//127.0.0.1");

  return (
    <div className="session">
      <div className="stage">
        <video ref={previewRef} autoPlay muted playsInline hidden={!stream} />
        {!stream && (
          <div className="stage-empty">
            <p>Escolha o que você quer mostrar: a tela inteira, uma janela ou uma aba.</p>
            <button className="btn btn-primary btn-lg" onClick={startSharing} disabled={!ready}>
              {ready ? "Escolher tela" : "Conectando…"}
            </button>
          </div>
        )}
      </div>

      <aside className="panel">
        <div>
          {stream ? (
            <span className="badge badge-live">Ao vivo</span>
          ) : (
            <span className="badge">{ready ? "Pronto para compartilhar" : "Conectando ao servidor…"}</span>
          )}
        </div>

        {error && <p className="alert">{errorText(error)}</p>}

        <div>
          <h2>Link para assistir</h2>
          <div className="field">
            <input readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Link da sala" />
            <button className="btn" onClick={copyLink}>
              {copied ? "Copiado!" : "Copiar"}
            </button>
          </div>
          <p className="hint">
            Código da sala: <strong>{id}</strong>
          </p>
          {isLocalhost && (
            <p className="hint">
              Para assistir em outro computador da mesma rede, troque <code>localhost</code> pelo IP deste PC.
            </p>
          )}
        </div>

        <div>
          <h2>Assistindo</h2>
          <p className="stat">
            {viewers.watching} <small>de {viewers.max} lugares</small>
          </p>
          {viewers.joined > viewers.watching && (
            <p className="hint">
              {viewers.joined - viewers.watching} {stream ? "conectando…" : "esperando você começar"}
            </p>
          )}
        </div>

        <div>
          <h2>Qualidade</h2>
          <div className="segmented">
            <button className="btn" aria-pressed={quality === "detail"} onClick={() => changeQuality("detail")}>
              Texto nítido
              <small>código, slides, documentos</small>
            </button>
            <button className="btn" aria-pressed={quality === "motion"} onClick={() => changeQuality("motion")}>
              Movimento suave
              <small>vídeos e jogos</small>
            </button>
          </div>
        </div>

        {stream && (
          <div className="field">
            <button className="btn" style={{ flex: 1 }} onClick={startSharing}>
              Trocar tela
            </button>
            <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => stopSharing()}>
              Parar
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}

function noop() {
  return () => {};
}
