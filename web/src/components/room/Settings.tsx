"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { CloseIcon } from "@/components/icons";
import type { Quality } from "@/lib/host";
import { MAX_NAME_LENGTH } from "@/lib/room";

type Props = {
  open: boolean;
  name: string;
  onClose: () => void;
  onRename: (name: string) => void;
  /** Host only. */
  quality?: Quality;
  onQuality?: (q: Quality) => void;
};

/** Room settings in a native modal dialog. */
export default function Settings({
  open,
  name,
  onClose,
  onRename,
  quality,
  onQuality,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(name);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // showModal() focuses the first button; start on the name field instead.
      dialog.querySelector("input")?.select();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function save(e: FormEvent) {
    e.preventDefault();
    const clean = draft.trim();
    if (clean && clean !== name) onRename(clean);
    onClose();
  }

  return (
    <dialog
      ref={ref}
      className="settings glass"
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()} // click on the backdrop
    >
      {/* Remount the form each time it opens, so the field starts from the current name. */}
      {open && (
        <form
          onSubmit={save}
          className="settings-body"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="settings-head">
            <h2>Configurações</h2>
            <button
              type="button"
              className="icon-btn"
              onClick={onClose}
              aria-label="Fechar"
            >
              <CloseIcon size={18} />
            </button>
          </header>

          <label className="settings-field">
            <span>Seu nome na sala</span>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={MAX_NAME_LENGTH}
              autoComplete="nickname"
            />
          </label>

          {quality && onQuality && (
            <div className="settings-field">
              <span>Qualidade da transmissão</span>
              <div className="segmented">
                <button
                  type="button"
                  className="btn"
                  aria-pressed={quality === "detail"}
                  onClick={() => onQuality("detail")}
                >
                  Texto nítido
                  <small>código, slides, documentos</small>
                </button>
                <button
                  type="button"
                  className="btn"
                  aria-pressed={quality === "motion"}
                  onClick={() => onQuality("motion")}
                >
                  Movimento suave
                  <small>vídeos e jogos</small>
                </button>
              </div>
            </div>
          )}

          <div className="settings-actions">
            <button type="button" className="btn" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              Salvar
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
