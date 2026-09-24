import { NextRequest, NextResponse } from "next/server";
import { getRequestContext, jsonError, serverError, readJsonBody, bodyTooLarge, MAX_SCHEMA_BYTES } from "@/lib/supabaseServer";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * GET /api/forms?limit=&offset=&scope=owned|shared
 *
 * Paginated. The dashboard used to select every form a user owned in one
 * unbounded query; that is fine at ten forms and not at ten thousand.
 */
export async function GET(req: NextRequest) {
  try {
    const { supabase, userId } = await getRequestContext(req);
    if (!userId) return jsonError("Authentication required.", 401);

    const { searchParams } = new URL(req.url);
    const scope = searchParams.get("scope") === "shared" ? "shared" : "owned";
    const limit = Math.min(parseInt(searchParams.get("limit") || String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10) || 0, 0);

    if (scope === "owned") {
      const { data, count, error } = await supabase
        .from("forms")
        .select("id, status, updated_at, draft_schema", { count: "exact" })
        .eq("created_by", userId)
        .order("updated_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) return serverError("/api/forms GET owned", error);

      const total = count ?? 0;
      return NextResponse.json({ forms: data ?? [], total, hasMore: offset + (data?.length ?? 0) < total });
    }

    // Shared: forms the user is a member of but does not own.
    const { data: memberships, error: memberErr } = await supabase
      .from("form_members")
      .select("form_id, role")
      .eq("user_id", userId);

    if (memberErr) return serverError("/api/forms GET shared memberships", memberErr);

    const formIds = (memberships ?? []).map((m) => m.form_id);
    if (formIds.length === 0) {
      return NextResponse.json({ forms: [], total: 0, hasMore: false });
    }

    const { data, count, error } = await supabase
      .from("forms")
      .select("id, status, updated_at, draft_schema, created_by", { count: "exact" })
      .in("id", formIds)
      .neq("created_by", userId)
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return serverError("/api/forms GET shared", error);

    const roleMap = new Map((memberships ?? []).map((m) => [m.form_id, m.role || "submitter"]));
    const forms = (data ?? []).map((f) => ({ ...f, role: roleMap.get(f.id) || "submitter" }));

    const total = count ?? 0;
    return NextResponse.json({ forms, total, hasMore: offset + forms.length < total });
  } catch (err) {
    return serverError("/api/forms GET", err);
  }
}

/**
 * POST /api/forms — create a form the caller owns.
 *
 * Accepts a client-generated id so the editor can keep working against a stable
 * URL. If the id already exists and the caller owns it, this is a no-op rather
 * than an error, which keeps "save a brand new draft" idempotent on retry.
 */
export async function POST(req: NextRequest) {
  try {
    if (bodyTooLarge(req, MAX_SCHEMA_BYTES)) return jsonError("This form is too large to save.", 413);

    const body = await readJsonBody<{ id?: string; draft_schema?: { title: string; content: any } }>(req);
    if (!body) return jsonError("Invalid JSON body", 400);

    const { supabase, userId } = await getRequestContext(req);
    if (!userId) return jsonError("Authentication required.", 401);

    const id = body.id;
    if (!id || typeof id !== "string") return jsonError("A form id is required", 400);

    const { data: existing } = await supabase
      .from("forms")
      .select("id, created_by")
      .eq("id", id)
      .maybeSingle();

    if (existing) {
      // Never let a create call take over someone else's form id.
      if (existing.created_by !== userId) {
        return jsonError("A form with that id already exists.", 409);
      }
      return NextResponse.json({ id, created: false });
    }

    const now = new Date().toISOString();
    const { error } = await supabase.from("forms").insert({
      id,
      draft_schema: body.draft_schema ?? { title: "", content: null },
      // created_by is set from the verified token, never from the request body.
      created_by: userId,
      status: "draft",
      updated_at: now,
    });

    if (error) return serverError("/api/forms POST", error);

    return NextResponse.json({ id, created: true, updated_at: now }, { status: 201 });
  } catch (err) {
    return serverError("/api/forms POST", err);
  }
}
