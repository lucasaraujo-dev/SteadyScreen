"use client";

import { useSyncExternalStore } from "react";
import { getMe, logIn, logOut, signUp, type User } from "@/lib/api";

/**
 * Who is logged in, shared by every component. The session itself is an
 * HttpOnly cookie the server sets; here we only remember the answer of
 * GET /api/me.
 */
export type Account =
  | { status: "loading" }
  | { status: "guest" }
  /** `device`: this browser is a phone linked with the QR code. */
  | { status: "user"; user: User; device?: string };

const LOADING: Account = { status: "loading" };
let current: Account = LOADING;
let asked = false;
const listeners = new Set<() => void>();

function set(next: Account) {
  current = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!asked) {
    asked = true;
    void refreshAccount();
  }
  return () => listeners.delete(listener);
}

/** Ask the server again who we are. */
export async function refreshAccount() {
  try {
    const { user, device } = await getMe();
    set({ status: "user", user, device: device || undefined });
  } catch {
    set({ status: "guest" });
  }
}

export function useAccount(): Account {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => LOADING,
  );
}

export async function signUpAccount(
  name: string,
  email: string,
  password: string,
) {
  const { user } = await signUp(name, email, password);
  set({ status: "user", user });
}

export async function logInAccount(email: string, password: string) {
  const { user } = await logIn(email, password);
  set({ status: "user", user });
}

export async function logOutAccount() {
  try {
    await logOut();
  } finally {
    set({ status: "guest" });
  }
}

/** Show the account the server just sent back (after changing a setting). */
export function updateUser(user: User, device?: string) {
  const keep = current.status === "user" ? current.device : undefined;
  set({ status: "user", user, device: device ?? keep });
}
