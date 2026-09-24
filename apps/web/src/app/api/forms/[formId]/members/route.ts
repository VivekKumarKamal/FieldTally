import { NextRequest, NextResponse } from "next/server";
import {
  getRequestContext,
  resolveFormAccess,
  jsonError,
  forbidden,
  notFound,
  serverError,
  readJsonBody,
} from "@/lib/supabaseServer";
import { canManageForm } from "@/lib/authz";
import { rateLimit } from "@/lib/rateLimit";

const ASSIGNABLE_ROLES = ["viewer", "submitter", "editor"] as const;
type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

function isAssignableRole(value: unknown): value is AssignableRole {
  return typeof value === "string" && (ASSIGNABLE_ROLES as readonly string[]).includes(value);
}

/**
 * Every operation here is owner-only. These used to run straight from the
 * browser with no server-side check at all, so any signed-in user could add
 * themselves to any form.
 */
async function requireOwner(req: NextRequest, formId: string) {
  const { supabase, userId } = await getRequestContext(req);
  if (!userId) return { response: jsonError("Authentication required.", 401) } as const;

  const { form, role, error } = await resolveFormAccess(supabase, formId, userId);
  if (!form) return { response: notFound(error || "Form not found") } as const;
  if (!canManageForm(form, role)) {
    return { response: forbidden("Only the form owner can manage sharing.") } as const;
  }

  return { supabase, userId } as const;
}

/** GET — list members with their profile details. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ formId: string }> }) {
  try {
    const { formId } = await params;
    const auth = await requireOwner(req, formId);
    if ("response" in auth) return auth.response;
    const { supabase } = auth;

    const { data: form } = await supabase.from("forms").select("access_open").eq("id", formId).maybeSingle();

    const { data: members, error } = await supabase
      .from("form_members")
      .select("user_id, role")
      .eq("form_id", formId);

    if (error) return serverError("/api/forms/[formId]/members GET", error);

    if (!members || members.length === 0) {
      return NextResponse.json({ access_open: form?.access_open ?? false, members: [] });
    }

    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("id, email, name")
      .in(
        "id",
        members.map((m) => m.user_id)
      );

    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

    const enriched = members
      .map((m) => {
        const profile = byId.get(m.user_id);
        return {
          user_id: m.user_id,
          email: profile?.email || "",
          name: profile?.name || "",
          role: m.role,
        };
      })
      .filter((m) => m.email !== "");

    return NextResponse.json({ access_open: form?.access_open ?? false, members: enriched });
  } catch (err) {
    return serverError("/api/forms/[formId]/members GET", err);
  }
}

/** POST — add a member by email address. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ formId: string }> }) {
  try {
    const { formId } = await params;
    const body = await readJsonBody<{ email?: string; role?: string }>(req);
    if (!body) return jsonError("Invalid JSON body", 400);

    const auth = await requireOwner(req, formId);
    if ("response" in auth) return auth.response;
    const { supabase, userId } = auth;

    // This endpoint reveals whether an email is registered. Throttle it so it
    // cannot be used to enumerate the user base.
    const { allowed, retryAfter } = rateLimit(`members:add:${userId}`, { limit: 20, windowMs: 60_000 });
    if (!allowed) {
      return NextResponse.json(
        { error: `Too many requests. Please wait ${retryAfter}s.` },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email) return jsonError("An email address is required.", 400);

    const role: AssignableRole = isAssignableRole(body.role) ? body.role : "submitter";

    const { data: profile, error: profileErr } = await supabase
      .from("user_profiles")
      .select("id, name, email")
      .eq("email", email)
      .maybeSingle();

    if (profileErr) return serverError("/api/forms/[formId]/members POST lookup", profileErr);
    if (!profile) {
      return jsonError(`User with email "${email}" has not registered with FieldTally yet.`, 404);
    }

    const { error: insertErr } = await supabase
      .from("form_members")
      .insert({ form_id: formId, user_id: profile.id, role });

    if (insertErr) {
      if (insertErr.code === "23505") return jsonError("User is already added to this form.", 409);
      return serverError("/api/forms/[formId]/members POST insert", insertErr);
    }

    return NextResponse.json(
      {
        member: {
          user_id: profile.id,
          email: profile.email || email,
          name: profile.name || "",
          role,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    return serverError("/api/forms/[formId]/members POST", err);
  }
}

/** PATCH — change a member's role. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ formId: string }> }) {
  try {
    const { formId } = await params;
    const body = await readJsonBody<{ user_id?: string; role?: string }>(req);
    if (!body) return jsonError("Invalid JSON body", 400);

    const auth = await requireOwner(req, formId);
    if ("response" in auth) return auth.response;
    const { supabase } = auth;

    if (!body.user_id || typeof body.user_id !== "string") return jsonError("user_id is required", 400);
    if (!isAssignableRole(body.role)) {
      return jsonError(`role must be one of: ${ASSIGNABLE_ROLES.join(", ")}`, 400);
    }

    const { data: updated, error } = await supabase
      .from("form_members")
      .update({ role: body.role })
      .eq("form_id", formId)
      .eq("user_id", body.user_id)
      .select("user_id, role")
      .maybeSingle();

    if (error) return serverError("/api/forms/[formId]/members PATCH", error);
    if (!updated) return notFound("That member is not on this form.");

    return NextResponse.json({ member: updated });
  } catch (err) {
    return serverError("/api/forms/[formId]/members PATCH", err);
  }
}

/** DELETE — revoke a member's access. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ formId: string }> }) {
  try {
    const { formId } = await params;
    const body = await readJsonBody<{ user_id?: string }>(req);
    const { searchParams } = new URL(req.url);
    const targetUserId = body?.user_id || searchParams.get("user_id");

    const auth = await requireOwner(req, formId);
    if ("response" in auth) return auth.response;
    const { supabase } = auth;

    if (!targetUserId) return jsonError("user_id is required", 400);

    const { error } = await supabase
      .from("form_members")
      .delete()
      .eq("form_id", formId)
      .eq("user_id", targetUserId);

    if (error) return serverError("/api/forms/[formId]/members DELETE", error);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError("/api/forms/[formId]/members DELETE", err);
  }
}
