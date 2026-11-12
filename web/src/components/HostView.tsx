"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  CameraIcon,
  EyeOffIcon,
  PhoneOffIcon,
  ScreenIcon,
} from "@/components/icons";
import Chat from "@/components/room/Chat";
import InviteLink from "@/components/room/InviteLink";
import Participants from "@/components/room/Participants";
import Settings from "@/components/room/Settings";
import CallBar from "@/components/room/CallBar";
import HeadsetMenu from "@/components/room/HeadsetMenu";
import MicMenu from "@/components/room/MicMenu";
import ScreenMenu, { type Surface } from "@/components/room/ScreenMenu";
import StageToolbar from "@/components/room/StageToolbar";
import StreamMenu from "@/components/room/StreamMenu";
import LiveIcon from "@/components/room/LiveIcon";
import { useRoom } from "@/components/room/useRoom";
import { stageStyle, useVideoAspect } from "@/components/room/useVideoAspect";
import { getConfig, loadHostToken } from "@/lib/api";
import {
  DEFAULT_OUTPUT,
  HostSession,
  type Output,
  type Quality,
} from "@/lib/host";
import {
  loadAudioSettings,
  saveAudioSettings,
  type AudioSettings,
} from "@/lib/audio";
import { errorText } from "@/lib/messages";
import {
  keyLabel,
  loadMicSettings,
  Microphone,
  saveMicSettings,
  type MicSettings,
} from "@/lib/mic";
import { loadName, type Sharing } from "@/lib/room";

export default function HostView() {
  const { id } = useParams<{ id: string }>();
  const sessionRef = useRef<HostSession | null>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Our microphone, captured the first time it is turned on and reused after.
  const micRef = useRef<MediaStreamTrack | null>(null);
  const micObjRef = useRef<Microphone | null>(null);
  const room = useRoom();

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [source, setSource] = useState<Sharing>("");
  const [quality, setQuality] = useState<Quality>("detail");
  const [output, setOutput] = useState<Output>(DEFAULT_OUTPUT);
  const [maxViewers, setMaxViewers] = useState(5);
  const [watchingIds, setWatchingIds] = useState<string[]>([]);
  // Hide our own preview while the room keeps receiving the stream.
  const [previewHidden, setPreviewHidden] = useState(false);
  // Call controls.
  const [inCall, setInCall] = useState(true);
  const [micOn, setMicOn] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [micSettings, setMicSettings] = useState<MicSettings>(loadMicSettings);
  const [pttHeld, setPttHeld] = useState(false);
  const [systemAudio, setSystemAudio] = useState<boolean>(loadSystemAudio);
  const [audioSettings, setAudioSettings] =
    useState<AudioSettings>(loadAudioSettings);

  // Browser-only values: undefined during server prerender.
  const origin = useSyncExternalStore(
    noop,
    () => window.location.origin,
    () => undefined,
  );
  const token = useSyncExternalStore(
    noop,
    () => loadHostToken(id),
    () => undefined,
  );
  const link = origin ? `${origin}/sala/${id}` : "";
  const aspect = useVideoAspect(previewRef, !!stream);

  // Connect to the signaling server as this room's host.
  const { roomEvents } = room;
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    getConfig()
      .then((cfg) => {
        if (cancelled) return;
        setMaxViewers(cfg.maxViewers);
        sessionRef.current = new HostSession(
          id,
          token,
          loadName(),
          cfg.iceServers,
          {
            ...roomEvents,
            onConnected: () => setReady(true),
            onViewers: (_joined, _watching, ids) => setWatchingIds(ids),
            onError: (reason) => setError(reason),
          },
        );
      })
      .catch(() => !cancelled && setError("server-offline"));
    return () => {
      cancelled = true;
      sessionRef.current?.stop();
      sessionRef.current = null;
    };
  }, [id, token, roomEvents]);

  // Stop capturing when leaving the page.
  useEffect(
    () => () =>
      stream?.getTracks().forEach((t) => t !== micRef.current && t.stop()),
    [stream],
  );

  // The mic only really sends while it is on, we are not deafened and,
  // in push-to-talk mode, the key is held.
  const micSending = micOn && !deafened && (!micSettings.pushToTalk || pttHeld);
  useEffect(() => {
    if (micRef.current) micRef.current.enabled = micSending;
  }, [micSending]);

  // Push-to-talk: hold the chosen key to talk (works while this tab has focus).
  const pttKey = micSettings.pushToTalk ? micSettings.pushToTalkKey : null;
  useEffect(() => {
    if (!pttKey) return;
    const down = (e: KeyboardEvent) => {
      if (e.code === pttKey && !e.repeat && !typing(e)) setPttHeld(true);
    };
    const up = (e: KeyboardEvent) => e.code === pttKey && setPttHeld(false);
    const release = () => setPttHeld(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", release);
      release();
    };
  }, [pttKey]);

  // "Stop listening" shortcut: one press toggles it.
  const deafenKey = audioSettings.deafenShortcut
    ? audioSettings.deafenKey
    : null;
  useEffect(() => {
    if (!deafenKey) return;
    const down = (e: KeyboardEvent) => {
      if (e.code === deafenKey && !e.repeat && !typing(e))
        setDeafened((d) => !d);
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [deafenKey]);

  // Release the microphone when leaving the page.
  useEffect(() => () => micObjRef.current?.stop(), []);

  const micLevel = useCallback(() => micObjRef.current?.level() ?? null, []);

  useEffect(() => {
    streamRef.current = stream;
    if (previewRef.current) previewRef.current.srcObject = stream;
  }, [stream]);

  function publish(media: MediaStream, kind: Sharing) {
    const video = media.getVideoTracks()[0];
    video.contentHint = kind === "camera" ? "motion" : quality;
    // The browser's own "Stop sharing" button (or unplugging the camera) ends the track.
    video.addEventListener("ended", () => stopSharing(media));
    // Our voice travels with whatever we share.
    const mic = micRef.current;
    if (mic && mic.readyState === "live" && !media.getTracks().includes(mic))
      media.addTrack(mic);
    streamRef.current = media;
    setStream(media);
    setSource(kind);
    setNotice(null);
    sessionRef.current?.setStream(media, quality, kind);
  }

  async function shareScreen(surface?: Surface) {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setNotice(errorText("unsupported"));
      return;
    }
    try {
      const media = await navigator.mediaDevices.getDisplayMedia({
        // displaySurface opens the browser's picker on that kind (screen / window / tab).
        video: {
          frameRate: { ideal: output.fps },
          ...(surface ? { displaySurface: surface } : {}),
        },
        audio: systemAudio, // system/tab audio when the browser allows it
        // Chrome-only hints; other browsers ignore them.
        ...({
          surfaceSwitching: "include",
          selfBrowserSurface: "exclude",
          systemAudio: systemAudio ? "include" : "exclude",
        } as object),
      });
      publish(media, "screen");
    } catch (err) {
      // NotAllowedError = the user closed the picker; nothing to report.
      if ((err as DOMException).name !== "NotAllowedError") console.error(err);
    }
  }

  async function shareCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setNotice(errorText("unsupported"));
      return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: output.fps },
        },
        audio: false, // voice comes from the mic button
      });
      publish(media, "camera");
    } catch (err) {
      const name = (err as DOMException).name;
      setNotice(
        errorText(
          name === "NotFoundError" || name === "OverconstrainedError"
            ? "camera-missing"
            : "camera-denied",
        ),
      );
    }
  }

  function stopSharing(media: MediaStream | null = stream) {
    media?.getTracks().forEach((t) => t !== micRef.current && t.stop());
    // An old capture ending after switching sources must not stop the new one.
    if (media && streamRef.current !== media) return;
    sessionRef.current?.setStream(null, quality);
    setStream((current) => (current === media ? null : current));
    setSource("");
  }

  async function toggleMic() {
    // Talking while deafened makes no sense: unmuting also brings the sound back.
    if (deafened) {
      setDeafened(false);
      setMicOn(true);
      if (micRef.current) return;
    } else if (micOn) {
      setMicOn(false);
      return;
    }
    if (micRef.current?.readyState === "live") {
      setMicOn(true);
      return;
    }
    try {
      const opened = await Microphone.open(micSettings, () => {
        // Device unplugged or taken away.
        closeMic();
        setMicOn(false);
      });
      micObjRef.current = opened;
      micRef.current = opened.track;
      setMicOn(true);
      // Add it to what we are sharing (viewers reconnect once to receive it).
      const current = streamRef.current;
      if (current) {
        current.addTrack(opened.track);
        sessionRef.current?.setStream(current, quality, source);
      }
    } catch {
      setNotice(errorText("mic-denied"));
    }
  }

  function closeMic() {
    micObjRef.current?.stop();
    micObjRef.current = null;
    micRef.current = null;
  }

  function changeSystemAudio(on: boolean) {
    setSystemAudio(on);
    try {
      localStorage.setItem(SYSTEM_AUDIO_KEY, on ? "1" : "0");
    } catch {
      // Storage blocked: the choice just won't persist.
    }
  }

  function changeAudioSettings(next: AudioSettings) {
    setAudioSettings(next);
    saveAudioSettings(next);
  }

  function changeMicSettings(next: MicSettings) {
    setMicSettings(next);
    saveMicSettings(next);
    micObjRef.current
      ?.update(next)
      .catch(() => setNotice(errorText("mic-denied")));
  }

  function toggleCamera() {
    if (source === "camera") stopSharing();
    else void shareCamera();
  }

  /** Leave the call: stop sharing and release the mic, but stay in the room. */
  function leaveCall() {
    stopSharing();
    closeMic();
    setMicOn(false);
    setDeafened(false);
    setPreviewHidden(false);
    setInCall(false);
  }

  function changeOutput(next: Output) {
    setOutput(next);
    void sessionRef.current?.setOutput(next);
  }

  function changeQuality(q: Quality) {
    setQuality(q);
    void sessionRef.current?.setQuality(q);
  }

  const problem = token === null ? "bad-token" : error;
  if (
    problem === "bad-token" ||
    problem === "server-offline" ||
    problem === "replaced" ||
    problem === "room-not-found"
  ) {
    return (
      <div className="room-message">
        <div className="hero glass">
          <p className="alert">{errorText(problem)}</p>
          <p style={{ marginTop: 24 }}>
            <Link
              className="btn btn-primary"
              href="/"
              transitionTypes={["nav-back"]}
            >
              Criar uma nova sala
            </Link>
          </p>
        </div>
      </div>
    );
  }

  const isLocalhost =
    link.includes("//localhost") || link.includes("//127.0.0.1");

  return (
    <div className="room">
      {/* Navbar: intentionally empty for now. */}
      <header className="room-nav glass" />

      <div className="room-body">
        <Participants
          participants={room.participants}
          selfId={room.selfId}
          maxViewers={maxViewers}
          watchingIds={watchingIds}
          hostSharing={!!stream}
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
                  ref={previewRef}
                  autoPlay
                  muted
                  playsInline
                  hidden={!stream || previewHidden}
                  className={source === "camera" ? "is-mirrored" : undefined}
                />
                {!stream && !inCall && (
                  <div className="stage-empty">
                    <PhoneOffIcon size={28} />
                    <p>Você saiu da chamada. Continua na sala e no chat.</p>
                    <button
                      className="share-btn"
                      onClick={() => setInCall(true)}
                    >
                      Entrar na chamada
                    </button>
                  </div>
                )}
                {!stream && inCall && (
                  <div className="stage-empty">
                    <p>Escolha o que você quer mostrar para a sala.</p>
                    <div className="share-choices">
                      <button
                        className="share-btn"
                        onClick={() => void shareScreen()}
                        disabled={!ready}
                      >
                        <ScreenIcon size={22} />
                        Compartilhar tela
                      </button>
                      <button
                        className="share-btn is-secondary"
                        onClick={shareCamera}
                        disabled={!ready}
                      >
                        <CameraIcon size={22} />
                        Compartilhar câmera
                      </button>
                    </div>
                    {!ready && <p className="hint">Conectando ao servidor…</p>}
                  </div>
                )}
                {stream && (
                  <span className="badge stage-badge">
                    <LiveIcon kind={source} />
                    {source === "camera" ? "Câmera" : "Tela"} de{" "}
                    {room.selfName || "você"}
                  </span>
                )}
                {stream && previewHidden && (
                  <div className="stage-empty stage-hidden">
                    <EyeOffIcon size={28} />
                    <p>
                      Sua tela está escondida só para você.
                      <br />A sala continua vendo normalmente.
                    </p>
                    <button
                      className="btn"
                      onClick={() => setPreviewHidden(false)}
                    >
                      Mostrar minha tela
                    </button>
                  </div>
                )}
              </div>
              {/* Controls sit outside .stage-screen so their menus are not clipped. */}
              {stream && (
                <StageToolbar
                  stageRef={stageRef}
                  videoRef={previewRef}
                  previewHidden={previewHidden}
                  onTogglePreview={() => setPreviewHidden((h) => !h)}
                >
                  <StreamMenu
                    output={output}
                    onChange={changeOutput}
                    sourceHeight={
                      stream.getVideoTracks()[0]?.getSettings().height
                    }
                  />
                </StageToolbar>
              )}
              {stream && (
                <CallBar
                  micOn={micOn}
                  pushToTalkKey={
                    micSettings.pushToTalk
                      ? keyLabel(micSettings.pushToTalkKey)
                      : undefined
                  }
                  headsetOptions={
                    <HeadsetMenu
                      settings={audioSettings}
                      onChange={changeAudioSettings}
                      takenKey={
                        micSettings.pushToTalk
                          ? micSettings.pushToTalkKey
                          : undefined
                      }
                    />
                  }
                  screenOptions={
                    <ScreenMenu
                      current={currentSurface(stream, source)}
                      currentLabel={friendlyLabel(stream)}
                      onPick={(surface) => void shareScreen(surface)}
                      systemAudio={systemAudio}
                      onSystemAudio={changeSystemAudio}
                    />
                  }
                  micOptions={
                    <MicMenu
                      settings={micSettings}
                      onChange={changeMicSettings}
                      getLevel={micLevel}
                      takenKey={
                        audioSettings.deafenShortcut
                          ? audioSettings.deafenKey
                          : undefined
                      }
                    />
                  }
                  deafened={deafened}
                  cameraOn={source === "camera"}
                  onToggleMic={() => void toggleMic()}
                  onToggleDeafen={() => setDeafened((d) => !d)}
                  onToggleCamera={toggleCamera}
                  onStopSharing={() => stopSharing()}
                  onLeaveCall={leaveCall}
                />
              )}
            </div>
          </div>

          {(notice || error) && (
            <p className="alert">{notice ?? errorText(error!)}</p>
          )}

          <InviteLink link={link} />
          {isLocalhost && (
            <p className="hint invite-hint">
              Para alguém de outro computador da mesma rede entrar, troque{" "}
              <code>localhost</code> pelo IP deste PC.
            </p>
          )}
        </section>

        <Chat
          messages={room.messages}
          selfId={room.selfId}
          disabled={!ready}
          onSend={(t) => sessionRef.current?.sendChat(t)}
          onOpenSettings={room.openSettings}
        />
      </div>

      <Settings
        open={room.settingsOpen}
        name={room.selfName}
        onClose={room.closeSettings}
        onRename={(n) => room.rename(n, (v) => sessionRef.current?.rename(v))}
        quality={quality}
        onQuality={changeQuality}
      />
    </div>
  );
}

function noop() {
  return () => {};
}

/** True while typing letters into a text field (chat, name…): shortcuts must not fire. */
function typing(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null;
  const field =
    el?.isContentEditable ||
    el?.tagName === "TEXTAREA" ||
    (el?.tagName === "INPUT" && (el as HTMLInputElement).type !== "range");
  // F-keys, Ctrl etc. still work inside fields.
  return !!field && e.key.length === 1;
}

const SYSTEM_AUDIO_KEY = "steadyscreen:systemAudio";

function loadSystemAudio(): boolean {
  try {
    return localStorage.getItem(SYSTEM_AUDIO_KEY) !== "0";
  } catch {
    return true;
  }
}

/** What kind of surface we're sharing, as the browser reports it. */
function currentSurface(
  stream: MediaStream | null,
  source: Sharing,
): Surface | "camera" | null {
  if (source === "camera") return "camera";
  const surface = (
    stream?.getVideoTracks()[0]?.getSettings() ??
    ({} as { displaySurface?: string })
  ).displaySurface;
  return surface === "monitor" || surface === "window" || surface === "browser"
    ? surface
    : null;
}

/** The window/tab title, when the browser gives a readable one (not "screen:0:0"). */
function friendlyLabel(stream: MediaStream | null): string | undefined {
  const label = stream?.getVideoTracks()[0]?.label ?? "";
  return label && !/^(screen|window|web-contents-media-stream):/.test(label)
    ? label
    : undefined;
}
