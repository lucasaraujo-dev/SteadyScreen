"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CameraIcon, CloseIcon, MicIcon, PhoneIcon } from "@/components/icons";
import { logOutAccount, useAccount } from "@/lib/account";
import { getConfig } from "@/lib/api";
import { errorText } from "@/lib/messages";
import { PhoneSender, type PhoneRequest } from "@/lib/phoneSender";

type Live = {
  camera: MediaStream | null;
  mic: MediaStream | null;
  mirrored: boolean;
};
const NOTHING: Live = { camera: null, mic: null, mirrored: true };

/**
 * What a linked phone shows (/celular): just the account, and the requests
 * from the computer to use this phone's camera or microphone. Nothing is
 * sent until the person accepts here.
 */
export default function PhonePanel() {
  const account = useAccount();
  const user = account.status === "user" ? account.user : null;
  const previewRef = useRef<HTMLVideoElement>(null);
  const [sender, setSender] = useState<PhoneSender | null>(null);
  const [request, setRequest] = useState<PhoneRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  // What is being sent (copied from the sender whenever it changes).
  const [live, setLive] = useState<Live>(NOTHING);

  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    let made: PhoneSender | null = null;
    getConfig()
      .then((cfg) => {
        if (cancelled) return;
        const s = new PhoneSender(cfg.iceServers, {
          onConnected: () => {},
          onRequest: (req) => {
            setRequest(req);
            navigator.vibrate?.([120, 80, 120]);
          },
          onCalls: () =>
            setLive({
              camera: s.active("camera"),
              mic: s.active("mic"),
              mirrored: s.facing === "user",
            }),
          onError: setError,
        });
        made = s;
        setSender(s);
      })
      .catch(() => !cancelled && setError("server-offline"));
    return () => {
      cancelled = true;
      made?.close();
      setSender(null);
      setLive(NOTHING);
    };
  }, [userId]);

  const { camera, mic } = live;
  const sending = !!camera || !!mic;

  // Show what the camera is sending (flipping keeps the same stream object,
  // so the track list is part of the key).
  const cameraTrack = camera?.getVideoTracks()[0]?.id;
  useEffect(() => {
    if (previewRef.current) previewRef.current.srcObject = camera;
  }, [camera, cameraTrack]);

  // Keep the screen on while sending (phones stop the camera when they sleep).
  useEffect(() => {
    if (!sending || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let released = false;
    navigator.wakeLock
      .request("screen")
      .then((l) => {
        if (released) void l.release();
        else lock = l;
      })
      .catch(() => {});
    return () => {
      released = true;
      void lock?.release();
    };
  }, [sending]);

  async function accept() {
    const req = request;
    setRequest(null);
    if (req) await sender?.accept(req);
  }

  function decline() {
    if (request) sender?.decline(request);
    setRequest(null);
  }

  if (account.status === "loading") {
    return (
      <div className="phone-page">
        <div className="spinner" aria-hidden />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="phone-page">
        <div className="phone-card phone-empty">
          <span className="phone-big-icon">
            <PhoneIcon size={30} />
          </span>
          <h1>Este celular não está vinculado</h1>
          <p>
            No computador, abra as <strong>Configurações da conta</strong>,
            toque em <strong>Celular → Vincular</strong> e leia o QR code com a
            câmera deste celular.
          </p>
          <Link className="phone-btn" href="/">
            Ir para o início
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="phone-page">
      {camera && (
        <section className="phone-card phone-live">
          <video
            ref={previewRef}
            className={live.mirrored ? "is-mirrored" : undefined}
            autoPlay
            muted
            playsInline
          />
          <span className="phone-live-badge">
            <span className="phone-status-dot" /> Câmera ao vivo
          </span>
          <div className="phone-live-actions">
            <button
              type="button"
              className="phone-btn is-ghost"
              onClick={() => void sender?.flip()}
            >
              Virar câmera
            </button>
            <button
              type="button"
              className="phone-btn is-stop"
              onClick={() => sender?.stop("camera")}
            >
              Parar câmera
            </button>
          </div>
        </section>
      )}

      {mic && (
        <section className="phone-card phone-mic">
          <span className="phone-mic-icon">
            <MicIcon size={20} />
          </span>
          <span>
            <strong>Microfone ligado</strong>
            <small>O computador está usando o microfone deste celular.</small>
          </span>
          <button
            type="button"
            className="phone-btn is-stop is-small"
            onClick={() => sender?.stop("mic")}
          >
            Parar
          </button>
        </section>
      )}

      {!sending && (
        <section className="phone-idle">
          <span className="phone-idle-icon">
            <PhoneIcon size={34} />
          </span>
          <h1>Pronto para usar</h1>
          <p>
            Deixe esta página aberta. Quando você pedir a câmera ou o microfone
            do celular numa sala no computador, o pedido aparece aqui.
          </p>
        </section>
      )}

      <button
        type="button"
        className="phone-logout"
        onClick={() => void logOutAccount()}
      >
        Sair da conta neste celular
      </button>

      {request &&
        createPortal(
          <div className="phone-sheet-back" role="presentation">
            <div
              className="phone-sheet"
              role="alertdialog"
              aria-label="Pedido do computador"
            >
              <button
                type="button"
                className="phone-sheet-close"
                onClick={decline}
                aria-label="Recusar"
              >
                <CloseIcon size={16} />
              </button>
              <span className="phone-ask-icon">
                {request.kind === "camera" ? (
                  <CameraIcon size={40} />
                ) : (
                  <MicIcon size={40} />
                )}
              </span>
              <h2>
                Usar {request.kind === "camera" ? "a câmera" : "o microfone"}?
              </h2>
              <p>
                A sala <strong>#{request.room}</strong> no computador quer usar{" "}
                {request.kind === "camera"
                  ? "a câmera deste celular"
                  : "o microfone deste celular"}
                .
              </p>
              <div className="phone-sheet-actions">
                <button
                  type="button"
                  className="phone-btn is-ghost"
                  onClick={decline}
                >
                  Recusar
                </button>
                <button
                  type="button"
                  className="phone-btn"
                  onClick={() => void accept()}
                >
                  Aceitar
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {error && (
        <PhoneNotice
          key={error}
          message={errorText(error)}
          onDone={() => setError(null)}
        />
      )}
    </div>
  );
}

/** A notice made for the phone: wide, at the top, goes away by itself or
 * with a tap. */
function PhoneNotice({
  message,
  onDone,
}: {
  message: string;
  onDone: () => void;
}) {
  const [leaving, setLeaving] = useState(false);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    const out = setTimeout(() => setLeaving(true), 5000);
    return () => clearTimeout(out);
  }, []);
  useEffect(() => {
    if (!leaving) return;
    const gone = setTimeout(() => done.current(), 260);
    return () => clearTimeout(gone);
  }, [leaving]);

  // On the body, so it sits on the phone's screen and not inside the page.
  return createPortal(
    <button
      type="button"
      className={`phone-notice${leaving ? " is-leaving" : ""}`}
      role="alert"
      onClick={() => setLeaving(true)}
    >
      <span className="phone-notice-icon" aria-hidden>
        !
      </span>
      <span className="phone-notice-text">
        <strong>Algo deu errado</strong>
        {message}
      </span>
    </button>,
    document.body,
  );
}
