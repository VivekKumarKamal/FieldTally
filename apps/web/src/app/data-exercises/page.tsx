"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { apiGet, apiSend } from "@/lib/apiClient";

interface FormRow {
  id: string;
  status: string | null;
  updated_at: string | null;
  access_open?: boolean | null;
  draft_schema: { title?: string; content?: any } | null;
  created_by?: string | null;
}

function titleOf(row: FormRow) {
  return row.draft_schema?.title || "Untitled";
}

function startLocalRun(templateId: string, title: string, content: any): string {
  const runId = `local-${crypto.randomUUID()}`;
  localStorage.setItem(
    `ft_exercise_run_${runId}`,
    JSON.stringify({ templateId, title, content, entries: [], status: "live", startedAt: Date.now() }),
  );
  return runId;
}

export default function DataExercisesDashboard() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [templates, setTemplates] = useState<FormRow[]>([]);
  const [myExercises, setMyExercises] = useState<FormRow[]>([]);
  const [myTemplates, setMyTemplates] = useState<FormRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [startingId, setStartingId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
      setCheckedAuth(true);
    });
  }, []);

  useEffect(() => {
    if (!checkedAuth) return;
    (async () => {
      const templatesResult = await apiGet<{ forms: FormRow[] }>("/api/forms?scope=public_templates&limit=50");
      if (templatesResult.ok) setTemplates(templatesResult.data?.forms ?? []);

      if (userId) {
        const [exercisesResult, myTemplatesResult] = await Promise.all([
          apiGet<{ forms: FormRow[] }>("/api/forms?scope=owned&kind=exercise&limit=50"),
          apiGet<{ forms: FormRow[] }>("/api/forms?scope=owned&kind=exercise_template&limit=50"),
        ]);
        if (exercisesResult.ok) setMyExercises(exercisesResult.data?.forms ?? []);
        if (myTemplatesResult.ok) setMyTemplates(myTemplatesResult.data?.forms ?? []);
      }
      setLoading(false);
    })();
  }, [checkedAuth, userId]);

  async function handleUseTemplate(template: FormRow) {
    setStartingId(template.id);
    try {
      const result = await apiGet<{ schema: any }>(`/api/forms/${template.id}?status=published`);
      if (!result.ok || !result.data) {
        alert(result.error || "Could not load this template.");
        return;
      }
      const runId = startLocalRun(template.id, titleOf(template), result.data.schema);
      router.push(`/data-exercises/run/${runId}`);
    } finally {
      setStartingId(null);
    }
  }

  async function handleCreateTemplate() {
    if (!userId) {
      router.push(`/login?redirect=${encodeURIComponent("/data-exercises")}`);
      return;
    }
    setCreating(true);
    try {
      const id = crypto.randomUUID();
      const result = await apiSend("/api/forms", "POST", {
        id,
        draft_schema: { title: "", content: { type: "doc", content: [] } },
        kind: "exercise_template",
        access_open: true,
      });
      if (!result.ok) {
        alert(result.error || "Could not create a new template.");
        return;
      }
      router.push(`/create-form?form=${id}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900">Data Exercises</h1>
            <p className="text-zinc-500 mt-1">Run a live classroom exercise, or build your own.</p>
          </div>
          <button
            onClick={handleCreateTemplate}
            disabled={creating}
            className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            {creating ? "Creating..." : "+ Create New Template"}
          </button>
        </div>

        {!userId && checkedAuth && (
          <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
            You can run any exercise below without signing in.{" "}
            <Link href={`/login?redirect=${encodeURIComponent("/data-exercises")}`} className="font-semibold underline">
              Sign in
            </Link>{" "}
            to create your own templates or save collected data to the cloud.
          </div>
        )}

        {userId && myExercises.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-semibold text-zinc-800 mb-3">Your Exercises</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {myExercises.map((ex) => (
                <Link
                  key={ex.id}
                  href={`/data-exercises/run/${ex.id}`}
                  className="p-4 bg-white border border-zinc-200 rounded-xl hover:shadow-md transition-shadow"
                >
                  <div className="font-semibold text-zinc-800">{titleOf(ex)}</div>
                  <span
                    className={`inline-block mt-2 text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                      ex.access_open ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500"
                    }`}
                  >
                    {ex.access_open ? "Live" : "Finished"}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {userId && myTemplates.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-semibold text-zinc-800 mb-3">Templates You Made</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {myTemplates.map((t) => (
                <div key={t.id} className="p-4 bg-white border border-zinc-200 rounded-xl">
                  <div className="font-semibold text-zinc-800">{titleOf(t)}</div>
                  <div className="flex gap-3 mt-3 text-sm font-semibold">
                    <button onClick={() => handleUseTemplate(t)} className="text-indigo-600 hover:text-indigo-800">
                      Use
                    </button>
                    <Link href={`/create-form?form=${t.id}`} className="text-zinc-500 hover:text-zinc-700">
                      Edit
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-lg font-semibold text-zinc-800 mb-3">Templates</h2>
          {loading ? (
            <div className="text-zinc-400">Loading templates...</div>
          ) : templates.length === 0 ? (
            <div className="text-zinc-400">No templates yet — create the first one!</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {templates.map((t) => (
                <div key={t.id} className="p-5 bg-white border border-zinc-200 rounded-xl flex flex-col">
                  <div className="font-semibold text-zinc-800 mb-1">{titleOf(t)}</div>
                  <div className="text-xs text-zinc-400 mb-4">{t.created_by ? "Community template" : "Built-in"}</div>
                  <button
                    onClick={() => handleUseTemplate(t)}
                    disabled={startingId === t.id}
                    className="mt-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                  >
                    {startingId === t.id ? "Starting..." : "Use Template"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
