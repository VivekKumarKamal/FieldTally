import { apiSend } from "./apiClient";
import { getClonedTemplateSchema } from "./templates";

export interface LocalEntry {
  data: Record<string, any>;
  loggedAt: number;
}

/** Clones a template's doc into a new, owned exercise instance and publishes it immediately so it can accept entries right away. */
export async function createExerciseInstance(title: string, content: any): Promise<{ id: string } | { error: string }> {
  const newId = crypto.randomUUID();
  const clonedContent = getClonedTemplateSchema(content);

  const createResult = await apiSend("/api/forms", "POST", {
    id: newId,
    draft_schema: { title, content: clonedContent },
    kind: "exercise",
    access_open: true,
  });
  if (!createResult.ok) return { error: createResult.error || "Failed to create exercise" };

  const publishResult = await apiSend(`/api/forms/${newId}/publish`, "POST", { title, content: clonedContent });
  if (!publishResult.ok) return { error: publishResult.error || "Failed to start exercise" };

  return { id: newId };
}

/**
 * Uploads a fully local run (template doc + already-logged entries) to the
 * cloud in one shot, for the "sign in to save your data" flow.
 *
 * ponytail: entries upload one request at a time — fine at classroom scale
 * (tens of entries). Add a bulk-insert endpoint if this needs to scale up.
 */
export async function claimLocalRun(title: string, content: any, entries: LocalEntry[]): Promise<{ id: string } | { error: string }> {
  const created = await createExerciseInstance(title, content);
  if ("error" in created) return created;

  for (const entry of entries) {
    const result = await apiSend(`/api/forms/${created.id}/submissions`, "POST", {
      data: entry.data,
      form_version: 1,
    });
    if (!result.ok) console.error("Failed to upload entry:", result.error);
  }

  return created;
}

/** "Finish Exercise" — stops accepting new entries. Owner-only, enforced server-side. */
export async function finishExerciseInstance(id: string) {
  return apiSend(`/api/forms/${id}`, "PATCH", { access_open: false });
}
