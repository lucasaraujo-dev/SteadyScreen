"use client";

import { useRef, useState } from "react";
import { PhotoIcon } from "@/components/icons";
import { updateUser } from "@/lib/account";
import { ApiError, uploadAvatar, type User } from "@/lib/api";
import { makeAvatar, NotAnImage } from "@/lib/avatar";
import { errorText } from "@/lib/messages";
import { initials } from "@/lib/room";

/** The account's photo (or initials). Click it to pick a new photo; it's
 * cut square, shrunk and saved to the account right away. */
export default function AvatarButton({
  user,
  size = 52,
  onError,
  onDone,
}: {
  user: User;
  size?: number;
  onError: (message: string) => void;
  onDone?: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function picked(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const photo = await makeAvatar(file);
      const { user: next } = await uploadAvatar(photo);
      updateUser(next);
      onDone?.();
    } catch (err) {
      onError(
        errorText(
          err instanceof NotAnImage
            ? "bad-image"
            : err instanceof ApiError
              ? err.message
              : "server-offline",
        ),
      );
    } finally {
      setBusy(false);
      if (input.current) input.current.value = ""; // same file again works
    }
  }

  return (
    <>
      <button
        type="button"
        className={`avatar-btn${busy ? " is-busy" : ""}`}
        style={{ width: size, height: size, fontSize: size * 0.32 }}
        onClick={() => input.current?.click()}
        disabled={busy}
        aria-label="Trocar foto"
        title="Trocar foto"
      >
        <Avatar user={user} />
        <span className="avatar-btn-badge" aria-hidden>
          <PhotoIcon size={Math.max(12, Math.round(size * 0.26))} />
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => void picked(e.target.files?.[0])}
      />
    </>
  );
}

/** Just the round picture: the photo, or the name's initials. */
export function Avatar({ user }: { user: User }) {
  return user.avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- tiny photo from our own API
    <img className="avatar-img" src={user.avatarUrl} alt="" draggable={false} />
  ) : (
    <span className="avatar-initials">{initials(user.name)}</span>
  );
}
