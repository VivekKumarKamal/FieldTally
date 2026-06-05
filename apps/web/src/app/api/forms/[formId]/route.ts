import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient, getAuthenticatedUser, checkFormAccess } from "@/lib/supabaseServer";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  try {
    const { formId } = await params;
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "published";

    const supabase = getSupabaseClient(req);
    const user = await getAuthenticatedUser(req);
    const userId = user?.id || null;

    // Check access: both draft and published require at least viewer permission on the form.
    // However, published schemas can also be fetched anonymously if the form has access_open === true.
    const { hasAccess, error } = await checkFormAccess(supabase, formId, userId, "viewer");

    if (!hasAccess) {
      return NextResponse.json({ error: error || "Access denied" }, { status: 403 });
    }

    if (status === "draft") {
      const { data: form, error: formErr } = await supabase
        .from("forms")
        .select("id, draft_schema, status, access_open, created_by, created_at, updated_at")
        .eq("id", formId)
        .single();

      if (formErr || !form) {
        return NextResponse.json({ error: "Form not found" }, { status: 404 });
      }

      const draftSchema = form.draft_schema as any;
      return NextResponse.json({
        id: form.id,
        title: draftSchema?.title || "Untitled Form",
        schema: draftSchema?.content || draftSchema,
        version: null,
        status: form.status,
        access_open: form.access_open,
        created_by: form.created_by,
        created_at: form.created_at,
        updated_at: form.updated_at,
      });
    } else {
      // Fetch the latest version from form_versions
      const { data: versionData, error: versionErr } = await supabase
        .from("form_versions")
        .select("id, version, title, content, created_at")
        .eq("form_id", formId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (versionErr) {
        return NextResponse.json({ error: "Error fetching form version" }, { status: 500 });
      }

      if (!versionData) {
        return NextResponse.json({ error: "No published version found for this form" }, { status: 404 });
      }

      return NextResponse.json({
        id: formId,
        version_id: versionData.id,
        title: versionData.title,
        schema: versionData.content,
        version: versionData.version,
        status: "published",
        created_at: versionData.created_at,
      });
    }
  } catch (err: any) {
    console.error("[/api/forms/[formId]] GET error:", err?.message || err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
