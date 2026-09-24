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
import { canReadAllSubmissions, canEditForm } from "@/lib/authz";
import { gradeQuiz, isQuizSchema, stripClientQuizResult } from "@/lib/quiz";

type Action = "read" | "update";

/**
 * Resolve access to a single submission.
 *
 * The submitter always reaches their own row. Everyone else needs a role on the
 * parent form — viewer or better to read, editor or better to change. An open
 * form does not make its responses public.
 */
async function loadSubmission(req: NextRequest, submissionId: string, action: Action) {
  const { supabase, userId } = await getRequestContext(req);
  if (!userId) return { response: jsonError("Authentication required.", 401) } as const;

  const { data: submission, error } = await supabase
    .from("submissions")
    .select("*")
    .eq("id", submissionId)
    .maybeSingle();

  if (error || !submission) return { response: notFound("Submission not found.") } as const;

  const isAuthor = submission.submitted_by === userId;

  if (!isAuthor) {
    const { form, role } = await resolveFormAccess(supabase, submission.form_id, userId);
    if (!form) return { response: notFound("Submission not found.") } as const;

    const permitted = action === "read" ? canReadAllSubmissions(form, role) : canEditForm(form, role);
    if (!permitted) return { response: forbidden("You do not have access to this submission.") } as const;
  }

  return { supabase, userId, submission, isAuthor } as const;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ submissionId: string }> }) {
  try {
    const { submissionId } = await params;
    const result = await loadSubmission(req, submissionId, "read");
    if ("response" in result) return result.response;

    return NextResponse.json({ submission: result.submission });
  } catch (err) {
    return serverError("/api/submissions/[submissionId] GET", err);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ submissionId: string }> }) {
  try {
    const { submissionId } = await params;
    const body = await readJsonBody<{ data?: Record<string, any> }>(req);
    if (!body) return jsonError("Invalid JSON body", 400);

    if (!body.data || typeof body.data !== "object" || Array.isArray(body.data)) {
      return jsonError("Missing or invalid 'data' object in request body.", 400);
    }

    const result = await loadSubmission(req, submissionId, "update");
    if ("response" in result) return result.response;

    const { supabase, submission } = result;

    const answers = stripClientQuizResult(body.data);
    const payload: Record<string, any> = { ...answers };

    // Re-grade against the version this response was filed under, so an edit
    // cannot be used to slip in a hand-written score.
    const { data: versionRow } = await supabase
      .from("form_versions")
      .select("content")
      .eq("form_id", submission.form_id)
      .eq("version", submission.form_version)
      .maybeSingle();

    if (versionRow && isQuizSchema(versionRow.content)) {
      const graded = gradeQuiz(versionRow.content, answers);
      if (graded) payload.__quiz_result = graded;
    }

    const { data: updated, error: updateErr } = await supabase
      .from("submissions")
      .update({ data: payload, synced_at: new Date().toISOString() })
      .eq("id", submissionId)
      .select("*")
      .single();

    if (updateErr || !updated) {
      return serverError("/api/submissions/[submissionId] PUT", updateErr);
    }

    return NextResponse.json({ submission: updated });
  } catch (err) {
    return serverError("/api/submissions/[submissionId] PUT", err);
  }
}
