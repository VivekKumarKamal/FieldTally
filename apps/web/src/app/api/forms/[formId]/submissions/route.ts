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
import { canReadAllSubmissions, canSubmit } from "@/lib/authz";
import { gradeQuiz, isQuizSchema, stripClientQuizResult } from "@/lib/quiz";
import { rateLimit, clientIp } from "@/lib/rateLimit";

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 500;

/** Reject payloads large enough to be an abuse vector rather than a form response. */
const MAX_SUBMISSION_BYTES = 512 * 1024;

/**
 * GET /api/forms/:formId/submissions?version=&limit=&offset=
 *
 * Members with a viewer/editor/owner role see every response. A `submitter` sees
 * only their own. Being able to *fill in* an open form grants neither — reading
 * other people's answers is a separate, explicitly granted capability.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ formId: string }> }) {
  try {
    const { formId } = await params;
    const { searchParams } = new URL(req.url);
    const versionStr = searchParams.get("version");
    const limit = Math.min(
      parseInt(searchParams.get("limit") || String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE
    );
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10) || 0, 0);

    const { supabase, userId } = await getRequestContext(req);
    if (!userId) return jsonError("Authentication required to view submissions.", 401);

    const { form, role, error } = await resolveFormAccess(supabase, formId, userId);
    if (!form) return notFound(error || "Form not found");

    // Staff see every response; anyone else is scoped to the rows they filed
    // themselves, which needs no membership.
    const seesEverything = canReadAllSubmissions(form, role);

    let query = supabase
      .from("submissions")
      .select("id, form_version, submitted_by, data, filled_at, synced_at", { count: "exact" })
      .eq("form_id", formId)
      .order("filled_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (!seesEverything) {
      query = query.eq("submitted_by", userId);
    }

    if (versionStr) {
      const versionNum = parseInt(versionStr, 10);
      if (!isNaN(versionNum)) query = query.eq("form_version", versionNum);
    }

    const { data: submissions, count, error: subErr } = await query;

    if (subErr) return serverError("/api/forms/[formId]/submissions GET", subErr);

    const total = count ?? 0;
    return NextResponse.json({
      submissions: submissions ?? [],
      total,
      hasMore: offset + (submissions?.length ?? 0) < total,
      scope: seesEverything ? "all" : "own",
    });
  } catch (err) {
    return serverError("/api/forms/[formId]/submissions GET", err);
  }
}

/**
 * POST /api/forms/:formId/submissions
 *
 * The quiz score is recomputed here from the stored version schema. The client
 * also grades locally so it can show a result instantly, but that number is
 * discarded — otherwise a taker could POST any score they liked.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ formId: string }> }) {
  try {
    const { formId } = await params;

    const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
    if (contentLength > MAX_SUBMISSION_BYTES) {
      return jsonError("Submission is too large.", 413);
    }

    const body = await readJsonBody<{ data?: Record<string, any>; form_version?: number }>(req);
    if (!body) return jsonError("Invalid JSON body", 400);

    if (!body.data || typeof body.data !== "object" || Array.isArray(body.data)) {
      return jsonError("Missing or invalid 'data' object in request body.", 400);
    }

    const { supabase, userId } = await getRequestContext(req);

    // Open forms accept anonymous responses, so throttle by identity when we have
    // one and by IP otherwise, to blunt automated submission floods.
    const { allowed, retryAfter } = rateLimit(`submit:${formId}:${userId || clientIp(req)}`, {
      limit: 30,
      windowMs: 60_000,
    });
    if (!allowed) {
      return NextResponse.json(
        { error: `Too many submissions. Please wait ${retryAfter}s.` },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const { form, role, error } = await resolveFormAccess(supabase, formId, userId);
    if (!form) return notFound(error || "Form not found");

    if (!canSubmit(form, role)) {
      return forbidden(
        role === "viewer" ? "Viewers are not permitted to submit responses." : "You cannot submit to this form."
      );
    }

    if (form.status !== "published") {
      return jsonError("This form is not currently accepting responses.", 409);
    }

    // Resolve the version being answered, and load its schema so we can grade.
    let versionQuery = supabase.from("form_versions").select("version, content").eq("form_id", formId);

    if (body.form_version !== undefined && body.form_version !== null) {
      const requested = Number(body.form_version);
      if (!Number.isInteger(requested)) return jsonError("Invalid form_version", 400);
      versionQuery = versionQuery.eq("version", requested);
    } else {
      versionQuery = versionQuery.order("version", { ascending: false }).limit(1);
    }

    const { data: versionRow, error: versionErr } = await versionQuery.maybeSingle();

    if (versionErr) return serverError("/api/forms/[formId]/submissions version", versionErr);
    if (!versionRow) return jsonError("No published version found for this form. Cannot submit.", 400);

    // Never persist a client-supplied score.
    const answers = stripClientQuizResult(body.data);
    const payload: Record<string, any> = { ...answers };

    if (isQuizSchema(versionRow.content)) {
      // One attempt per signed-in user. The browser also keeps a localStorage
      // flag for a nicer message, but that is cosmetic — this is the real check.
      if (userId) {
        const { data: existing } = await supabase
          .from("submissions")
          .select("id")
          .eq("form_id", formId)
          .eq("submitted_by", userId)
          .limit(1);

        if (existing && existing.length > 0) {
          return jsonError("You have already completed this quiz.", 409);
        }
      }

      const result = gradeQuiz(versionRow.content, answers);
      if (result) payload.__quiz_result = result;
    }

    const { data: newSubmission, error: insertErr } = await supabase
      .from("submissions")
      .insert({
        form_id: formId,
        form_version: versionRow.version,
        // Taken from the verified token, never from the request body.
        submitted_by: userId,
        data: payload,
        filled_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (insertErr || !newSubmission) {
      return serverError("/api/forms/[formId]/submissions insert", insertErr);
    }

    const showResults = (versionRow.content as any)?.attrs?.showResultsImmediately !== false;

    return NextResponse.json(
      {
        submission: newSubmission,
        // Echo the authoritative score back only when the form is set to reveal it.
        quiz_result: showResults ? (payload.__quiz_result ?? null) : null,
      },
      { status: 201 }
    );
  } catch (err) {
    return serverError("/api/forms/[formId]/submissions POST", err);
  }
}
