import { supabase } from "./supabase";
import { apiGet, apiSend } from "./apiClient";

/**
 * Form read/write actions used by the editor.
 *
 * Everything that changes server state goes through `/api/*` so permissions are
 * enforced somewhere the user cannot edit. localStorage is still written on every
 * save so an offline or signed-out user keeps working, but it is a cache — the
 * server row is the source of truth.
 */

// ── Types ──

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface StoredDraft {
  schema: any;
  title: string;
  updated_at: string | null;
}

/**
 * Last `updated_at` we know the server had, per form.
 *
 * Sent back on save so the server can reject a write that would silently
 * overwrite a change made in another tab or by a collaborator.
 */
const knownServerVersion = new Map<string, string | null>();

export function getKnownServerVersion(formId: string): string | null {
  return knownServerVersion.get(formId) ?? null;
}

/**
 * One in-flight save per form, chained rather than parallel.
 *
 * The editor has several independent autosave triggers — a title debounce, a
 * content debounce, the manual save button, template/AI apply — with no
 * coordination between them. Two firing within the same second used to both
 * read `knownServerVersion` before either write landed, so both sent the same
 * stale `expected_updated_at`; the first save then made the second look like it
 * was overwriting someone else's change and it was rejected as a conflict, even
 * though both were this tab a second apart. Chaining every save for a form
 * behind the previous one guarantees each reads the version the one before it
 * actually produced.
 */
const saveQueue = new Map<string, Promise<unknown>>();

function enqueueSave<T>(formId: string, run: () => Promise<T>): Promise<T> {
  const prior = saveQueue.get(formId) ?? Promise.resolve();
  const started = prior.then(run, run);
  // A failed save must not wedge the queue for every save after it.
  saveQueue.set(formId, started.catch(() => {}));
  return started;
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

function writeLocalDraft(formId: string, schema: any, title: string, updatedAt: string) {
  try {
    localStorage.setItem(
      `draft_schema_${formId}`,
      JSON.stringify({ schema, title, updated_at: updatedAt })
    );
  } catch (err) {
    // Quota exceeded or storage disabled — the server copy still holds.
    console.warn("Could not cache draft locally:", err);
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
 * Load the form draft from localStorage + the server.
 * If formIdParam is provided (from URL query), use it directly.
 * Otherwise start a new local draft.
 */
export async function loadForm(initialContent: any, formIdParam?: string | null): Promise<LoadFormResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
  let latestPublishedSchema: any = null;
  let latestPublishedTitle: string | null = null;

  if (!user) {
    return { formId: currentId, userId, schema, title, shouldRemount, version, latestPublishedSchema: null, latestPublishedTitle: null };
  }

  try {
    const [draftResult, publishedResult] = await Promise.all([
      apiGet<{ schema: any; title: string; updated_at: string | null }>(`/api/forms/${currentId}?status=draft`),
      apiGet<{ schema: any; title: string; version: number }>(`/api/forms/${currentId}?status=published`),
    ]);

    if (publishedResult.ok && publishedResult.data) {
      version = publishedResult.data.version ?? null;
      latestPublishedSchema = publishedResult.data.schema ?? null;
      latestPublishedTitle = publishedResult.data.title ?? null;
    }

    if (draftResult.ok && draftResult.data) {
      const remoteUpdatedAt = draftResult.data.updated_at ?? null;
      knownServerVersion.set(currentId, remoteUpdatedAt);

      const remoteSchema = draftResult.data.schema;
      const remoteTitle = draftResult.data.title || "";
      const localUpdatedAt = parsedLocal?.updated_at || null;

      // Prefer the server copy unless the local cache is provably newer.
      if (remoteSchema && (!localUpdatedAt || (remoteUpdatedAt && new Date(remoteUpdatedAt) > new Date(localUpdatedAt)))) {
        schema = remoteSchema;
        title = remoteTitle;
        shouldRemount = true;
        writeLocalDraft(currentId, remoteSchema, remoteTitle, remoteUpdatedAt || new Date().toISOString());
      }
    } else if (draftResult.status === 404 && parsedLocal) {
      // Nothing on the server yet — adopt the local draft into the account.
      const created = await apiSend<{ updated_at?: string }>("/api/forms", "POST", {
        id: currentId,
        draft_schema: { title: parsedLocal.title || "", content: parsedLocal.schema },
      });
      if (created.ok) {
        knownServerVersion.set(currentId, created.data?.updated_at ?? null);
      }
    }
  } catch (err) {
    // Offline or server unreachable — carry on with the local copy.
    console.warn("Could not sync form from server:", err);
  }

  return {
    formId: currentId,
    userId,
    schema,
    title,
    shouldRemount,
    version,
    latestPublishedSchema,
    latestPublishedTitle,
  };
}

// ── Save draft ──

export async function saveDraft(
  formId: string,
  userId: string | null,
  json: any,
  title: string
): Promise<{ ok: boolean; error?: string; conflict?: boolean }> {
  return enqueueSave(formId, () => performSaveDraft(formId, userId, json, title));
}

async function performSaveDraft(
  formId: string,
  userId: string | null,
  json: any,
  title: string
): Promise<{ ok: boolean; error?: string; conflict?: boolean }> {
  const now = new Date().toISOString();

  try {
    // Always cache locally so an interrupted session is recoverable.
    writeLocalDraft(formId, json, title, now);

    if (!userId) return { ok: true };

    const draft_schema = { title, content: json };
    const expected = knownServerVersion.get(formId) ?? null;

    let result = await apiSend<{ updated_at: string }>(`/api/forms/${formId}`, "PATCH", {
      draft_schema,
      expected_updated_at: expected,
    });

    // The row does not exist yet — create it, then retry the save once.
    if (!result.ok && result.status === 404) {
      const created = await apiSend("/api/forms", "POST", { id: formId, draft_schema });
      if (!created.ok) return { ok: false, error: created.error };

      result = await apiSend<{ updated_at: string }>(`/api/forms/${formId}`, "PATCH", { draft_schema });
    }

    if (!result.ok) {
      if (result.status === 409) {
        return {
          ok: false,
          conflict: true,
          error: result.error || "This form was changed elsewhere. Reload before saving again.",
        };
      }
      return { ok: false, error: result.error };
    }

    const serverUpdatedAt = result.data?.updated_at ?? null;
    knownServerVersion.set(formId, serverUpdatedAt);
    if (serverUpdatedAt) writeLocalDraft(formId, json, title, serverUpdatedAt);

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
  title: string
): Promise<PublishResult> {
  try {
    const publish = async () =>
      apiSend<{ version: number; updated_at: string }>(`/api/forms/${formId}/publish`, "POST", {
        title,
        content: json,
      });

    let result = await publish();

    // First publish of a draft that only ever lived locally.
    if (!result.ok && result.status === 404) {
      const created = await apiSend("/api/forms", "POST", {
        id: formId,
        draft_schema: { title, content: json },
      });
      if (!created.ok) return { ok: false, error: created.error };
      result = await publish();
    }

    if (!result.ok) return { ok: false, error: result.error };

    const updatedAt = result.data?.updated_at ?? new Date().toISOString();
    knownServerVersion.set(formId, updatedAt);
    writeLocalDraft(formId, json, title, updatedAt);

    return { ok: true, url: `${window.location.origin}/s/${formId}` };
  } catch (err: any) {
    console.error("Publish failed (exception):", err);
    return { ok: false, error: err?.message || "Unknown error" };
  }
}

// ── Sharing ──

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
  const result = await apiGet<SharingSettings>(`/api/forms/${formId}/members`);

  // Non-owners have no sharing panel to populate; an empty result is the correct
  // answer for them, not an error to surface.
  if (!result.ok || !result.data) return { access_open: false, members: [] };

  return {
    access_open: result.data.access_open ?? false,
    members: result.data.members ?? [],
  };
}

export async function updateFormAccess(formId: string, accessOpen: boolean): Promise<{ ok: boolean; error?: string }> {
  const result = await apiSend<{ updated_at: string }>(`/api/forms/${formId}`, "PATCH", {
    access_open: accessOpen,
  });

  if (!result.ok) return { ok: false, error: result.error };

  // This write bumps the row's updated_at too. Record it, or the next draft save
  // would send a now-stale expected_updated_at and be rejected as a conflict.
  if (result.data?.updated_at) knownServerVersion.set(formId, result.data.updated_at);

  return { ok: true };
}

export async function addFormMember(
  formId: string,
  email: string,
  role: "owner" | "viewer" | "submitter" = "submitter"
): Promise<{
  ok: boolean;
  member?: { user_id: string; email: string; name: string; role: "owner" | "viewer" | "submitter" };
  error?: string;
}> {
  const result = await apiSend<{ member: any }>(`/api/forms/${formId}/members`, "POST", {
    email: email.trim().toLowerCase(),
    role,
  });

  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, member: result.data?.member };
}

export async function removeFormMember(formId: string, userId: string): Promise<{ ok: boolean; error?: string }> {
  const result = await apiSend(`/api/forms/${formId}/members`, "DELETE", { user_id: userId });
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export async function updateFormMemberRole(
  formId: string,
  userId: string,
  role: "owner" | "viewer" | "submitter"
): Promise<{ ok: boolean; error?: string }> {
  const result = await apiSend(`/api/forms/${formId}/members`, "PATCH", { user_id: userId, role });
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

// ── Delete ──

export async function deleteForm(formId: string): Promise<{ ok: boolean; error?: string }> {
  const result = await apiSend(`/api/forms/${formId}`, "DELETE");
  if (!result.ok) return { ok: false, error: result.error };

  try {
    localStorage.removeItem(`draft_schema_${formId}`);
    if (localStorage.getItem("current_draft_form_id") === formId) {
      localStorage.removeItem("current_draft_form_id");
    }
  } catch {
    // Storage unavailable — nothing to clean up.
  }

  knownServerVersion.delete(formId);
  return { ok: true };
}
