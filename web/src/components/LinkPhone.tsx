"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckIcon, PhoneIcon } from "@/components/icons";
import { updateUser } from "@/lib/account";
import { ApiError, finishLink, scanLink } from "@/lib/api";
import { errorText } from "@/lib/messages";

type Step =
  | { kind: "reading" }
  | { kind: "waiting" }
  | { kind: "done"; name: string }
  | { kind: "error"; code: string };

let scan: { code: string; secret: Promise<string> } | null = null;

/**
 * The page a phone opens after reading the QR code (/vincular#<code>). It
 * tells the server it scanned, then waits for the computer to allow it.
 */
export default function LinkPhone() {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: "reading" });

  useEffect(() => {
    // Read the code and tell the server only once per page load (React may
    // run this twice in development; a code can only be scanned once).
    const hashCode = window.location.hash.slice(1);
    if (!scan || (hashCode && hashCode !== scan.code)) {
      // Don't leave the code in the address bar or the history.
      history.replaceState(null, "", window.location.pathname);
      scan = {
        code: hashCode,
        secret: hashCode
          ? scanLink(hashCode).then((r) => r.secret)
          : Promise.reject(new ApiError("link-expired")),
      };
      scan.secret.catch(() => {}); // handled below
    }
    const { code } = scan;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fail = (err: unknown) => {
      if (!stopped)
        setStep({
          kind: "error",
          code: err instanceof ApiError ? err.message : "server-offline",
        });
    };

    scan.secret
      .then((secret) => {
        if (stopped) return;
        setStep({ kind: "waiting" });
        const poll = () =>
          finishLink(code, secret)
            .then((r) => {
              if (stopped) return;
              if (r.user) {
                updateUser(r.user);
                setStep({ kind: "done", name: r.user.name });
                timer = setTimeout(() => router.push("/"), 1600);
              } else {
                timer = setTimeout(poll, 1500);
              }
            })
            .catch(fail);
        timer = setTimeout(poll, 1500);
      })
      .catch(fail);

    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [router]);

  return (
    <div className="room-message">
      <div className="hero glass link-phone">
        <span
          className={`link-phone-icon${step.kind === "done" ? " is-ok" : ""}`}
        >
          {step.kind === "done" ? (
            <CheckIcon size={30} />
          ) : (
            <PhoneIcon size={30} />
          )}
        </span>
        {step.kind === "reading" && <p>Lendo o código…</p>}
        {step.kind === "waiting" && (
          <>
            <h1>Confirme no computador</h1>
            <p className="room-message-text">
              No computador, toque em <strong>Permitir</strong> para este
              celular entrar na sua conta.
            </p>
            <div className="spinner" aria-hidden />
          </>
        )}
        {step.kind === "done" && (
          <>
            <h1>Celular vinculado</h1>
            <p className="room-message-text">
              Você entrou como <strong>{step.name}</strong>.
            </p>
          </>
        )}
        {step.kind === "error" && (
          <>
            <h1>Não deu para vincular</h1>
            <p className="room-message-text">{errorText(step.code)}</p>
            <p style={{ marginTop: 24 }}>
              <Link className="btn" href="/">
                Ir para o início
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
