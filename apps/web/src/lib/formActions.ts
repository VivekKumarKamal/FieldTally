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
 * Returns the resolved data. Does NOT set any React state.
 */
export async function loadForm(initialContent: any): Promise<LoadFormResult> {
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id || null;

  let currentId = localStorage.getItem("current_draft_form_id");
  if (!currentId) {
    currentId = crypto.randomUUID();
    localStorage.setItem("current_draft_form_id", currentId);
    return { formId: currentId, userId, schema: initialContent, title: "", shouldRemount: false };
  }

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
