import { supabase } from "./supabase";

/**
 * Browser → API helper.
 *
 * Attaches the caller's Supabase access token so the route can identify them and
 * enforce permissions server-side. Every privileged write goes through here
 * rather than talking to Supabase directly from the browser, so authorization
 * cannot be skipped by editing client code or calling from the console.
 */

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export async function apiFetch<T = any>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const headers = new Headers(init.headers);
    if (init.body !== undefined && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    if (session?.access_token) {
      headers.set("Authorization", `Bearer ${session.access_token}`);
    }

    const res = await fetch(path, { ...init, headers });

    let payload: any = null;
    try {
      payload = await res.json();
    } catch {
      // A body-less response (e.g. 204) is fine.
    }

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: payload?.error || `Request failed (${res.status})`,
        data: payload ?? undefined,
      };
    }

    return { ok: true, status: res.status, data: payload as T };
  } catch (err: any) {
    // Network failure, offline, request aborted.
    return { ok: false, status: 0, error: err?.message || "Network error" };
  }
}

export const apiGet = <T = any>(path: string) => apiFetch<T>(path);

export const apiSend = <T = any>(path: string, method: "POST" | "PATCH" | "PUT" | "DELETE", body?: any) =>
  apiFetch<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
