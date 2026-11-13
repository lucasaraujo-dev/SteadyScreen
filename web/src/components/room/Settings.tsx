"use client";

import { useEffect, useRef, useState } from "react";
import {
  BoltIcon,
  CheckIcon,
  CloseIcon,
  FilmIcon,
  GearIcon,
  NoteIcon,
} from "@/components/icons";
import { formatPlan, type VideoFormat } from "@/lib/codecs";
import type { Quality } from "@/lib/host";

type Props = {
  open: boolean;
  onClose: () => void;
  quality: Quality;
  onQuality: (q: Quality) => void;
  /** The video formats going out right now (one per viewer). */
  getFormats: () => Promise<VideoFormat[]>;
};

const QUALITIES: {
  id: Quality;
  title: string;
  hint: string;
  Icon: (p: { size?: number }) => React.ReactNode;
}[] = [
  {
    id: "detail",
    title: "Texto nítido",
    hint: "Código, slides e documentos",
    Icon: NoteIcon,
  },
  {
    id: "motion",
    title: "Movimento suave",
    hint: "Vídeos e jogos",
    Icon: FilmIcon,
  },
];

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
      className="settings"
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()} // click on the backdrop
    >
      {open && (
        <div className="settings-body" onClick={(e) => e.stopPropagation()}>
          <header className="settings-head">
            <span className="settings-badge">
              <GearIcon size={20} />
            </span>
            <div className="settings-title">
              <h2>Configurações</h2>
              <p>Muda na hora para quem está assistindo.</p>
            </div>
            <button
              type="button"
              className="icon-btn"
              onClick={onClose}
              aria-label="Fechar"
            >
              <CloseIcon size={18} />
            </button>
          </header>

          <section className="settings-section">
            <h3>Qualidade da transmissão</h3>
            <div className="quality-options" role="radiogroup">
              {QUALITIES.map(({ id, title, hint, Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={quality === id}
                  className="quality-option"
                  onClick={() => onQuality(id)}
                >
                  <span className="quality-icon">
                    <Icon size={20} />
                  </span>
                  <span className="quality-text">
                    <strong>{title}</strong>
                    <small>{hint}</small>
                  </span>
                  <span className="quality-check" aria-hidden>
                    <CheckIcon size={12} />
                  </span>
                </button>
              ))}
            </div>
          </section>

          <VideoFormats getFormats={getFormats} />
        </div>
      )}
    </dialog>
  );
}

/** Which formats this computer sends, in order, and whether the graphics
 * card does the work. What each viewer gets right now is refreshed every
 * couple of seconds while the panel is open. */
function VideoFormats({
  getFormats,
}: {
  getFormats: () => Promise<VideoFormat[]>;
}) {
  const [plan, setPlan] = useState<VideoFormat[] | null>(null);
  const [live, setLive] = useState<VideoFormat[]>([]);

  useEffect(() => {
    let alive = true;
    void formatPlan().then((f) => alive && setPlan(f));
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

  const onCard = plan?.filter((f) => f.onCard).length ?? 0;
  const liveNames = new Set(live.map((f) => f.name));

  return (
    <section className="settings-section">
      <h3>Formato do vídeo</h3>
      <div className="format-box">
        <div className="format-status">
          <span className={`format-chip${onCard ? " is-card" : ""}`}>
            <BoltIcon size={14} />
            {plan === null
              ? "Verificando…"
              : onCard
                ? "Placa de vídeo ativa"
                : "Só o processador"}
          </span>
          <span className="format-live">
            {live.length === 0
              ? "Ninguém assistindo"
              : live.length === 1
                ? "1 pessoa recebendo"
                : `${live.length} pessoas recebendo`}
          </span>
        </div>

        {plan && (
          <ol className="format-order">
            {plan.map((f, i) => (
              <li
                key={f.name}
                className={liveNames.has(f.name) ? "is-live" : undefined}
              >
                <span className="format-rank">{i + 1}</span>
                <strong>{f.name}</strong>
                {liveNames.has(f.name) && (
                  <span className="format-now">em uso</span>
                )}
                <em className={f.onCard ? "is-card" : undefined}>
                  {f.onCard ? "placa de vídeo" : "processador"}
                </em>
              </li>
            ))}
          </ol>
        )}

        <p className="format-note">
          {plan === null
            ? "Vendo o que a sua placa de vídeo consegue fazer."
            : onCard
              ? "Os formatos da placa de vídeo vão primeiro: imagem melhor e o computador fica mais leve. Quem assiste recebe o primeiro que o navegador dele aceita."
              : "O navegador não usa a placa de vídeo aqui, então o vídeo sai pelo processador no formato mais leve."}
        </p>
      </div>
    </section>
  );
}
