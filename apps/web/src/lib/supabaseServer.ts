import { createClient } from "@supabase/supabase-js";
import { Database } from "@fieldtally/database";
import { NextRequest, NextResponse } from "next/server";
import type { EffectiveRole, FormAccessContext } from "./authz";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

export type ServerSupabaseClient = ReturnType<typeof createSupabaseClient>;

function createSupabaseClient(token: string | null) {
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
    auth: { persistSession: false },
  });
}

function bearerToken(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  return authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;
}

export interface RequestContext {
  supabase: ServerSupabaseClient;
  userId: string | null;
  userEmail: string | null;
}

/**
 * Resolve the caller once per request: a Supabase client scoped to their token
 * (so RLS still applies as a second line of defence) plus their identity.
 *
 * Previously each route built a client and separately verified the token, which
 * meant two clients and two auth round-trips per request. This does it once.
 */
export async function getRequestContext(req: NextRequest): Promise<RequestContext> {
  const token = bearerToken(req);
  const supabase = createSupabaseClient(token);

  if (!token) return { supabase, userId: null, userEmail: null };

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return { supabase, userId: null, userEmail: null };

  return { supabase, userId: data.user.id, userEmail: data.user.email ?? null };
}

export interface ResolvedForm {
  form: (FormAccessContext & { id: string }) | null;
  role: EffectiveRole;
  error?: string;
}

/**
 * Fetch a form and work out the caller's effective role on it.
 *
 * This resolves *identity*, not permission — ask the predicates in `authz.ts`
 * what the resulting role is allowed to do.
 */
export async function resolveFormAccess(
  supabase: ServerSupabaseClient,
  formId: string,
  userId: string | null
): Promise<ResolvedForm> {
  const { data: form, error } = await supabase
    .from("forms")
    .select("id, status, access_open, created_by")
    .eq("id", formId)
    .maybeSingle();

  if (error || !form) {
    return { form: null, role: "anonymous", error: "Form not found or inaccessible." };
  }

  if (userId && form.created_by === userId) {
    return { form, role: "owner" };
  }

  if (userId) {
    const { data: member } = await supabase
      .from("form_members")
      .select("role")
      .eq("form_id", formId)
      .eq("user_id", userId)
      .maybeSingle();

    if (member?.role) {
      return { form, role: member.role as EffectiveRole };
    }
  }

  return { form, role: "anonymous" };
}

// ── Response helpers ──────────────────────────────────────

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export const unauthorized = (message = "Authentication required.") => jsonError(message, 401);
export const forbidden = (message = "You do not have permission to do that.") => jsonError(message, 403);
export const notFound = (message = "Not found.") => jsonError(message, 404);

/**
 * Log the real cause server-side and return a generic message to the caller, so
 * internal errors never leak database details into a client response.
 */
export function serverError(scope: string, err: unknown) {
  console.error(`[${scope}]`, err instanceof Error ? err.message : err);
  return jsonError("Internal server error", 500);
}


/** A published form schema large enough to be abuse rather than a form. */
export const MAX_SCHEMA_BYTES = 1024 * 1024; // 1 MB

/**
 * Reject an oversized body before parsing it.
 *
 * Reads the declared Content-Length, which a hostile client can omit — the
 * hosting platform enforces its own hard limit. This stops an authenticated
 * user from parking arbitrarily large schemas in the database by accident or
 * on purpose.
 */
export function bodyTooLarge(req: NextRequest, maxBytes: number): boolean {
  const declared = parseInt(req.headers.get("content-length") || "0", 10);
  return Number.isFinite(declared) && declared > maxBytes;
}

/** Parse a JSON body, returning null when it is absent or malformed. */
export async function readJsonBody<T = any>(req: NextRequest): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}
