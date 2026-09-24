import { NextRequest, NextResponse } from "next/server";
import {
  getRequestContext,
  resolveFormAccess,
  jsonError,
  forbidden,
  notFound,
  serverError,
  readJsonBody,
  bodyTooLarge,
  MAX_SCHEMA_BYTES,
} from "@/lib/supabaseServer";
import {
  canReadDraftSchema,
  canReadPublishedSchema,
  canSeeAnswerKey,
  canEditForm,
  canManageForm,
} from "@/lib/authz";
import { stripAnswerKey } from "@/lib/quiz";

/**
 * GET /api/forms/:formId?status=draft|published
 *
 * Returns the form schema. The published schema is readable by members and — for
 * an open form — by anyone with the link. The draft is editors-only: it can hold
 * unreleased questions and, in quiz mode, the answer key.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ formId: string }> }) {
  try {
    const { formId } = await params;
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "published";
    const versionParam = searchParams.get("version");

    const { supabase, userId } = await getRequestContext(req);
    const { form, role, error } = await resolveFormAccess(supabase, formId, userId);

    if (!form) {
      // RLS hides a restricted form from a signed-out visitor, so "missing" and
      // "not yours" are indistinguishable here. Prompting an anonymous caller to
      // sign in reveals nothing they could not already guess and keeps the
      // "Sign In to Access" path working for private forms.
      if (!userId) {
        return NextResponse.json(
          { error: "This form is restricted.", reason: "authentication_required" },
          { status: 401 }
        );
      }
      return notFound(error || "Form not found");
    }

    if (status === "draft") {
      if (!canReadDraftSchema(form, role)) {
        return forbidden("Only the form's editors can view its draft.");
      }

      const { data: draftRow, error: formErr } = await supabase
        .from("forms")
        .select("id, draft_schema, status, access_open, created_by, created_at, updated_at")
        .eq("id", formId)
        .maybeSingle();

      if (formErr || !draftRow) return notFound("Form not found");

      const draftSchema = draftRow.draft_schema as any;
      return NextResponse.json({
        id: draftRow.id,
        // Raw title — an untitled draft is "", and the UI supplies its own
        // placeholder. Substituting text here would make it real on next save.
        title: draftSchema?.title ?? "",
        schema: draftSchema?.content || draftSchema,
        version: null,
        status: draftRow.status,
        access_open: draftRow.access_open,
        created_by: draftRow.created_by,
        created_at: draftRow.created_at,
        updated_at: draftRow.updated_at,
      });
    }

    if (!canReadPublishedSchema(form, role)) {
      // Distinguish "sign in and you might get in" from a flat refusal so the UI
      // can offer a login link.
      return NextResponse.json(
        { error: "This form is restricted.", reason: userId ? "forbidden" : "authentication_required" },
        { status: userId ? 403 : 401 }
      );
    }

    if (form.status !== "published") {
      return jsonError("This form is not currently published.", 404);
    }

    let query = supabase
      .from("form_versions")
      .select("id, version, title, content, created_at")
      .eq("form_id", formId);

    if (versionParam) {
      const versionNum = parseInt(versionParam, 10);
      if (isNaN(versionNum)) return jsonError("Invalid version", 400);
      query = query.eq("version", versionNum);
    } else {
      query = query.order("version", { ascending: false }).limit(1);
    }

    const { data: versionData, error: versionErr } = await query.maybeSingle();

    if (versionErr) return serverError("/api/forms/[formId] version fetch", versionErr);
    if (!versionData) return notFound("No published version found for this form.");

    // Determine whether the requested version is the newest one, so the taker can
    // be warned they are looking at an old copy.
    const { data: latest } = await supabase
      .from("form_versions")
      .select("version")
      .eq("form_id", formId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    // A taker must never receive the answer key — they'd read it off the wire.
    const content = canSeeAnswerKey(form, role)
      ? versionData.content
      : stripAnswerKey(versionData.content);

    return NextResponse.json({
      id: formId,
      version_id: versionData.id,
      title: versionData.title,
      schema: content,
      version: versionData.version,
      is_latest: latest ? latest.version === versionData.version : true,
      status: "published",
      access_open: form.access_open,
      role,
      created_at: versionData.created_at,
    });
  } catch (err) {
    return serverError("/api/forms/[formId] GET", err);
  }
}

/**
 * PATCH /api/forms/:formId
 *
 * Saves the draft (editors) and/or toggles public access (owner only).
 *
 * Draft saves use optimistic concurrency: the client sends the `updated_at` it
 * last saw, and a save is rejected with 409 if the stored row has moved on. That
 * turns a silent overwrite of a collaborator's work into a visible conflict.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ formId: string }> }) {
  try {
    const { formId } = await params;
    // Checked before parsing — otherwise the oversized body is already in memory.
    if (bodyTooLarge(req, MAX_SCHEMA_BYTES)) return jsonError("This form is too large to save.", 413);

    const body = await readJsonBody<{
      draft_schema?: { title: string; content: any };
      access_open?: boolean;
      expected_updated_at?: string | null;
    }>(req);

    if (!body) return jsonError("Invalid JSON body", 400);

    const { supabase, userId } = await getRequestContext(req);
    if (!userId) return jsonError("Authentication required.", 401);

    const { form, role, error } = await resolveFormAccess(supabase, formId, userId);
    if (!form) return notFound(error || "Form not found");

    // Narrowly typed rather than Record<string, any> so the Supabase client can
    // still check the column names.
    const update: {
      draft_schema?: any;
      access_open?: boolean;
      updated_at?: string;
    } = {};

    if (body.draft_schema !== undefined) {
      if (!canEditForm(form, role)) return forbidden("You cannot edit this form.");
      if (typeof body.draft_schema !== "object" || body.draft_schema === null) {
        return jsonError("Invalid draft_schema", 400);
      }
      update.draft_schema = body.draft_schema;
    }

    if (body.access_open !== undefined) {
      // Sharing is owner-only: an editor may change questions but not who gets in.
      if (!canManageForm(form, role)) return forbidden("Only the form owner can change access settings.");
      if (typeof body.access_open !== "boolean") return jsonError("access_open must be a boolean", 400);
      update.access_open = body.access_open;
    }

    if (Object.keys(update).length === 0) return jsonError("Nothing to update", 400);

    // Server clock, not the caller's — a skewed client must not be able to win a
    // last-write-wins race by claiming a future timestamp.
    const now = new Date().toISOString();
    update.updated_at = now;

    let query = supabase.from("forms").update(update).eq("id", formId);

    if (body.draft_schema !== undefined && body.expected_updated_at) {
      // Only overwrite if nobody else has saved since the client last loaded.
      query = query.lte("updated_at", body.expected_updated_at);
    }

    const { data: updated, error: updateErr } = await query.select("id, updated_at, access_open").maybeSingle();

    if (updateErr) return serverError("/api/forms/[formId] PATCH", updateErr);

    if (!updated) {
      if (body.expected_updated_at) {
        const { data: current } = await supabase
          .from("forms")
          .select("updated_at")
          .eq("id", formId)
          .maybeSingle();

        return NextResponse.json(
          {
            error: "This form was changed somewhere else. Reload to get the latest version before saving again.",
            conflict: true,
            current_updated_at: current?.updated_at ?? null,
          },
          { status: 409 }
        );
      }
      return notFound("Form not found");
    }

    return NextResponse.json({ id: updated.id, updated_at: updated.updated_at, access_open: updated.access_open });
  } catch (err) {
    return serverError("/api/forms/[formId] PATCH", err);
  }
}

/** DELETE /api/forms/:formId — owner only. Removes versions, members, then the form. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ formId: string }> }) {
  try {
    const { formId } = await params;
    const { supabase, userId } = await getRequestContext(req);
    if (!userId) return jsonError("Authentication required.", 401);

    const { form, role, error } = await resolveFormAccess(supabase, formId, userId);
    if (!form) return notFound(error || "Form not found");
    if (!canManageForm(form, role)) return forbidden("Only the form owner can delete it.");

    // Children first — the schema has no cascade guarantee we can rely on here.
    await supabase.from("submissions").delete().eq("form_id", formId);
    await supabase.from("form_versions").delete().eq("form_id", formId);
    await supabase.from("form_members").delete().eq("form_id", formId);

    const { error: deleteErr } = await supabase.from("forms").delete().eq("id", formId);
    if (deleteErr) return serverError("/api/forms/[formId] DELETE", deleteErr);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError("/api/forms/[formId] DELETE", err);
  }
}
