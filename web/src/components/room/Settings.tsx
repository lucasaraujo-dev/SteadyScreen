"use client";

import { useEffect, useRef, useState } from "react";
import { CloseIcon } from "@/components/icons";
import { cardFormats, type VideoFormat } from "@/lib/codecs";
import type { Quality } from "@/lib/host";

type Props = {
  open: boolean;
  onClose: () => void;
  quality: Quality;
  onQuality: (q: Quality) => void;
  /** The video formats going out right now (one per viewer). */
  getFormats: () => Promise<VideoFormat[]>;
};

/** Host settings in a native modal dialog. Changes apply right away. Your
 * name comes from your account, so it isn't set here. */
export default function Settings({
  open,
  onClose,
  quality,
  onQuality,
  getFormats,
}: Props) {
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

          <VideoFormats getFormats={getFormats} />
        </div>
      )}
    </dialog>
  );
}

/** Which format the video goes out in, and whether the graphics card does
 * the work. Refreshed every few seconds while the panel is open. */
function VideoFormats({
  getFormats,
}: {
  getFormats: () => Promise<VideoFormat[]>;
}) {
  const [card, setCard] = useState<string[] | null>(null);
  const [live, setLive] = useState<VideoFormat[]>([]);

  useEffect(() => {
    let alive = true;
    void cardFormats().then((f) => alive && setCard(f));
    const read = () =>
      void getFormats()
        .then((f) => alive && setLive(f))
        .catch(() => {});
    read();
    const t = window.setInterval(read, 2000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [getFormats]);

  return (
    <div className="settings-field">
      <span>Formato do vídeo</span>
      {live.length > 0 ? (
        <ul className="format-list">
          {live.map((f) => (
            <li key={`${f.name}|${f.onCard}`}>
              <strong>{f.name}</strong>
              <em className={f.onCard ? "is-card" : undefined}>
                {f.onCard ? "placa de vídeo" : "processador"}
              </em>
            </li>
          ))}
        </ul>
      ) : (
        <p className="format-note">
          Aparece aqui quando alguém estiver assistindo.
        </p>
      )}
      <p className="format-note">
        {card === null
          ? "Verificando a placa de vídeo…"
          : card.length > 0
            ? `Sua placa de vídeo comprime ${list(card)}. ${card.length > 1 ? "Esses formatos vêm" : "Esse formato vem"} primeiro.`
            : "O navegador não usa a placa de vídeo aqui; o vídeo sai em H.264 pelo processador."}
      </p>
    </div>
  );
}

/** "A", "A e B", "A, B e C". */
function list(items: string[]): string {
  return items.length < 2
    ? (items[0] ?? "")
    : `${items.slice(0, -1).join(", ")} e ${items.at(-1)}`;
}
