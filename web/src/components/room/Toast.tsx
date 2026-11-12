"use client";

import { useEffect, useState } from "react";

const SHOW_MS = 4000;
const FADE_MS = 300;

/** A small notice at the top that fades away by itself (click closes it early). */
export default function Toast({
  message,
  onDone,
}: {
  message: string;
  onDone: () => void;
}) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (leaving) {
      const t = window.setTimeout(onDone, FADE_MS);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => setLeaving(true), SHOW_MS);
    return () => window.clearTimeout(t);
  }, [leaving, onDone]);

  return (
    <div
      className={`toast${leaving ? " is-leaving" : ""}`}
      role="status"
      onClick={() => setLeaving(true)}
    >
      {message}
    </div>
  );
}
