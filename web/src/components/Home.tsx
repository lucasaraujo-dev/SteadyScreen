"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createRoom, saveHostToken } from "@/lib/api";
import { errorText } from "@/lib/messages";

export default function Home() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");

  async function share() {
    setCreating(true);
    setError(null);
    try {
      const room = await createRoom();
      saveHostToken(room.id, room.hostToken);
      router.push(`/compartilhar/${room.id}`);
    } catch {
      setError(errorText("server-offline"));
      setCreating(false);
    }
  }

  function join(e: FormEvent) {
    e.preventDefault();
    // Accept a bare code or a pasted link.
    const id = code.trim().split("/").filter(Boolean).pop()?.toLowerCase();
    if (id) router.push(`/sala/${encodeURIComponent(id)}`);
  }

  return (
    <section className="hero">
      <h1>Compartilhe sua tela em segundos</h1>
      <p>Direto do navegador, sem instalar nada. Gere um link e mande para quem vai assistir.</p>

      <button className="btn btn-primary btn-lg" onClick={share} disabled={creating}>
        {creating ? "Criando sala…" : "Compartilhar minha tela"}
      </button>

      {error && (
        <p className="alert" style={{ marginTop: 24 }}>
          {error}
        </p>
      )}

      <form className="join" onSubmit={join}>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Código da sala"
          aria-label="Código da sala"
          autoComplete="off"
        />
        <button className="btn" type="submit" disabled={!code.trim()}>
          Assistir
        </button>
      </form>
    </section>
  );
}
