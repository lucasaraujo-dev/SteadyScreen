"use client";

import { useState, type FormEvent } from "react";
import { EyeIcon, EyeOffIcon } from "@/components/icons";
import TabCard from "@/components/TabCard";
import { logInAccount, signUpAccount } from "@/lib/account";
import { ApiError } from "@/lib/api";
import { errorText } from "@/lib/messages";

type Mode = "login" | "signup";

/** "Entrar" / "Cadastrar": one glass card, a switch on top, the form below. */
export default function AuthCard() {
  const [mode, setMode] = useState<Mode>("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signup = mode === "signup";

  function switchTo(next: Mode) {
    setMode(next);
    setError(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (signup) await signUpAccount(name, email, password);
      else await logInAccount(email, password);
      // The home page swaps this card for the account one by itself.
    } catch (err) {
      setError(errorText(err instanceof ApiError ? err.message : ""));
      setBusy(false);
    }
  }

  return (
    <TabCard
      title={signup ? "Crie sua conta" : "Bem-vindo de volta"}
      className="auth-card"
    >
      <div className="auth-pill auth-switch" role="tablist" aria-label="Conta">
        <span
          className={`auth-switch-thumb${signup ? " is-right" : ""}`}
          aria-hidden
        />
        <button
          type="button"
          role="tab"
          aria-selected={!signup}
          className={`auth-btn${!signup ? " is-active" : ""}`}
          onClick={() => switchTo("login")}
        >
          Entrar
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={signup}
          className={`auth-btn${signup ? " is-active" : ""}`}
          onClick={() => switchTo("signup")}
        >
          Cadastrar
        </button>
      </div>

      <div className="auth-head">
        <p>
          {signup
            ? "Com uma conta você cria salas e encontra todas elas aqui."
            : "Entre para criar e abrir suas salas."}
        </p>
      </div>

      <form className="auth-form" onSubmit={submit} noValidate={false}>
        {signup && (
          <label className="auth-field">
            <span>Nome</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              placeholder="Como vão te ver nas salas"
              maxLength={32}
              required
            />
          </label>
        )}
        <label className="auth-field">
          <span>E-mail</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="voce@email.com"
            required
          />
        </label>
        <label className="auth-field">
          <span>Senha</span>
          <div className="auth-password">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={signup ? "new-password" : "current-password"}
              placeholder={signup ? "Pelo menos 8 caracteres" : "Sua senha"}
              minLength={signup ? 8 : undefined}
              maxLength={72}
              required
            />
            <button
              type="button"
              className="auth-eye"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Esconder senha" : "Mostrar senha"}
            >
              {showPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
            </button>
          </div>
        </label>

        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="auth-submit" disabled={busy}>
          {busy
            ? signup
              ? "Criando conta…"
              : "Entrando…"
            : signup
              ? "Criar conta"
              : "Entrar"}
        </button>
      </form>

      <p className="auth-foot">
        {signup ? "Já tem conta? " : "Ainda não tem conta? "}
        <button
          type="button"
          onClick={() => switchTo(signup ? "login" : "signup")}
        >
          {signup ? "Entrar" : "Cadastre-se"}
        </button>
      </p>
    </TabCard>
  );
}
