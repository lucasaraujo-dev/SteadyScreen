"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRightIcon, LogOutIcon, TrashIcon } from "@/components/icons";
import { logOutAccount } from "@/lib/account";
import { deleteRoom, getMyRooms, type MyRoom, type User } from "@/lib/api";
import { initials } from "@/lib/room";

/** The logged-in person: who they are and the rooms they created. */
export default function AccountCard({ user }: { user: User }) {
  const [rooms, setRooms] = useState<MyRoom[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () =>
      getMyRooms()
        .then((r) => alive && (setRooms(r.rooms), setFailed(false)))
        .catch(() => alive && setFailed(true));
    void load();
    // Keep "ao vivo" fresh while the page is open.
    const t = window.setInterval(load, 15000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, []);

  async function remove(id: string) {
    if (
      !window.confirm(`Excluir a sala #${id}? O chat dela também será apagado.`)
    )
      return;
    setRooms((list) => list?.filter((r) => r.id !== id) ?? null);
    try {
      await deleteRoom(id);
    } catch {
      setRooms(null);
      getMyRooms()
        .then((r) => setRooms(r.rooms))
        .catch(() => setFailed(true));
    }
  }

  return (
    <div className="account-card glass">
      <div className="account-head">
        <span className="account-avatar" aria-hidden>
          {initials(user.name)}
        </span>
        <div className="account-who">
          <strong>{user.name}</strong>
          <span>{user.email}</span>
        </div>
        <button
          type="button"
          className="account-out"
          disabled={leaving}
          onClick={() => {
            setLeaving(true);
            void logOutAccount();
          }}
          aria-label="Sair da conta"
          title="Sair"
        >
          <LogOutIcon size={18} />
          <span>Sair</span>
        </button>
      </div>

      <div className="account-rooms">
        <h2>Suas salas</h2>
        {failed && !rooms && (
          <p className="account-empty">Não foi possível carregar suas salas.</p>
        )}
        {!failed && !rooms && <p className="account-empty">Carregando…</p>}
        {rooms && rooms.length === 0 && (
          <p className="account-empty">
            Você ainda não criou nenhuma sala. Crie a primeira ao lado.
          </p>
        )}
        {rooms && rooms.length > 0 && (
          <ul>
            {rooms.map((r) => (
              <li key={r.id} className={r.live ? "is-live" : undefined}>
                <Link
                  className="room-row"
                  href={`/compartilhar/${r.id}`}
                  transitionTypes={["nav-forward"]}
                >
                  <span className="room-code">#{r.id}</span>
                  <span className="room-when">
                    {r.live ? (
                      <>
                        <i className="room-dot" aria-hidden />
                        Ao vivo
                        {r.viewers > 0 && ` · ${r.viewers} assistindo`}
                      </>
                    ) : (
                      `Usada ${ago(r.lastUsedAt)}`
                    )}
                  </span>
                  <ArrowRightIcon size={16} />
                </Link>
                <button
                  type="button"
                  className="room-delete"
                  onClick={() => void remove(r.id)}
                  aria-label={`Excluir a sala ${r.id}`}
                  title="Excluir sala"
                >
                  <TrashIcon size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** "agora", "há 5 min", "há 3 h", "há 2 dias", or a date. */
function ago(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "agora";
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  const d = Math.floor(s / 86400);
  if (d < 30) return d === 1 ? "ontem" : `há ${d} dias`;
  return `em ${new Date(iso).toLocaleDateString("pt-BR")}`;
}
