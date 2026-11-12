// Talks to the Go signaling server (server/).

export type CreatedRoom = { id: string; hostToken: string; maxViewers: number };
export type RoomInfo = { id: string; live: boolean; viewers: number; maxViewers: number };
export type ServerConfig = { iceServers: RTCIceServer[]; maxViewers: number };

/** Base URL of the Go server. Defaults to the same host on port 8080, so a
 * viewer opening http://192.168.x.x:3000 on the LAN also finds the server. */
export function serverUrl(): string {
  const env = process.env.NEXT_PUBLIC_SERVER_URL;
  if (env) return env.replace(/\/$/, "");
  return `${window.location.protocol}//${window.location.hostname}:8080`;
}

export function wsUrl(params: Record<string, string>): string {
  const base = serverUrl().replace(/^http/, "ws");
  return `${base}/ws?${new URLSearchParams(params)}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(serverUrl() + path, init);
  if (res.status === 404) throw new ApiError("room-not-found");
  if (!res.ok) throw new ApiError(`http-${res.status}`);
  return res.json() as Promise<T>;
}

export class ApiError extends Error {}

export const createRoom = () => request<CreatedRoom>("/api/rooms", { method: "POST" });
export const getRoom = (id: string) => request<RoomInfo>(`/api/rooms/${encodeURIComponent(id)}`);
export const getConfig = () => request<ServerConfig>("/api/config");

const tokenKey = (roomId: string) => `steadyscreen:host:${roomId}`;

/** The host token proves "I created this room". Kept per browser tab. */
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
