"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import AccountCard from "@/components/AccountCard";
import AuthCard from "@/components/AuthCard";
import { ArrowRightIcon, LinkIcon } from "@/components/icons";
import InkButton from "@/components/InkButton";
import Logo3D from "@/components/Logo3D";
import { refreshAccount, useAccount } from "@/lib/account";
import { ApiError, createRoom, saveHostToken } from "@/lib/api";
import { errorText } from "@/lib/messages";
import Toast from "@/components/room/Toast";

/** Home: the pitch on the left, the account (or sign in / sign up) on the right. */
export default function Home() {
  const router = useRouter();
  const account = useAccount();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");

  const hasCode = code.trim().length > 0;
  // A bare code (not a pasted link) is shown spaced out in monospace.
  const isPlainCode = hasCode && !code.includes("/");

  async function share() {
    setCreating(true);
    setError(null);
    try {
      const room = await createRoom();
      saveHostToken(room.id, room.hostToken);
      router.push(`/compartilhar/${room.id}`, {
        transitionTypes: ["nav-forward"],
      });
    } catch (err) {
      const reason = err instanceof ApiError ? err.message : "server-offline";
      // Session ended meanwhile: show the login card again.
      if (reason === "not-logged-in") void refreshAccount();
      setError(errorText(reason));
      setCreating(false);
    }
  }

  function join(e: FormEvent) {
    e.preventDefault();
    // Accept a bare code or a pasted link.
    const id = code.trim().split("/").filter(Boolean).pop()?.toLowerCase();
    if (id)
      router.push(`/sala/${encodeURIComponent(id)}`, {
        transitionTypes: ["nav-forward"],
      });
  }

  return (
    <section className="home">
      <div className="home-intro">
        <div className="hero-brand">
          <Logo3D size={72} depth={14} />
          <span className="wordmark">SteadyScreen</span>
        </div>
        <h1>Compartilhe sua tela em segundos</h1>
        <p>
          Direto do navegador, sem instalar nada. Gere um link e mande para quem
          vai assistir.
        </p>

        {/* Rooms are for members: the actions show up after logging in. */}
        {account.status === "user" && (
          <div className="hero-actions">
            <InkButton onClick={share} disabled={creating} busy={creating}>
              {creating ? "Criando sala…" : "Crie sua sala"}
            </InkButton>

            <form
              className={`join${hasCode ? " has-value" : ""}`}
              onSubmit={join}
            >
              <label className="join-field">
                <span className="join-icon">
                  <LinkIcon size={18} />
                </span>
                <input
                  className={isPlainCode ? "is-code" : undefined}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Código da sala"
                  aria-label="Código da sala ou link"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
                <button
                  className="join-go"
                  type="submit"
                  disabled={!hasCode}
                  aria-label="Assistir"
                >
                  <span className="join-go-label">Assistir</span>
                  <ArrowRightIcon size={18} />
                </button>
              </label>
              <p className="join-hint">
                Digite o código ou cole o link que recebeu
              </p>
            </form>
          </div>
        )}

        {error && (
          <Toast key={error} message={error} onDone={() => setError(null)} />
        )}
      </div>

      <aside className="home-side" aria-label="Sua conta">
        {account.status === "loading" && (
          <div className="card-skeleton" aria-busy />
        )}
        {account.status === "guest" && <AuthCard />}
        {account.status === "user" && <AccountCard user={account.user} />}
      </aside>
    </section>
  );
}
