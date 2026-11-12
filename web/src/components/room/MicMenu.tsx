"use client";

import { useEffect, useRef, useState } from "react";
import Dropdown from "@/components/room/Dropdown";
import { KeyPicker, Toggle } from "@/components/room/MenuControls";
import { listMicrophones, type MicSettings } from "@/lib/mic";

type Props = {
  settings: MicSettings;
  onChange: (next: MicSettings) => void;
  /** Current mic level 0–1, or null while the mic is closed. */
  getLevel: () => number | null;
  /** Key used by another shortcut, to warn about clashes. */
  takenKey?: string;
};

/** Options under the mic's arrow: device, volume, filters, push-to-talk. */
export default function MicMenu({
  settings,
  onChange,
  getLevel,
  takenKey,
}: Props) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const meterRef = useRef<HTMLSpanElement>(null);

  const set = (patch: Partial<MicSettings>) =>
    onChange({ ...settings, ...patch });

  // Device list, kept fresh when something is plugged in or out.
  useEffect(() => {
    let alive = true;
    const refresh = () =>
      listMicrophones()
        .then((list) => alive && setDevices(list))
        .catch(() => {});
    refresh();
    navigator.mediaDevices.addEventListener("devicechange", refresh);
    return () => {
      alive = false;
      navigator.mediaDevices.removeEventListener("devicechange", refresh);
    };
  }, []);

  // Live level meter, drawn straight into the DOM (no re-renders).
  useEffect(() => {
    let frame = 0;
    const draw = () => {
      const level = getLevel();
      const el = meterRef.current;
      if (el) {
        el.style.transform = `scaleX(${level ?? 0})`;
        el.parentElement?.classList.toggle("is-idle", level === null);
      }
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [getLevel]);

  const pttWarning =
    takenKey && takenKey === settings.pushToTalkKey
      ? "Essa tecla também está no atalho de parar de ouvir."
      : undefined;

  const knownDevice =
    !settings.deviceId || devices.some((d) => d.deviceId === settings.deviceId);

  return (
    <div className="mic-menu">
      <h3 className="menu-title">Microfone</h3>

      <div className="menu-field">
        <span>Dispositivo de entrada</span>
        <Dropdown
          label="Dispositivo de entrada"
          value={knownDevice ? settings.deviceId : ""}
          onChange={(deviceId) => set({ deviceId })}
          options={[
            { value: "", label: "Padrão do sistema" },
            ...devices.map((d, i) => ({
              value: d.deviceId,
              label: d.label || `Microfone ${i + 1}`,
            })),
          ]}
        />
      </div>

      <button type="button" className="menu-row is-soon" disabled>
        <span>Usar o celular como microfone</span>
        <span className="soon-pill">Em breve</span>
      </button>

      <div className="menu-field">
        <span className="menu-field-head">
          Volume do microfone
          <strong className={settings.volume > 100 ? "is-boost" : undefined}>
            {settings.volume}%
          </strong>
        </span>
        <input
          type="range"
          className={`volume-range${settings.volume > 100 ? " is-boost" : ""}`}
          min={0}
          max={200}
          step={1}
          value={settings.volume}
          onChange={(e) => set({ volume: Number(e.target.value) })}
          onDoubleClick={() => set({ volume: 100 })}
          style={{ "--fill": `${settings.volume / 2}%` } as React.CSSProperties}
          aria-label="Volume do microfone"
        />
        <span className="volume-scale" aria-hidden>
          <span>0%</span>
          <span>100%</span>
          <span>200%</span>
        </span>
        <span className="mic-meter" aria-hidden>
          <span ref={meterRef} />
        </span>
      </div>

      <Toggle
        label="Supressão de ruído"
        checked={settings.noiseSuppression}
        onChange={(v) => set({ noiseSuppression: v })}
      />
      <Toggle
        label="Microfone estéreo"
        hint="Desliga o cancelamento de eco. Use fones."
        checked={settings.stereo}
        onChange={(v) => set({ stereo: v })}
      />
      <Toggle
        label="Apertar para falar"
        hint="Segure a tecla para falar; solte para ficar mudo."
        checked={settings.pushToTalk}
        onChange={(v) => set({ pushToTalk: v })}
      />
      {settings.pushToTalk && (
        <KeyPicker
          value={settings.pushToTalkKey}
          onChange={(code) => set({ pushToTalkKey: code })}
          warning={pttWarning}
        />
      )}
    </div>
  );
}
