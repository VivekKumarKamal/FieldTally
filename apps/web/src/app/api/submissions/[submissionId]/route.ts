import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient, getAuthenticatedUser, checkSubmissionAccess } from "@/lib/supabaseServer";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    const { submissionId } = await params;
    const supabase = getSupabaseClient(req);
    const user = await getAuthenticatedUser(req);
    const userId = user?.id || null;

    const { hasAccess, submission, error } = await checkSubmissionAccess(supabase, submissionId, userId, "read");

    if (!hasAccess || !submission) {
      return NextResponse.json({ error: error || "Access denied" }, { status: 403 });
    }

    return NextResponse.json({ submission });
  } catch (err: any) {
    console.error("[/api/submissions/[submissionId]] GET error:", err?.message || err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    const { submissionId } = await params;
    const body = await req.json();
    const { data } = body;

    if (!data || typeof data !== "object") {
      return NextResponse.json({ error: "Missing or invalid 'data' object in request body." }, { status: 400 });
    }

    const supabase = getSupabaseClient(req);
    const user = await getAuthenticatedUser(req);
    const userId = user?.id || null;

    const { hasAccess, submission, error } = await checkSubmissionAccess(supabase, submissionId, userId, "update");

    if (!hasAccess || !submission) {
      return NextResponse.json({ error: error || "Access denied" }, { status: 403 });
    }

    const { data: updatedSubmission, error: updateErr } = await supabase
      .from("submissions")
      .update({
        data: data,
        synced_at: new Date().toISOString()
      })
      .eq("id", submissionId)
      .select("*")
      .single();

    if (updateErr || !updatedSubmission) {
      return NextResponse.json({ error: updateErr?.message || "Failed to update submission" }, { status: 500 });
    }

    return NextResponse.json({ submission: updatedSubmission });
  } catch (err: any) {
    console.error("[/api/submissions/[submissionId]] PUT error:", err?.message || err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
