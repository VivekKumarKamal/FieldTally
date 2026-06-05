import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient, getAuthenticatedUser, checkFormAccess } from "@/lib/supabaseServer";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  try {
    const { formId } = await params;
    const { searchParams } = new URL(req.url);
    const versionStr = searchParams.get("version");

    const supabase = getSupabaseClient(req);
    const user = await getAuthenticatedUser(req);
    const userId = user?.id || null;

    // 1. Check if the user has viewer access (can see all submissions)
    const { hasAccess: isViewer } = await checkFormAccess(supabase, formId, userId, "viewer");

    let query = supabase
      .from("submissions")
      .select("id, form_version, submitted_by, data, filled_at, synced_at")
      .eq("form_id", formId)
      .order("filled_at", { ascending: false });

    if (!isViewer) {
      // 2. If not a viewer, check if they have submitter access (can see only their own submissions)
      const { hasAccess: isSubmitter, error: submitterError } = await checkFormAccess(supabase, formId, userId, "submitter");

      if (!isSubmitter) {
        return NextResponse.json({ error: submitterError || "Access denied" }, { status: 403 });
      }

      // If they are an authenticated submitter, filter by their userId
      if (userId) {
        query = query.eq("submitted_by", userId);
      } else {
        // Anonymous submitters cannot view submissions because they cannot be verified
        return NextResponse.json({ error: "Anonymous users cannot view submissions." }, { status: 403 });
      }
    }

    if (versionStr) {
      const versionNum = parseInt(versionStr, 10);
      if (!isNaN(versionNum)) {
        query = query.eq("form_version", versionNum);
      }
    }

    const { data: submissions, error: subErr } = await query;

    if (subErr) {
      return NextResponse.json({ error: "Error fetching submissions" }, { status: 500 });
    }

    return NextResponse.json({ submissions });
  } catch (err: any) {
    console.error("[/api/forms/[formId]/submissions] GET error:", err?.message || err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  try {
    const { formId } = await params;
    const body = await req.json();
    const { data, form_version } = body;

    if (!data || typeof data !== "object") {
      return NextResponse.json({ error: "Missing or invalid 'data' object in request body." }, { status: 400 });
    }

    const supabase = getSupabaseClient(req);
    const user = await getAuthenticatedUser(req);
    const userId = user?.id || null;

    // Check submitter access
    const { hasAccess, error } = await checkFormAccess(supabase, formId, userId, "submitter");

    if (!hasAccess) {
      return NextResponse.json({ error: error || "Access denied" }, { status: 403 });
    }

    let resolvedVersion = form_version;

    if (resolvedVersion === undefined || resolvedVersion === null) {
      // Fetch the latest version number
      const { data: latestVersionResult, error: latestError } = await supabase
        .from("form_versions")
        .select("version")
        .eq("form_id", formId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestError) {
        return NextResponse.json({ error: "Error fetching form version info" }, { status: 500 });
      }

      if (!latestVersionResult) {
        return NextResponse.json({ error: "No published versions found for this form. Cannot submit." }, { status: 400 });
      }

      resolvedVersion = latestVersionResult.version;
    }

    // Insert submission
    const { data: newSubmission, error: insertErr } = await supabase
      .from("submissions")
      .insert({
        form_id: formId,
        form_version: resolvedVersion,
        submitted_by: userId,
        data: data,
        filled_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (insertErr || !newSubmission) {
      return NextResponse.json({ error: insertErr?.message || "Failed to create submission" }, { status: 500 });
    }

    return NextResponse.json({ submission: newSubmission }, { status: 201 });
  } catch (err: any) {
    console.error("[/api/forms/[formId]/submissions] POST error:", err?.message || err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
