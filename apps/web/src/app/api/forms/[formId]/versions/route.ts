import { NextRequest, NextResponse } from "next/server";
import {
  getRequestContext,
  resolveFormAccess,
  jsonError,
  forbidden,
  notFound,
  serverError,
} from "@/lib/supabaseServer";
import { canReadAllSubmissions } from "@/lib/authz";

/**
 * GET /api/forms/:formId/versions
 *
 * Full version history including each version's schema — which in quiz mode
 * contains the answer key, so this is restricted to people trusted with the form
 * (owner, editor, viewer). Used by the editor's version history panel and by the
 * responses dashboard to build its columns.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ formId: string }> }) {
  try {
    const { formId } = await params;
    const { supabase, userId } = await getRequestContext(req);
    if (!userId) return jsonError("Authentication required.", 401);

    const { form, role, error } = await resolveFormAccess(supabase, formId, userId);
    if (!form) return notFound(error || "Form not found");

    if (!canReadAllSubmissions(form, role)) {
      return forbidden("You do not have access to this form.");
    }

    const [{ data: versions, error: versionErr }, { data: formRow }] = await Promise.all([
      supabase
        .from("form_versions")
        .select("id, version, title, content, created_at")
        .eq("form_id", formId)
        .order("version", { ascending: false }),
      supabase.from("forms").select("draft_schema").eq("id", formId).maybeSingle(),
    ]);

    if (versionErr) return serverError("/api/forms/[formId]/versions", versionErr);

    return NextResponse.json({
      title: (formRow?.draft_schema as any)?.title || "Untitled Form",
      role,
      versions: versions ?? [],
    });
  } catch (err) {
    return serverError("/api/forms/[formId]/versions", err);
  }
}
