"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { GearIcon, SendIcon } from "@/components/icons";
import { MAX_CHAT_LENGTH, type ChatMessage } from "@/lib/room";

type Props = {
  messages: ChatMessage[];
  selfId: string | null;
  disabled?: boolean;
  onSend: (text: string) => void;
  onOpenSettings: () => void;
};

const time = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
});

export default function Chat({
  messages,
  selfId,
  disabled,
  onSend,
  onOpenSettings,
}: Props) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLOListElement>(null);

  // Keep the newest message in view.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const clean = text.trim();
    if (!clean || disabled) return;
    onSend(clean);
    setText("");
  }

  return (
    <aside className="room-side glass chat" aria-label="Chat">
      <header className="side-head">
        <h2>Chat</h2>
        <button
          className="icon-btn"
          onClick={onOpenSettings}
          aria-label="Configurações"
          title="Configurações"
        >
          <GearIcon size={18} />
        </button>
      </header>

      <ol ref={listRef} className="chat-list" aria-live="polite">
        {messages.length === 0 && (
          <li className="side-empty">Nenhuma mensagem ainda. Diga oi!</li>
        )}
        {messages.map((m, i) => {
          const mine = m.from === selfId;
          const grouped =
            i > 0 &&
            messages[i - 1].from === m.from &&
            m.at - messages[i - 1].at < 120_000;
          return (
            <li
              key={m.id}
              className={`msg${mine ? " is-mine" : ""}${grouped ? " is-grouped" : ""}`}
            >
              {!grouped && (
                <span className="msg-meta">
                  <strong>{mine ? "Você" : m.name}</strong> ·{" "}
                  {time.format(m.at)}
                </span>
              )}
              <span className="msg-bubble">{m.text}</span>
            </li>
          );
        })}
      </ol>

      <form className="chat-form" onSubmit={submit}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={disabled ? "Conectando…" : "Escreva uma mensagem"}
          maxLength={MAX_CHAT_LENGTH}
          disabled={disabled}
          aria-label="Mensagem"
        />
        <button
          className="chat-send"
          type="submit"
          disabled={disabled || !text.trim()}
          aria-label="Enviar"
        >
          <SendIcon size={18} />
        </button>
      </form>
    </aside>
  );
}
