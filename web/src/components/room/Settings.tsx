"use client";

import { useEffect, useRef } from "react";
import { CloseIcon } from "@/components/icons";
import type { Quality } from "@/lib/host";

type Props = {
  open: boolean;
  onClose: () => void;
  quality: Quality;
  onQuality: (q: Quality) => void;
};

/** Host settings in a native modal dialog. Changes apply right away. Your
 * name comes from your account, so it isn't set here. */
export default function Settings({ open, onClose, quality, onQuality }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="settings glass"
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()} // click on the backdrop
    >
      {open && (
        <div className="settings-body" onClick={(e) => e.stopPropagation()}>
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
        </div>
      )}
    </dialog>
  );
}
