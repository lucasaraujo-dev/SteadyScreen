"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { SendIcon } from "@/components/icons";
import { MAX_CHAT_LENGTH, type ChatMessage } from "@/lib/room";

type Props = {
  messages: ChatMessage[];
  selfId: string | null;
  selfAuthor?: string | null;
  disabled?: boolean;
  onSend: (text: string) => void;
};

const time = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
});

export default function Chat({
  messages,
  selfId,
  selfAuthor,
  disabled,
  onSend,
}: Props) {
  // Who wrote a message: the account tag (kept after a reload), or the
  // connection id for servers that don't send one.
  const who = (m: ChatMessage) => m.author || m.from;
  const me = selfAuthor || selfId;

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
    <div className="chat-wrap">
      {/* A tab that grows out of the top of the box, like a folder tab.
          The shape and the title are separate layers so messages can
          scroll up between them, behind the title. */}
      <span className="chat-tab" aria-hidden />
      <h2 className="chat-title">Chat</h2>
      <aside className="room-side glass chat" aria-label="Chat">
        {/* Messages scroll up under a soft blur at the top. */}
        <div className="chat-fade" aria-hidden>
          <span className="fade-tab" />
          <span className="fade-box" />
        </div>

        <ol ref={listRef} className="chat-list" aria-live="polite">
          {messages.length === 0 && (
            <li className="side-empty">Nenhuma mensagem ainda. Diga oi!</li>
          )}
          {messages.map((m, i) => {
            const mine = who(m) === me;
            const grouped =
              i > 0 &&
              who(messages[i - 1]) === who(m) &&
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
          <div className="chat-field">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={disabled ? "Conectando…" : "Enviar mensagem"}
              maxLength={MAX_CHAT_LENGTH}
              disabled={disabled}
              aria-label="Mensagem"
            />
            <button
              className="chat-send"
              type="submit"
              disabled={disabled || !text.trim()}
              aria-label="Enviar mensagem"
            >
              <SendIcon size={18} />
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
