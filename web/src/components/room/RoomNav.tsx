"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BellIcon,
  GearIcon,
  HomeIcon,
  LockIcon,
} from "@/components/icons";
import type { RoomNotice } from "@/components/room/useRoom";
import type { Participant } from "@/lib/room";

type Props = {
  roomId: string;
  participants: Participant[];
  notices: RoomNotice[];
  unread: number;
  onOpenNotices: () => void;
  /** Host only: viewers have nothing to configure. */
  onOpenSettings?: () => void;
};

const time = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
});

/** Top bar: room name, code and privacy on the left; bell and gear on the right. */
export default function RoomNav({
  roomId,
  participants,
  notices,
  unread,
  onOpenNotices,
  onOpenSettings,
}: Props) {
  const host = participants.find((p) => p.role === "host");
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(roomId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked: the code is still readable on screen.
    }
  }

  return (
    <header className="room-nav glass">
      <div className="nav-room">
        <Link
          href="/"
          className="icon-btn nav-home"
          transitionTypes={["nav-back"]}
          aria-label="Voltar para o início"
        >
          <HomeIcon size={19} />
        </Link>
        <h1 className="nav-name">{host ? `Sala de ${host.name}` : "Sala"}</h1>
        <button
          type="button"
          className={`nav-code${copied ? " is-copied" : ""}`}
          onClick={() => void copyCode()}
          aria-label={`Código da sala: ${roomId}. Clique para copiar`}
        >
          #{roomId}
        </button>
        <span className="nav-tag">
          <LockIcon size={13} />
          Sala privada
        </span>
      </div>

      <div className="nav-actions">
        <NoticeBell notices={notices} unread={unread} onOpen={onOpenNotices} />
        {onOpenSettings && (
          <button
            type="button"
            className="icon-btn nav-gear"
            onClick={onOpenSettings}
            aria-label="Configurações"
          >
            <GearIcon size={19} />
          </button>
        )}
      </div>
    </header>
  );
}

function NoticeBell({
  notices,
  unread,
  onOpen,
}: {
  notices: RoomNotice[];
  unread: number;
  onOpen: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  function toggle() {
    if (!open) onOpen();
    setOpen((o) => !o);
  }

  return (
    <div ref={ref} className={`nav-bell${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="icon-btn"
        onClick={toggle}
        aria-label={unread ? `Notificações (${unread} novas)` : "Notificações"}
        aria-expanded={open}
      >
        {/* Re-keyed so the bell swings again on every new notice. */}
        <span key={unread} className={unread ? "bell-ring" : undefined}>
          <BellIcon size={19} />
        </span>
        {unread > 0 && (
          <span className="nav-badge">{unread > 9 ? "9+" : unread}</span>
        )}
      </button>

      {open && (
        <div className="nav-panel" role="dialog" aria-label="Notificações">
          <h3 className="menu-title">Notificações</h3>
          {notices.length === 0 ? (
            <p className="nav-empty">
              Nada por aqui ainda. Quando alguém entrar, sair ou começar a
              transmitir, aparece aqui.
            </p>
          ) : (
            <ul className="nav-list">
              {notices.map((n) => (
                <li key={n.id} className={`nav-notice is-${n.kind}`}>
                  {n.kind === "live" ? (
                    <span className="nav-dot" aria-hidden />
                  ) : (
                    // Green arrow in for who came, red arrow out for who left.
                    <span className="nav-arrow">
                      {n.kind === "join" ? (
                        <ArrowRightIcon size={16} />
                      ) : (
                        <ArrowLeftIcon size={16} />
                      )}
                    </span>
                  )}
                  <span className="nav-notice-text">{n.text}</span>
                  <time>{time.format(n.at)}</time>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
