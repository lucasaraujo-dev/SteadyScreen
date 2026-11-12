"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon, LinkIcon } from "@/components/icons";

/** "Convidar pessoas": the room link in our glass pill; one click copies it. */
export default function InviteLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // Clipboard blocked (e.g. plain http on another device): select the text instead.
      const input = document.getElementById(
        "invite-link",
      ) as HTMLInputElement | null;
      input?.select();
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  }

  return (
    <div className={`invite${copied ? " is-copied" : ""}`}>
      <span className="invite-label">Convidar pessoas</span>
      <div className="invite-field" onClick={copy}>
        <LinkIcon size={18} />
        <input
          id="invite-link"
          readOnly
          value={link}
          aria-label="Link da sala"
          onFocus={(e) => e.currentTarget.select()}
        />
        <button
          type="button"
          className="invite-copy"
          onClick={(e) => {
            e.stopPropagation();
            void copy();
          }}
        >
          {copied ? <CheckIcon size={17} /> : <CopyIcon size={17} />}
          <span>{copied ? "Copiado!" : "Copiar link"}</span>
        </button>
      </div>
    </div>
  );
}
