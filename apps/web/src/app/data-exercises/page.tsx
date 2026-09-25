"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { apiGet, apiSend } from "@/lib/apiClient";
import { extractExerciseFields, getExerciseSettings } from "@/lib/exerciseSchema";

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

function descriptionOf(row: FormRow): string {
  const para = (row.draft_schema?.content?.content ?? []).find((n: any) => n.type === "paragraph");
  return (para?.content ?? []).map((n: any) => n.text || "").join("").trim();
}

function relativeTime(iso: string | null) {
  if (!iso) return "—";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString([], { day: "numeric", month: "short" });
}

function startLocalRun(templateId: string, title: string, content: any): string {
  const runId = `local-${crypto.randomUUID()}`;
  localStorage.setItem(
    `ft_exercise_run_${runId}`,
    JSON.stringify({ templateId, title, content, entries: [], status: "live", startedAt: Date.now() }),
  );
  return runId;
}

function TemplateCard({
  row,
  index,
  starting,
  onRun,
}: {
  row: FormRow;
  index: number;
  starting: boolean;
  onRun: () => void;
}) {
  const content = row.draft_schema?.content;
  const fieldCount = extractExerciseFields(content).length;
  const { liveDuringExercise } = getExerciseSettings(content);
  const description = descriptionOf(row);

  return (
    <article className="group flex flex-col rounded-xl border border-[#DDD8CC] bg-white p-5 transition-colors hover:border-[#16140F]">
      <div className="flex items-center justify-between text-xs">
        <span className="font-mono text-[#6B665C]">{String(index + 1).padStart(2, "0")}</span>
        <span className="uppercase tracking-[0.14em] text-[#6B665C]">{row.created_by ? "Community" : "Built-in"}</span>
      </div>

      <h3 className="mt-6 text-lg font-semibold leading-snug">{titleOf(row)}</h3>
      <p className="mt-1.5 text-sm text-[#6B665C] line-clamp-2 min-h-[2.5rem]">
        {description || "No description."}
      </p>

      <dl className="mt-5 flex gap-5 text-xs">
        <div>
          <dt className="text-[#6B665C]">Input</dt>
          <dd className="mt-0.5 font-medium">{fieldCount === 0 ? "One tap" : `${fieldCount} question${fieldCount === 1 ? "" : "s"}`}</dd>
        </div>
        <div>
          <dt className="text-[#6B665C]">Chart</dt>
          <dd className="mt-0.5 font-medium">{liveDuringExercise ? "Live" : "After finish"}</dd>
        </div>
      </dl>

      <button
        onClick={onRun}
        disabled={starting}
        className="mt-6 w-full flex items-center justify-between rounded-lg border border-[#16140F] px-4 py-2.5 text-sm font-medium transition-colors group-hover:bg-[#16140F] group-hover:text-white disabled:opacity-50"
      >
        <span>{starting ? "Starting…" : "Run exercise"}</span>
        <span aria-hidden>→</span>
      </button>
    </article>
  );
}

function SectionHeading({ title, count, children }: { title: string; count?: number; children?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-[#16140F] pb-2 mb-5">
      <h2 className="text-sm font-semibold uppercase tracking-[0.14em]">
        {title}
        {count !== undefined && <span className="ml-2 font-mono font-normal text-[#6B665C]">{count}</span>}
      </h2>
      {children}
    </div>
  );
}

export default function DataExercisesDashboard() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [templates, setTemplates] = useState<FormRow[]>([]);
  const [myExercises, setMyExercises] = useState<FormRow[]>([]);
  const [myTemplates, setMyTemplates] = useState<FormRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
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
      else setLoadError(true);

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

  const signInHref = `/login?redirect=${encodeURIComponent("/data-exercises")}`;

  return (
    <div className="min-h-dvh bg-[#F5F3EE] text-[#16140F]" style={{ fontFamily: "var(--font-geist-sans)" }}>
      <nav className="border-b border-[#DDD8CC]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-[#16140F] text-white text-[10px] font-bold flex items-center justify-center">FT</span>
            <span className="font-semibold text-sm">FieldTally</span>
          </Link>
          {checkedAuth &&
            (userId ? (
              <Link href="/dashboard" className="text-sm text-[#6B665C] hover:text-[#16140F] transition-colors">
                Forms dashboard
              </Link>
            ) : (
              <Link href={signInHref} className="text-sm font-medium hover:underline underline-offset-4">
                Sign in
              </Link>
            ))}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-14">
          <div className="max-w-2xl">
            <div className="text-xs uppercase tracking-[0.14em] text-[#FF5B1F] font-semibold mb-3">Data Exercises</div>
            <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05]">
              Collect it live.
              <br />
              <span className="text-[#6B665C]">Chart it in front of the room.</span>
            </h1>
            <p className="mt-4 text-[#6B665C]">
              Pick an exercise, log answers as they happen, and reveal the chart when the class is ready.
              {!userId && checkedAuth && (
                <>
                  {" "}No account needed.{" "}
                  <Link href={signInHref} className="text-[#16140F] underline underline-offset-4">
                    Sign in
                  </Link>{" "}
                  to save results or build your own.
                </>
              )}
            </p>
          </div>
          <button
            onClick={handleCreateTemplate}
            disabled={creating}
            className="shrink-0 self-start sm:self-auto px-5 py-3 rounded-lg bg-[#16140F] text-white text-sm font-medium hover:bg-black transition-colors disabled:opacity-50"
          >
            {creating ? "Creating…" : "+ New template"}
          </button>
        </header>

        <section className="mb-16">
          <SectionHeading title="Templates" count={loading ? undefined : templates.length} />
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-64 rounded-xl border border-[#DDD8CC] bg-white/60 animate-pulse" />
              ))}
            </div>
          ) : loadError ? (
            <p className="text-sm text-[#6B665C]">Templates couldn&apos;t be loaded. Refresh to try again.</p>
          ) : templates.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#DDD8CC] p-10 text-center">
              <p className="font-medium">No templates yet</p>
              <p className="text-sm text-[#6B665C] mt-1">Create the first one and it&apos;ll show up here for everyone.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((t, i) => (
                <TemplateCard key={t.id} row={t} index={i} starting={startingId === t.id} onRun={() => handleUseTemplate(t)} />
              ))}
            </div>
          )}
        </section>

        {userId && (
          <section className="mb-16">
            <SectionHeading title="Your runs" count={myExercises.length} />
            {myExercises.length === 0 ? (
              <p className="text-sm text-[#6B665C]">Runs you save to the cloud appear here.</p>
            ) : (
              <ul className="divide-y divide-[#DDD8CC] border-b border-[#DDD8CC]">
                {myExercises.map((ex) => (
                  <li key={ex.id}>
                    <Link
                      href={`/data-exercises/run/${ex.id}`}
                      className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_8rem_7rem_2rem] items-center gap-4 py-3.5 px-1 hover:bg-white/60 transition-colors"
                    >
                      <span className="font-medium truncate">{titleOf(ex)}</span>
                      <span className="inline-flex items-center gap-2 text-sm">
                        <span className={`w-1.5 h-1.5 rounded-full ${ex.access_open ? "bg-[#1F9D55]" : "bg-[#6B665C]"}`} />
                        {ex.access_open ? "Live" : "Finished"}
                      </span>
                      <span className="hidden sm:block text-sm text-[#6B665C] font-mono">{relativeTime(ex.updated_at)}</span>
                      <span className="hidden sm:block text-right text-[#6B665C]" aria-hidden>→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {userId && myTemplates.length > 0 && (
          <section>
            <SectionHeading title="Your templates" count={myTemplates.length} />
            <ul className="divide-y divide-[#DDD8CC] border-b border-[#DDD8CC]">
              {myTemplates.map((t) => {
                const published = t.status === "published";
                return (
                  <li key={t.id} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_8rem_7rem_auto] items-center gap-4 py-3.5 px-1">
                    <span className="font-medium truncate">{titleOf(t)}</span>
                    <span className="text-sm text-[#6B665C]">{published ? "Published" : "Draft"}</span>
                    <span className="hidden sm:block text-sm text-[#6B665C] font-mono">{relativeTime(t.updated_at)}</span>
                    <span className="col-span-2 sm:col-span-1 flex gap-4 text-sm font-medium">
                      {published && (
                        <button onClick={() => handleUseTemplate(t)} className="hover:underline underline-offset-4">
                          Run
                        </button>
                      )}
                      <Link href={`/create-form?form=${t.id}`} className="text-[#6B665C] hover:text-[#16140F] hover:underline underline-offset-4">
                        Edit
                      </Link>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
