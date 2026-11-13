"use client";

import { useEffect, useState } from "react";
import { CameraIcon, PhoneIcon } from "@/components/icons";
import PhoneRows from "@/components/room/PhoneRows";
import type { Phone } from "@/lib/phoneBridge";

type Props = {
  /** The webcam in use right now ("" = system default), or null when none is. */
  webcamId: string | null;
  /** Start (or switch to) this webcam; "" = the system default. */
  onWebcam: (deviceId: string) => void;
  /** Linked phones online, and the one whose camera is in use. */
  phones: Phone[];
  phoneId?: string;
  onPhone: (phone: Phone) => void;
  /** Turn the camera off. */
  onStop: () => void;
  /** Ask the phone in use to switch front / back camera. */
  onFlip: () => void;
};

const CAMERA_KEY = "steadyscreen:camera";

export function loadCameraId(): string {
  try {
    return localStorage.getItem(CAMERA_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveCameraId(id: string) {
  try {
    localStorage.setItem(CAMERA_KEY, id);
  } catch {
    // Storage blocked: the choice just won't persist.
  }
}

async function listCameras(): Promise<MediaDeviceInfo[]> {
  const all = await navigator.mediaDevices.enumerateDevices();
  return all.filter((d) => d.kind === "videoinput");
}

/**
 * Which camera to share: this computer's webcams and the linked phones. It
 * always opens, also with no webcam plugged in (then the phone is the way).
 */
export default function CameraMenu({
  webcamId,
  onWebcam,
  phones,
  phoneId,
  onPhone,
  onStop,
  onFlip,
}: Props) {
  // null until the first listing comes back, so "no webcam" doesn't flash.
  const [devices, setDevices] = useState<MediaDeviceInfo[] | null>(null);

  useEffect(() => {
    let alive = true;
    const refresh = () =>
      listCameras()
        .then((list) => alive && setDevices(list))
        .catch(() => alive && setDevices([]));
    refresh();
    navigator.mediaDevices?.addEventListener("devicechange", refresh);
    return () => {
      alive = false;
      navigator.mediaDevices?.removeEventListener("devicechange", refresh);
    };
  }, []);

  // Before camera permission, browsers list webcams with an empty id and no
  // name: then there is just one row, the system default.
  const named = (devices ?? []).filter((d) => d.deviceId);
  const webcams =
    named.length > 0
      ? named.map((d, i) => ({
          id: d.deviceId,
          label: d.label || `Webcam ${i + 1}`,
        }))
      : devices?.length
        ? [{ id: "", label: "Webcam do computador" }]
        : [];
  // The webcam in use, also when it was opened as "the default".
  const usingId =
    webcamId === null
      ? null
      : webcams.some((w) => w.id === webcamId)
        ? webcamId
        : (webcams[0]?.id ?? null);

  return (
    <div className="mic-menu camera-menu">
      <h3 className="menu-title">Câmera</h3>

      <div className="camera-group">
        <span className="menu-section">Neste computador</span>
        {devices && webcams.length === 0 && (
          <div className="menu-row is-soon phone-row-empty">
            <span>
              Nenhuma webcam encontrada
              <small>Conecte uma webcam, ou use o celular como câmera.</small>
            </span>
          </div>
        )}
        {webcams.map((w) => {
          const using = w.id === usingId;
          return (
            <button
              key={w.id || "default"}
              type="button"
              data-pick
              className={`menu-row phone-row${using ? " is-using" : ""}`}
              onClick={() => (using ? onStop() : onWebcam(w.id))}
            >
              <span className="phone-row-name">
                <CameraIcon size={16} />
                {w.label}
              </span>
              <span className={`soon-pill${using ? " is-live" : ""}`}>
                {using ? "Parar" : "Usar"}
              </span>
            </button>
          );
        })}
      </div>

      <div className="camera-group">
        <span className="menu-section">Celular</span>
        <PhoneRows
          what="câmera"
          phones={phones}
          phoneId={phoneId}
          onPick={onPhone}
          onStop={onStop}
        />
        {phoneId && (
          <button type="button" className="menu-row" onClick={onFlip}>
            <span className="phone-row-name">
              <PhoneIcon size={16} />
              Virar a câmera do celular
            </span>
            <span className="soon-pill">Frente / trás</span>
          </button>
        )}
      </div>
    </div>
  );
}
