"use client";

import { useState, type FormEvent } from "react";
import AvatarButton from "@/components/AvatarButton";
import Modal from "@/components/Modal";
import {
  CloseIcon,
  ImageIcon,
  LockIcon,
  MailIcon,
  PhoneIcon,
  UserIcon,
  VerifiedIcon,
} from "@/components/icons";
import Toast from "@/components/room/Toast";
import { updateUser } from "@/lib/account";
import {
  ApiError,
  changeEmail,
  changeName,
  changePassword,
  changePhone,
  confirmEmail,
  removeAvatar,
  sendEmailCode,
  type User,
} from "@/lib/api";
import { errorText } from "@/lib/messages";

/** Which row is open for editing. "code" = typing the emailed code. */
type Editing = "name" | "email" | "code" | "password" | "phone" | null;

/** "Configurações da conta": name, email (and confirming it), password,
 * phone and photo. Every change is saved on the server right away. */
export default function AccountSettings({
  user,
  open,
  onClose,
}: {
  user: User;
  open: boolean;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState<Editing>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(
    null,
  );
  const tell = (text: string, ok = true) => setToast({ text, ok });

  function edit(row: Editing) {
    setEditing(row);
    setError(null);
  }

  /** Runs a change; on success shows `done` and closes the row. */
  async function run(
    action: () => Promise<{ user: User } | void>,
    done: string,
    next: Editing = null,
  ) {
    setBusy(true);
    setError(null);
    try {
      const res = await action();
      if (res) updateUser(res.user);
      setEditing(next);
      tell(done);
    } catch (err) {
      setError(
        errorText(err instanceof ApiError ? err.message : "server-offline"),
      );
    } finally {
      setBusy(false);
    }
  }

  const rowProps = { editing, busy, onEdit: edit };

  return (
    <Modal
      open={open}
      onClose={() => {
        setEditing(null);
        setError(null);
        onClose();
      }}
      className="account-settings"
      label="Configurações da conta"
    >
      {(close) => (
        <>
          <header className="acs-head">
            <AvatarButton
              user={user}
              size={64}
              onError={(m) => tell(m, false)}
              onDone={() => tell("Foto atualizada")}
            />
            <div className="acs-who">
              <h2>{user.name}</h2>
              <p>{user.email}</p>
            </div>
            <button
              type="button"
              className="acs-close"
              onClick={close}
              aria-label="Fechar"
            >
              <CloseIcon size={18} />
            </button>
          </header>

          <ul className="acs-list">
            <Row
              {...rowProps}
              id="name"
              icon={<UserIcon size={18} />}
              label="Nome"
              value={user.name}
              action="Alterar"
            >
              <Form
                busy={busy}
                error={error}
                submit="Salvar"
                onCancel={() => edit(null)}
                onSubmit={(f) =>
                  run(() => changeName(f.get("name")), "Nome alterado")
                }
              >
                <Field
                  name="name"
                  label="Nome"
                  defaultValue={user.name}
                  autoComplete="name"
                />
              </Form>
            </Row>

            <Row
              {...rowProps}
              id="email"
              icon={<MailIcon size={18} />}
              label="E-mail"
              value={user.email}
              badge={
                user.emailVerified ? (
                  <span className="acs-badge is-ok">
                    <VerifiedIcon size={13} /> Confirmado
                  </span>
                ) : (
                  <span className="acs-badge">Não confirmado</span>
                )
              }
              action="Alterar"
              extra={
                !user.emailVerified &&
                editing !== "code" && (
                  <button
                    type="button"
                    className="acs-action is-strong"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        sendEmailCode,
                        `Código enviado para ${user.email}`,
                        "code",
                      )
                    }
                  >
                    Confirmar
                  </button>
                )
              }
            >
              <Form
                busy={busy}
                error={error}
                submit="Salvar e-mail"
                onCancel={() => edit(null)}
                onSubmit={(f) =>
                  run(
                    () => changeEmail(f.get("email"), f.get("password")),
                    "E-mail alterado",
                  )
                }
              >
                <Field
                  name="email"
                  label="Novo e-mail"
                  type="email"
                  autoComplete="email"
                />
                <Field
                  name="password"
                  label="Sua senha atual"
                  type="password"
                  autoComplete="current-password"
                />
                <p className="acs-hint">
                  Depois de trocar, confirme o novo e-mail.
                </p>
              </Form>
            </Row>

            {editing === "code" && (
              <li className="acs-row is-open acs-code">
                <Form
                  busy={busy}
                  error={error}
                  submit="Confirmar e-mail"
                  onCancel={() => edit(null)}
                  onSubmit={(f) =>
                    run(() => confirmEmail(f.get("code")), "E-mail confirmado")
                  }
                >
                  <p className="acs-hint">
                    Mandamos um código de 6 números para{" "}
                    <strong>{user.email}</strong>. Ele vale por 15 minutos.
                  </p>
                  <Field
                    name="code"
                    label="Código"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    pattern="[0-9 ]*"
                    className="acs-code-input"
                  />
                  <button
                    type="button"
                    className="acs-link"
                    disabled={busy}
                    onClick={() =>
                      void run(sendEmailCode, "Código reenviado", "code")
                    }
                  >
                    Mandar outro código
                  </button>
                </Form>
              </li>
            )}

            <Row
              {...rowProps}
              id="password"
              icon={<LockIcon size={18} />}
              label="Senha"
              value="••••••••"
              action="Alterar"
            >
              <Form
                busy={busy}
                error={error}
                submit="Salvar senha"
                onCancel={() => edit(null)}
                onSubmit={(f) =>
                  run(
                    () => changePassword(f.get("current"), f.get("new")),
                    "Senha alterada",
                  )
                }
              >
                <Field
                  name="current"
                  label="Senha atual"
                  type="password"
                  autoComplete="current-password"
                />
                <Field
                  name="new"
                  label="Nova senha"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                />
                <p className="acs-hint">
                  Pelo menos 8 caracteres. Outros aparelhos conectados saem da
                  conta.
                </p>
              </Form>
            </Row>

            <Row
              {...rowProps}
              id="phone"
              icon={<PhoneIcon size={18} />}
              label="Celular"
              value={user.phone ? formatPhone(user.phone) : "Nenhum vinculado"}
              muted={!user.phone}
              action={user.phone ? "Alterar" : "Vincular"}
            >
              <Form
                busy={busy}
                error={error}
                submit="Salvar celular"
                onCancel={() => edit(null)}
                onSubmit={(f) =>
                  run(
                    () => changePhone(f.get("phone")),
                    f.get("phone").trim()
                      ? "Celular vinculado"
                      : "Celular removido",
                  )
                }
              >
                <Field
                  name="phone"
                  label="Celular com DDD"
                  type="tel"
                  autoComplete="tel"
                  defaultValue={user.phone}
                  placeholder="(11) 91234-5678"
                  required={false}
                />
                <p className="acs-hint">
                  Deixe vazio e salve para desvincular.
                </p>
              </Form>
            </Row>

            <li className="acs-row">
              <div className="acs-line">
                <span className="acs-icon">
                  <ImageIcon size={18} />
                </span>
                <div className="acs-text">
                  <span className="acs-label">Foto</span>
                  <span className="acs-value is-muted">
                    {user.avatarUrl
                      ? "Clique na sua foto lá em cima para trocar"
                      : "Clique no círculo lá em cima para escolher"}
                  </span>
                </div>
                {user.avatarUrl && (
                  <button
                    type="button"
                    className="acs-action"
                    disabled={busy}
                    onClick={() => void run(removeAvatar, "Foto removida")}
                  >
                    Remover
                  </button>
                )}
              </div>
            </li>
          </ul>

          {toast && (
            <Toast
              key={toast.text}
              message={toast.text}
              tone={toast.ok ? "ok" : "error"}
              onDone={() => setToast(null)}
            />
          )}
        </>
      )}
    </Modal>
  );
}

/** One setting: icon, label and value, with a button that opens its form. */
function Row({
  id,
  icon,
  label,
  value,
  muted,
  badge,
  action,
  extra,
  editing,
  busy,
  onEdit,
  children,
}: {
  id: Exclude<Editing, null | "code">;
  icon: React.ReactNode;
  label: string;
  value: string;
  muted?: boolean;
  badge?: React.ReactNode;
  action: string;
  extra?: React.ReactNode;
  editing: Editing;
  busy: boolean;
  onEdit: (row: Editing) => void;
  children: React.ReactNode;
}) {
  const open = editing === id;
  return (
    <li className={`acs-row${open ? " is-open" : ""}`}>
      <div className="acs-line">
        <span className="acs-icon">{icon}</span>
        <div className="acs-text">
          <span className="acs-label">
            {label}
            {badge}
          </span>
          <span className={`acs-value${muted ? " is-muted" : ""}`}>
            {value}
          </span>
        </div>
        {!open && (
          <>
            {extra}
            <button
              type="button"
              className="acs-action"
              disabled={busy}
              onClick={() => onEdit(id)}
            >
              {action}
            </button>
          </>
        )}
      </div>
      {open && <div className="acs-form-wrap">{children}</div>}
    </li>
  );
}

type FormProps = {
  busy: boolean;
  submit: string;
  onSubmit: (fields: { get: (name: string) => string }) => void;
  onCancel: () => void;
  error?: string | null;
  children: React.ReactNode;
};

function Form({
  busy,
  submit,
  onSubmit,
  onCancel,
  error,
  children,
}: FormProps) {
  return (
    <form
      className="acs-form"
      onSubmit={(e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        onSubmit({ get: (name) => String(data.get(name) ?? "") });
      }}
    >
      {children}
      {error && <p className="acs-error">{error}</p>}
      <div className="acs-buttons">
        <button
          type="button"
          className="acs-cancel"
          onClick={onCancel}
          disabled={busy}
        >
          Cancelar
        </button>
        <button type="submit" className="acs-save" disabled={busy}>
          {busy ? "Salvando…" : submit}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  className = "",
  required = true,
  ...input
}: React.InputHTMLAttributes<HTMLInputElement> & {
  name: string;
  label: string;
}) {
  return (
    <label className={`acs-field ${className}`}>
      <span>{label}</span>
      <input required={required} {...input} />
    </label>
  );
}

/** +5511912345678 → (11) 91234-5678; other countries stay as they are. */
function formatPhone(p: string): string {
  const m = /^\+55(\d{2})(\d{4,5})(\d{4})$/.exec(p);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : p;
}
