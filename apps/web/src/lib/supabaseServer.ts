import { createClient } from "@supabase/supabase-js";
import { Database } from "@fieldtally/database";
import { NextRequest } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

/**
 * Creates a server-side Supabase client. If a bearer token is present in the request's
 * Authorization header, the client is initialized with that token to respect Row-Level Security.
 */
export function getSupabaseClient(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;

  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
    auth: {
      persistSession: false,
    },
  });
}

/**
 * Retrieves the authenticated user using the request's bearer token.
 */
export async function getAuthenticatedUser(req: NextRequest) {
  const supabase = getSupabaseClient(req);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return null;
  }
  return user;
}

/**
 * Checks if the user has access to a specific form with the required role.
 * Role hierarchy: submitter < viewer < editor < owner
 */
export async function checkFormAccess(
  supabase: ReturnType<typeof getSupabaseClient>,
  formId: string,
  userId: string | null,
  requiredRole: "owner" | "editor" | "viewer" | "submitter" = "submitter"
) {
  // 1. Fetch form status and creator
  const { data: form, error: formError } = await supabase
    .from("forms")
    .select("id, status, access_open, created_by")
    .eq("id", formId)
    .single();

  if (formError || !form) {
    return { hasAccess: false, form: null, error: "Form not found or inaccessible." };
  }

  // 2. If user is form creator, they always have owner access
  if (userId && form.created_by === userId) {
    return { hasAccess: true, form, role: "owner" };
  }

  // 3. Fetch membership from form_members
  let memberRole: string | null = null;
  if (userId) {
    const { data: member } = await supabase
      .from("form_members")
      .select("role")
      .eq("form_id", formId)
      .eq("user_id", userId)
      .maybeSingle();
    if (member) {
      memberRole = member.role;
    }
  }

  // 4. Role check
  const rolesOrder = ["submitter", "viewer", "editor", "owner"];
  const userRoleIndex = memberRole ? rolesOrder.indexOf(memberRole) : -1;
  const requiredRoleIndex = rolesOrder.indexOf(requiredRole);

  if (memberRole && userRoleIndex >= requiredRoleIndex) {
    return { hasAccess: true, form, role: memberRole };
  }

  // 5. Check if form is open to public (access_open: true) and published
  if (form.access_open && form.status === "published" && (requiredRole === "submitter" || requiredRole === "viewer")) {
    // A user with viewer role explicitly cannot submit
    if (requiredRole === "submitter" && memberRole === "viewer") {
      return { hasAccess: false, form, error: "Viewers are not permitted to submit responses." };
    }
    return { hasAccess: true, form, role: memberRole || "anonymous" };
  }

  return { hasAccess: false, form, error: "Unauthorized access to this form." };
}

/**
 * Checks if the user has access to a specific submission.
 * - Original submitter can always read/update their own submission.
 * - Form owners/editors can read and update.
 * - Form viewers can read.
 */
export async function checkSubmissionAccess(
  supabase: ReturnType<typeof getSupabaseClient>,
  submissionId: string,
  userId: string | null,
  action: "read" | "update"
) {
  // 1. Fetch submission
  const { data: submission, error: subError } = await supabase
    .from("submissions")
    .select("*")
    .eq("id", submissionId)
    .single();

  if (subError || !submission) {
    return { hasAccess: false, submission: null, error: "Submission not found." };
  }

  // 2. If the user is the original submitter, they have access
  if (userId && submission.submitted_by === userId) {
    return { hasAccess: true, submission };
  }

  // 3. Otherwise, check the user's role on the associated form
  const requiredRole = action === "read" ? "viewer" : "editor";
  const { hasAccess, error } = await checkFormAccess(supabase, submission.form_id, userId, requiredRole);

  if (hasAccess) {
    return { hasAccess: true, submission };
  }

  return { hasAccess: false, submission: null, error: error || "Unauthorized access to this submission." };
}
