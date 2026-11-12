"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { SoundIcon } from "@/components/icons";
import Dropdown from "@/components/room/Dropdown";
import { KeyPicker, Toggle } from "@/components/room/MenuControls";
import {
  canPickOutput,
  listOutputs,
  playTestSound,
  type AudioSettings,
} from "@/lib/audio";

type Props = {
  settings: AudioSettings;
  onChange: (next: AudioSettings) => void;
  /** Key used by another shortcut, to warn about clashes. */
  takenKey?: string;
};

/** Options under the headset's arrow: output device and the "stop listening" shortcut. */
export default function HeadsetMenu({ settings, onChange, takenKey }: Props) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const supported = useSyncExternalStore(noop, canPickOutput, () => true);

  const set = (patch: Partial<AudioSettings>) =>
    onChange({ ...settings, ...patch });

  // Output list, kept fresh when headphones are plugged in or out.
  useEffect(() => {
    let alive = true;
    const refresh = () =>
      listOutputs()
        .then((list) => alive && setDevices(list))
        .catch(() => {});
    refresh();
    navigator.mediaDevices.addEventListener("devicechange", refresh);
    return () => {
      alive = false;
      navigator.mediaDevices.removeEventListener("devicechange", refresh);
    };
  }, []);

  const known =
    !settings.outputId || devices.some((d) => d.deviceId === settings.outputId);

  return (
    <div className="mic-menu">
      <h3 className="menu-title">Áudio</h3>

      <div className="menu-field">
        <span>Saída de áudio</span>
        {supported ? (
          <Dropdown
            label="Saída de áudio"
            value={known ? settings.outputId : ""}
            onChange={(outputId) => set({ outputId })}
            options={[
              { value: "", label: "Padrão do sistema" },
              ...devices.map((d, i) => ({
                value: d.deviceId,
                label: d.label || `Saída ${i + 1}`,
              })),
            ]}
          />
        ) : (
          <small className="menu-warning">
            Este navegador não deixa escolher a saída. Use Chrome ou Edge, ou
            troque nas configurações do sistema.
          </small>
        )}
        <button
          type="button"
          className="menu-test"
          onClick={() => void playTestSound(settings.outputId)}
        >
          <SoundIcon size={16} />
          Testar som
        </button>
      </div>

      <Toggle
        label="Atalho para parar de ouvir"
        hint="Aperte a tecla para ativar ou desativar o áudio."
        checked={settings.deafenShortcut}
        onChange={(v) => set({ deafenShortcut: v })}
      />
      {settings.deafenShortcut && (
        <KeyPicker
          value={settings.deafenKey}
          onChange={(code) => set({ deafenKey: code })}
          warning={
            takenKey && takenKey === settings.deafenKey
              ? "Essa tecla também está no apertar para falar."
              : undefined
          }
        />
      )}
    </div>
  );
}

function noop() {
  return () => {};
}
