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
import { canPublishForm } from "@/lib/authz";

const MAX_VERSION_ATTEMPTS = 3;
const UNIQUE_VIOLATION = "23505";

/**
 * POST /api/forms/:formId/publish
 *
 * Snapshots the current draft into a new immutable `form_versions` row and marks
 * the form published. Only editors and owners may publish.
 *
 * Version numbers are allocated read-then-insert, which can collide if two
 * people publish at the same moment; the unique constraint on
 * (form_id, version) catches that and we retry with a fresh number. That
 * constraint is what makes this safe — see supabase/migrations for the DDL.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ formId: string }> }) {
  try {
    const { formId } = await params;
    if (bodyTooLarge(req, MAX_SCHEMA_BYTES)) return jsonError("This form is too large to save.", 413);

    const body = await readJsonBody<{ title?: string; content?: any }>(req);
    if (!body) return jsonError("Invalid JSON body", 400);

    const { title, content } = body;
    if (typeof title !== "string" || content === undefined || content === null) {
      return jsonError("A title and content are required to publish.", 400);
    }

    const { supabase, userId } = await getRequestContext(req);
    if (!userId) return jsonError("Authentication required.", 401);

    const { form, role, error } = await resolveFormAccess(supabase, formId, userId);
    if (!form) return notFound(error || "Form not found");
    if (!canPublishForm(form, role)) return forbidden("You cannot publish this form.");

    const now = new Date().toISOString();

    // Keep the stored draft in step with what is being published.
    const { error: draftErr } = await supabase
      .from("forms")
      .update({ draft_schema: { title, content }, updated_at: now })
      .eq("id", formId);

    if (draftErr) return serverError("/api/forms/[formId]/publish draft sync", draftErr);

    let versionRow: { id: string; version: number } | null = null;
    let lastError: any = null;

    for (let attempt = 0; attempt < MAX_VERSION_ATTEMPTS; attempt++) {
      const { data: latest } = await supabase
        .from("form_versions")
        .select("version")
        .eq("form_id", formId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextVersion = (latest?.version || 0) + 1;

      const { data: inserted, error: insertErr } = await supabase
        .from("form_versions")
        .insert({ form_id: formId, title, content, version: nextVersion, created_by: userId })
        .select("id, version")
        .maybeSingle();

      if (!insertErr && inserted) {
        versionRow = inserted;
        lastError = null;
        break;
      }

      lastError = insertErr;
      if (insertErr?.code !== UNIQUE_VIOLATION) break;
    }

    if (!versionRow) {
      return serverError("/api/forms/[formId]/publish version insert", lastError);
    }

    const { error: statusErr } = await supabase
      .from("forms")
      .update({ status: "published", updated_at: now })
      .eq("id", formId);

    if (statusErr) return serverError("/api/forms/[formId]/publish status", statusErr);

    return NextResponse.json({
      id: formId,
      version_id: versionRow.id,
      version: versionRow.version,
      updated_at: now,
    });
  } catch (err) {
    return serverError("/api/forms/[formId]/publish", err);
  }
}
