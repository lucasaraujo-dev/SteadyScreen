"use client";

import { useEffect, useState } from "react";
import Dropdown from "@/components/room/Dropdown";
import PhoneRows from "@/components/room/PhoneRows";
import type { Phone } from "@/lib/phoneBridge";

type Props = {
  /** "" = the system default webcam. */
  cameraId: string;
  onChange: (cameraId: string) => void;
  /** Linked phones online, and the one whose camera is in use. */
  phones: Phone[];
  phoneId?: string;
  onPhone: (phone: Phone) => void;
  onPhoneStop: () => void;
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

/** Options under the camera's arrow: which webcam, or a linked phone. */
export default function CameraMenu({
  cameraId,
  onChange,
  phones,
  phoneId,
  onPhone,
  onPhoneStop,
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
    navigator.mediaDevices.addEventListener("devicechange", refresh);
    return () => {
      alive = false;
      navigator.mediaDevices.removeEventListener("devicechange", refresh);
    };
  }, []);

  // Before camera permission, browsers list webcams with an empty id: they
  // count as "there is one", but can't be picked by name yet.
  const list = (devices ?? []).filter((d) => d.deviceId);
  const known = !cameraId || list.some((d) => d.deviceId === cameraId);

  return (
    <div className="mic-menu">
      <h3 className="menu-title">Câmera</h3>

      <div className="menu-field">
        <span>Webcam</span>
        <Dropdown
          label="Webcam"
          value={known ? cameraId : ""}
          onChange={onChange}
          options={[
            { value: "", label: "Padrão do sistema" },
            ...list.map((d, i) => ({
              value: d.deviceId,
              label: d.label || `Webcam ${i + 1}`,
            })),
          ]}
        />
        {devices && devices.length === 0 && (
          <small className="menu-warning">
            Nenhuma webcam encontrada. Conecte uma e ela aparece aqui.
          </small>
        )}
      </div>

      <PhoneRows
        what="câmera"
        phones={phones}
        phoneId={phoneId}
        onPick={onPhone}
        onStop={onPhoneStop}
      />
    </div>
  );
}
