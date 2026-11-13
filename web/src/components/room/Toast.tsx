"use client";

import { useEffect, useRef, useState } from "react";

const SHOW_MS = 4000;
const FADE_MS = 300;

/** A small notice at the top that fades away by itself (click closes it early). */
export default function Toast({
  message,
  onDone,
  tone = "error",
}: {
  message: string;
  onDone: () => void;
  /** "ok" = something worked (green), "error" = something went wrong. */
  tone?: "ok" | "error";
}) {
  const [leaving, setLeaving] = useState(false);
  // Callers often pass a new onDone each render; that mustn't reset the timer.
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  useEffect(() => {
    if (leaving) {
      const t = window.setTimeout(() => done.current(), FADE_MS);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => setLeaving(true), SHOW_MS);
    return () => window.clearTimeout(t);
  }, [leaving]);

  return (
    <div
      className={`toast is-${tone}${leaving ? " is-leaving" : ""}`}
      role="status"
      onClick={() => setLeaving(true)}
    >
      {message}
    </div>
  );
}
