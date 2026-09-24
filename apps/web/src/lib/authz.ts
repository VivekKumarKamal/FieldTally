/**
 * Central capability model for forms.
 *
 * Every authorization decision in the app derives from this file so the rules
 * live in exactly one place. These functions are pure — they take a resolved
 * form + the caller's effective role and answer a yes/no question. Fetching the
 * form and resolving the role is the job of `supabaseServer.ts`.
 *
 * Role meanings:
 *   owner     — the creator, or an explicit `owner` member. Full control.
 *   editor    — may edit the draft and read responses. Cannot manage sharing.
 *   viewer    — may read responses. Explicitly may NOT submit.
 *   submitter — may submit, and may read back only their own submissions.
 *   anonymous — no membership (signed out, or signed in without a role).
 *
 * `access_open` means "anyone with the link may SUBMIT this form". It is a
 * submission grant only — it never confers the ability to read other people's
 * responses, and never exposes the unpublished draft.
 */

export type FormRole = "owner" | "editor" | "viewer" | "submitter";
export type EffectiveRole = FormRole | "anonymous";

/** The subset of a `forms` row needed to make an access decision. */
export interface FormAccessContext {
  status: string | null;
  access_open: boolean | null;
  created_by: string | null;
}

/** Roles that imply the holder is trusted with the form's contents. */
const STAFF_ROLES: EffectiveRole[] = ["owner", "editor", "viewer"];

/**
 * May the caller submit a response?
 *
 * Explicit `viewer` members are read-only and are denied even on an open form —
 * this preserves the product rule that a viewer observes but does not respond.
 */
export function canSubmit(form: FormAccessContext, role: EffectiveRole): boolean {
  if (role === "viewer") return false;
  if (role === "owner" || role === "editor" || role === "submitter") return true;
  return form.access_open === true && form.status === "published";
}

/**
 * May the caller read every response to this form?
 *
 * Deliberately excludes `submitter` and `anonymous`. An open form is open for
 * *writing*, not for reading what everyone else wrote.
 */
export function canReadAllSubmissions(form: FormAccessContext, role: EffectiveRole): boolean {
  return STAFF_ROLES.includes(role);
}

/**
 * Reading back your *own* submissions needs no role at all — a signed-in person
 * who filled in an open form is entitled to see what they sent, even though they
 * are not a member of it. Callers enforce this by scoping the query to the
 * verified user id, so there is no predicate here on purpose.
 */

/** May the caller change the form's questions? */
export function canEditForm(form: FormAccessContext, role: EffectiveRole): boolean {
  return role === "owner" || role === "editor";
}

/** May the caller publish a new version? */
export function canPublishForm(form: FormAccessContext, role: EffectiveRole): boolean {
  return canEditForm(form, role);
}

/**
 * May the caller change sharing settings, manage members, or delete the form?
 * Owner-only — an editor can change questions but cannot hand out access.
 */
export function canManageForm(form: FormAccessContext, role: EffectiveRole): boolean {
  return role === "owner";
}

/** May the caller load the published schema in order to fill the form in? */
export function canReadPublishedSchema(form: FormAccessContext, role: EffectiveRole): boolean {
  if (role !== "anonymous") return true;
  return form.access_open === true && form.status === "published";
}

/**
 * May the caller load the *unpublished draft* schema?
 *
 * Editors only. A draft can contain half-finished questions and — in quiz mode —
 * the answer key, so it must never follow the same rule as the published schema.
 */
export function canReadDraftSchema(form: FormAccessContext, role: EffectiveRole): boolean {
  return canEditForm(form, role);
}

/**
 * May the caller see the answer key (`correctAnswer` / `quizPoints`) embedded in
 * a quiz schema? Only people who are trusted with the form itself.
 */
export function canSeeAnswerKey(form: FormAccessContext, role: EffectiveRole): boolean {
  return STAFF_ROLES.includes(role);
}
