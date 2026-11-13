"use client";

import { useState } from "react";
import { CheckIcon, LinkIcon } from "@/components/icons";

/** "Convidar pessoas": the room link in our glass pill; clicking it copies the link. */
export default function InviteLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // Clipboard API blocked (e.g. plain http on another device): old way.
      if (!copyTheOldWay(link)) return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  }

  return (
    <div className={`invite${copied ? " is-copied" : ""}`}>
      <span className="invite-label">Convidar pessoas</span>
      {/* A button, not an input: the link can't be selected, only copied. */}
      <button
        type="button"
        className="invite-field"
        onClick={() => void copy()}
        aria-label={`Copiar o link da sala: ${link}`}
        title="Clique para copiar"
      >
        {copied ? <CheckIcon size={18} /> : <LinkIcon size={18} />}
        <span className="invite-text">{link}</span>
      </button>
    </div>
  );
}

function copyTheOldWay(text: string): boolean {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}
