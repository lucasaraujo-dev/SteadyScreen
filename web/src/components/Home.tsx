"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import AccountCard from "@/components/AccountCard";
import AuthCard from "@/components/AuthCard";
import InkButton from "@/components/InkButton";
import Logo3D from "@/components/Logo3D";
import { refreshAccount, useAccount } from "@/lib/account";
import { ApiError, createRoom, saveHostToken } from "@/lib/api";
import { errorText } from "@/lib/messages";

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
                <svg className="join-icon" viewBox="0 0 24 24" aria-hidden>
                  <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4L12 5.6" />
                  <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2" />
                </svg>
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
                  <svg viewBox="0 0 24 24" aria-hidden>
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </button>
              </label>
              <p className="join-hint">
                Digite o código ou cole o link que recebeu
              </p>
            </form>
          </div>
        )}

        {error && <p className="alert home-alert">{error}</p>}
      </div>

      <aside className="home-side" aria-label="Sua conta">
        {account.status === "loading" && (
          <div className="auth-card glass is-loading" aria-busy />
        )}
        {account.status === "guest" && <AuthCard />}
        {account.status === "user" && <AccountCard user={account.user} />}
      </aside>
    </section>
  );
}
