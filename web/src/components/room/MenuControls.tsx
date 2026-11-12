"use client";

import { useEffect, useState } from "react";
import { keyLabel } from "@/lib/mic";

/** On/off row with a switch, used in the call menus. */
export function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className="menu-toggle"
      onClick={() => onChange(!checked)}
    >
      <span className="menu-toggle-text">
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <span className="switch" aria-hidden />
    </button>
  );
}

/** "Tecla: [V]" — click, then press the key to use. Escape cancels. */
export function KeyPicker({
  value,
  onChange,
  warning,
}: {
  value: string;
  onChange: (code: string) => void;
  /** Shown under the row, e.g. when the key is already taken. */
  warning?: string;
}) {
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    if (!picking) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code !== "Escape") onChange(e.code);
      setPicking(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [picking, onChange]);

  return (
    <div className="menu-field menu-key">
      <span className="menu-key-row">
        <span>Tecla</span>
        <button
          type="button"
          className={`key-pick${picking ? " is-picking" : ""}`}
          onClick={() => setPicking((p) => !p)}
        >
          {picking ? "Aperte uma tecla…" : keyLabel(value)}
        </button>
      </span>
      {warning && <small className="menu-warning">{warning}</small>}
    </div>
  );
}
