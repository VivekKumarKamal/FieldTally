import { supabase } from "./supabase";

// ── Types ──

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface StoredDraft {
  schema: any;
  title: string;
  updated_at: string | null;
}

// ── Parse helpers ──

export function parseStoredDraft(raw: string | null): StoredDraft | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    // New format: { schema, title, updated_at }
    if (parsed.schema) return parsed as StoredDraft;
    // Legacy format: the JSON itself is the schema
    return { schema: parsed, title: "", updated_at: null };
  } catch {
    return null;
  }
}

// ── Load form ──

export interface LoadFormResult {
  formId: string;
  userId: string | null;
  schema: any;
  title: string;
  /** True if the editor should remount (remote data was newer) */
  shouldRemount: boolean;
  version?: number | null;
  latestPublishedSchema?: any;
  latestPublishedTitle?: string | null;
}

/**
 * Load the form draft from localStorage + Supabase.
 * If formIdParam is provided (from URL query), use it directly.
 * Otherwise fall back to localStorage for backward compatibility.
 * Returns the resolved data. Does NOT set any React state.
 */
export async function loadForm(initialContent: any, formIdParam?: string | null): Promise<LoadFormResult> {
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id || null;

  let currentId = formIdParam;
  if (!currentId) {
    currentId = crypto.randomUUID();
    localStorage.setItem("current_draft_form_id", currentId);
    return { formId: currentId, userId, schema: initialContent, title: "", shouldRemount: false };
  }

  // Keep localStorage in sync
  localStorage.setItem("current_draft_form_id", currentId);

  // 1. Load from localStorage
  const localData = localStorage.getItem(`draft_schema_${currentId}`);
  const parsedLocal = parseStoredDraft(localData);
  let schema = parsedLocal?.schema || initialContent;
  let title = parsedLocal?.title || "";
  let shouldRemount = false;
  let version: number | null = null;

  // 2. For logged-in users, sync with Supabase
  let latestPublishedSchema = null;
  let latestPublishedTitle = null;

  if (user) {
    try {
      const [{ data }, { data: versionData }] = await Promise.all([
        supabase.from("forms").select("draft_schema, updated_at").eq("id", currentId).single(),
        supabase.from("form_versions").select("version, content, title").eq("form_id", currentId).order("version", { ascending: false }).limit(1).maybeSingle()
      ]);

      if (versionData) {
        version = versionData.version;
        latestPublishedSchema = versionData.content;
        latestPublishedTitle = versionData.title;
      }

      if (data?.draft_schema) {
        const draft = data.draft_schema as any;
        const remoteSchema = draft.content || draft;
        const remoteTitle = draft.title || "";
        const localUpdatedAt = parsedLocal?.updated_at || null;
        const remoteUpdatedAt = data.updated_at;

        if (!localUpdatedAt || (remoteUpdatedAt && new Date(remoteUpdatedAt) > new Date(localUpdatedAt))) {
          schema = remoteSchema;
          title = remoteTitle;
          shouldRemount = true;
          localStorage.setItem(`draft_schema_${currentId}`, JSON.stringify({
            schema: remoteSchema,
            title: remoteTitle,
            updated_at: remoteUpdatedAt,
          }));
        }
      } else if (localData && parsedLocal) {
        // Remote has nothing — migrate local data to Supabase
        await supabase.from("forms").upsert({
          id: currentId,
          draft_schema: { title: parsedLocal.title || "", content: parsedLocal.schema },
          created_by: user.id,
          updated_at: parsedLocal.updated_at || new Date().toISOString(),
        });
      }
    } catch {
      // Supabase fetch failed — continue with local data
    }
  }

  return { 
    formId: currentId, 
    userId, 
    schema, 
    title, 
    shouldRemount, 
    version, 
    latestPublishedSchema: user ? (version ? latestPublishedSchema : null) : null,
    latestPublishedTitle: user ? (version ? latestPublishedTitle : null) : null
  };
}

// ── Save draft ──

export async function saveDraft(
  formId: string,
  userId: string | null,
  json: any,
  title: string,
): Promise<{ ok: boolean; error?: string }> {
  const now = new Date().toISOString();

  try {
    // Always write to localStorage
    localStorage.setItem(`draft_schema_${formId}`, JSON.stringify({
      schema: json,
      title,
      updated_at: now,
    }));

    // If logged in, persist to Supabase
    if (userId) {
      const { error } = await supabase.from("forms").upsert({
        id: formId,
        draft_schema: { title, content: json },
        created_by: userId,
        updated_at: now,
      }, { onConflict: "id" });

      if (error) {
        console.error("Save draft to Supabase failed:", error);
        return { ok: false, error: error.message };
      }
    }

    return { ok: true };
  } catch (err: any) {
    console.error("Save draft failed:", err);
    return { ok: false, error: err?.message || "Unknown error" };
  }
}

// ── Publish form ──

export interface PublishResult {
  ok: boolean;
  url?: string;
  error?: string;
}

export async function publishForm(
  formId: string,
  userId: string,
  json: any,
  title: string,
): Promise<PublishResult> {
  const now = new Date().toISOString();

  try {
    // 1. Ensure the forms row exists — upsert with draft data
    const { error: upsertError } = await supabase.from("forms").upsert({
      id: formId,
      draft_schema: { title, content: json },
      created_by: userId,
      updated_at: now,
    }, { onConflict: "id" });

    if (upsertError) {
      console.error("Step 1 — forms upsert failed:", upsertError);
      return { ok: false, error: `Forms upsert: ${upsertError.message} (code: ${upsertError.code})` };
    }

    // 2. Insert a new form_version (with retry for unique constraint races)
    let versionError: any = null;
    let versionId: string | undefined = undefined;

    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: latestVersion } = await supabase
        .from("form_versions")
        .select("version")
        .eq("form_id", formId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      const newVersion = (latestVersion?.version || 0) + 1;
      const { data: insertedData, error } = await supabase.from("form_versions").insert({
        form_id: formId,
        title,
        content: json,
        version: newVersion,
        created_by: userId,
      }).select("id").maybeSingle();

      if (!error && insertedData) {
        versionError = null;
        versionId = insertedData.id;
        break;
      }

      versionError = error;
      if (error?.code !== "23505") break; // Only retry on unique constraint
    }

    if (versionError) {
      console.error("Step 2 — form_versions insert failed:", versionError);
      return { ok: false, error: `Version insert: ${versionError?.message} (code: ${versionError?.code})` };
    }

    // 3. Mark the form as published
    const { error: statusError } = await supabase.from("forms").update({
      status: "published",
      updated_at: now,
    }).eq("id", formId);

    if (statusError) {
      console.error("Step 3 — forms status update failed:", statusError);
      return { ok: false, error: `Status update: ${statusError.message} (code: ${statusError.code})` };
    }

    // 4. Update localStorage
    localStorage.setItem(`draft_schema_${formId}`, JSON.stringify({
      schema: json,
      title,
      updated_at: now,
    }));

    // If for some reason we couldn't get the form ID, fallback gracefully
    const url = formId ? `${window.location.origin}/s/${formId}` : `${window.location.origin}/s/error-no-form`;
    return { ok: true, url };
  } catch (err: any) {
    console.error("Publish failed (exception):", err);
    return { ok: false, error: err?.message || "Unknown error" };
  }
}

export interface SharingSettings {
  access_open: boolean;
  members: {
    user_id: string;
    email: string;
    name: string;
    role: "owner" | "viewer" | "submitter";
  }[];
}

export async function fetchSharingSettings(formId: string): Promise<SharingSettings> {
  // 1. Fetch access_open status from forms
  const { data: formData } = await supabase
    .from("forms")
    .select("access_open")
    .eq("id", formId)
    .single();

  const access_open = formData?.access_open ?? false;

  // 2. Fetch members of the form from form_members
  const { data: membersData } = await supabase
    .from("form_members")
    .select("user_id, role")
    .eq("form_id", formId);

  if (!membersData || membersData.length === 0) {
    return { access_open, members: [] };
  }

  const userIds = membersData.map((m) => m.user_id);
  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("id, email, name")
    .in("id", userIds);

  const emailMap = new Map<string, string>();
  const nameMap = new Map<string, string>();
  profiles?.forEach((p) => {
    if (p.email) emailMap.set(p.id, p.email);
    if (p.name) nameMap.set(p.id, p.name);
  });

  const members = membersData
    .map((m) => ({
      user_id: m.user_id,
      email: emailMap.get(m.user_id) || "",
      name: nameMap.get(m.user_id) || "",
      role: m.role as "owner" | "viewer" | "submitter",
    }))
    .filter((m) => m.email !== ""); // Filter out any members without matching profiles

  return { access_open, members };
}

export async function updateFormAccess(formId: string, accessOpen: boolean): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from("forms")
    .update({ access_open: accessOpen, updated_at: new Date().toISOString() })
    .eq("id", formId);

  if (error) {
    console.error("Failed to update form access:", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function addFormMember(
  formId: string,
  email: string,
  role: "owner" | "viewer" | "submitter" = "submitter"
): Promise<{ ok: boolean; member?: { user_id: string; email: string; name: string; role: "owner" | "viewer" | "submitter" }; error?: string }> {
  // 1. Find user in user_profiles
  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id, name, email")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();

  if (profileError) {
    return { ok: false, error: `Error searching user profile: ${profileError.message}` };
  }
  if (!profile) {
    return { ok: false, error: `User with email "${email}" has not registered with FieldTally yet.` };
  }

  // 2. Add member row
  const { error: insertError } = await supabase
    .from("form_members")
    .insert({
      form_id: formId,
      user_id: profile.id,
      role: role,
    });

  if (insertError) {
    if (insertError.code === "23505") { // Unique key constraint / Duplicate key
      return { ok: false, error: `User is already added to this form.` };
    }
    return { ok: false, error: `Failed to add member: ${insertError.message}` };
  }

  return {
    ok: true,
    member: {
      user_id: profile.id,
      email: profile.email || email.trim().toLowerCase(),
      name: profile.name || "",
      role: role,
    }
  };
}

export async function removeFormMember(formId: string, userId: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from("form_members")
    .delete()
    .eq("form_id", formId)
    .eq("user_id", userId);

  if (error) {
    return { ok: false, error: `Failed to remove member: ${error.message}` };
  }
  return { ok: true };
}

export async function updateFormMemberRole(
  formId: string,
  userId: string,
  role: "owner" | "viewer" | "submitter"
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from("form_members")
    .update({ role })
    .eq("form_id", formId)
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to update form member role:", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}


