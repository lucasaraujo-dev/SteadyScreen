// Talks to the Go server (server/): rooms, accounts and signaling.

export type CreatedRoom = { id: string; hostToken: string; maxViewers: number };
export type RoomInfo = {
  id: string;
  live: boolean;
  viewers: number;
  maxViewers: number;
};
export type ServerConfig = { iceServers: RTCIceServer[]; maxViewers: number };
export type User = {
  id: number;
  name: string;
  email: string;
  createdAt: string;
};
export type MyRoom = {
  id: string;
  createdAt: string;
  lastUsedAt: string;
  live: boolean;
  viewers: number;
};

/**
 * Where /api lives. Normally the site's own address: nginx (production) or
 * the Next dev server (development) forward it to the Go server, so the
 * login cookie always belongs to the site.
 */
function apiBase(): string {
  const env = process.env.NEXT_PUBLIC_SERVER_URL;
  if (env && env !== "same-origin") return env.replace(/\/$/, "");
  return "";
}

/** The signaling WebSocket. In development it goes straight to port 8080 (the
 * dev server can't forward WebSockets); cookies still reach it because they
 * don't depend on the port. */
export function wsUrl(params: Record<string, string>): string {
  const env = process.env.NEXT_PUBLIC_SERVER_URL;
  const base =
    env === "same-origin"
      ? window.location.origin
      : env
        ? env.replace(/\/$/, "")
        : `${window.location.protocol}//${window.location.hostname}:8080`;
  return `${base.replace(/^http/, "ws")}/ws?${new URLSearchParams(params)}`;
}

/** An error code from the server ("bad-credentials", "email-taken"…). */
export class ApiError extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(apiBase() + path, { credentials: "include", ...init });
  } catch {
    throw new ApiError("server-offline");
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new ApiError(body?.error ?? `http-${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function post<T>(path: string, body?: unknown, method = "POST") {
  return request<T>(path, {
    method,
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export const createRoom = () => post<CreatedRoom>("/api/rooms");
export const getRoom = (id: string) =>
  request<RoomInfo>(`/api/rooms/${encodeURIComponent(id)}`);
export const deleteRoom = (id: string) =>
  post<void>(`/api/rooms/${encodeURIComponent(id)}`, undefined, "DELETE");
export const getConfig = () => request<ServerConfig>("/api/config");

export const getMe = () => request<{ user: User }>("/api/me");
export const getMyRooms = () => request<{ rooms: MyRoom[] }>("/api/me/rooms");
export const signUp = (name: string, email: string, password: string) =>
  post<{ user: User }>("/api/auth/signup", { name, email, password });
export const logIn = (email: string, password: string) =>
  post<{ user: User }>("/api/auth/login", { email, password });
export const logOut = () => post<void>("/api/auth/logout");

const tokenKey = (roomId: string) => `steadyscreen:host:${roomId}`;

/** The host token proves "I created this room" in this tab. The room's owner
 * doesn't need it: their login is enough. */
export function saveHostToken(roomId: string, token: string) {
  try {
    sessionStorage.setItem(tokenKey(roomId), token);
  } catch {}
}

export function loadHostToken(roomId: string): string | null {
  try {
    return sessionStorage.getItem(tokenKey(roomId));
  } catch {
    return null;
  }
}
