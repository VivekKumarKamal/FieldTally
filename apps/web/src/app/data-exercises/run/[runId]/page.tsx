"use client";

import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { apiGet, apiSend } from "@/lib/apiClient";
import { claimLocalRun, finishExerciseInstance } from "@/lib/exerciseInstances";
import { extractExerciseFields, getExerciseSettings, type ExerciseField, type ChartConfig } from "@/lib/exerciseSchema";
import LiveClock from "../../_shared/LiveClock";
import EntryChart, { type ChartMode, type EntryChartHandle } from "../../_shared/EntryChart";
import FieldChart from "../../_shared/FieldChart";
import ExerciseEntryForm from "../../_shared/ExerciseEntryForm";
import { exportEntriesToExcel, exportSvgAsPng } from "../../_shared/export";

interface Entry {
  data: Record<string, any>;
  loggedAt: number;
}

interface LocalBundle {
  templateId: string;
  title: string;
  content: any;
  entries: Entry[];
  status: "live" | "finished";
  startedAt: number;
}

const EMOJIS = ["🎉", "⭐", "✨", "🙌", "🔥"];
const POLL_MS = 4000;

function localKey(runId: string) {
  return `ft_exercise_run_${runId}`;
}

function RunnerPageInner() {
  const params = useParams()!;
  const router = useRouter();
  const searchParams = useSearchParams();
  const runId = params?.runId as string;
  const isLocal = runId?.startsWith("local-");
  const claimFlag = searchParams?.get("claim") === "1";

  const [title, setTitle] = useState("");
  const [content, setContent] = useState<any>(null);
  const [fields, setFields] = useState<ExerciseField[]>([]);
  const [chartConfig, setChartConfig] = useState<ChartConfig>({});
  const [liveDuringExercise, setLiveDuringExercise] = useState(true);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [status, setStatus] = useState<"live" | "finished">("live");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartHidden, setChartHidden] = useState(false);
  const [chartMode, setChartMode] = useState<ChartMode>("cumulative");
  const [pops, setPops] = useState<{ id: string; emoji: string; offset: number }[]>([]);
  const [saving, setSaving] = useState(false);
  const chartRef = useRef<EntryChartHandle>(null);

  const loadFromContent = useCallback((docContent: any) => {
    setContent(docContent);
    setFields(extractExerciseFields(docContent));
    const settings = getExerciseSettings(docContent);
    setChartConfig(settings.chartConfig);
    setLiveDuringExercise(settings.liveDuringExercise);
  }, []);

  // Load the run.
  useEffect(() => {
    if (!runId) return;

    if (isLocal) {
      const raw = localStorage.getItem(localKey(runId));
      if (!raw) {
        setError("This exercise session was not found on this device.");
        setLoading(false);
        return;
      }
      const bundle: LocalBundle = JSON.parse(raw);
      setTitle(bundle.title);
      loadFromContent(bundle.content);
      setEntries(bundle.entries);
      setStatus(bundle.status);
      setLoading(false);
      return;
    }

    (async () => {
      const result = await apiGet<{ title: string; schema: any; access_open: boolean }>(
        `/api/forms/${runId}?status=published`,
      );
      if (!result.ok || !result.data) {
        setError(result.error || "This exercise could not be loaded.");
        setLoading(false);
        return;
      }
      setTitle(result.data.title);
      loadFromContent(result.data.schema);
      setStatus(result.data.access_open ? "live" : "finished");
      setLoading(false);
    })();
  }, [runId, isLocal, loadFromContent]);

  // Poll entries in cloud mode while live.
  useEffect(() => {
    if (isLocal || status !== "live" || loading) return;
    let cancelled = false;

    async function poll() {
      const result = await apiGet<{ submissions: { data: Record<string, any>; filled_at: string }[] }>(
        `/api/forms/${runId}/submissions?limit=500`,
      );
      if (!cancelled && result.ok && result.data) {
        setEntries(result.data.submissions.map((s) => ({ data: s.data, loggedAt: new Date(s.filled_at).getTime() })));
      }
    }

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isLocal, status, runId, loading]);

  // Auto-claim on return from a "sign in to save" redirect.
  useEffect(() => {
    if (!isLocal || !claimFlag) return;
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) handleSaveToCloud();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocal, claimFlag]);

  function persistLocalBundle(next: Partial<LocalBundle>) {
    const raw = localStorage.getItem(localKey(runId));
    if (!raw) return;
    const bundle: LocalBundle = { ...JSON.parse(raw), ...next };
    localStorage.setItem(localKey(runId), JSON.stringify(bundle));
  }

  async function handleLogEntry(data: Record<string, any>) {
    const entry: Entry = { data, loggedAt: Date.now() };

    if (isLocal) {
      setEntries((prev) => {
        const next = [...prev, entry];
        persistLocalBundle({ entries: next });
        return next;
      });
    } else {
      const result = await apiSend(`/api/forms/${runId}/submissions`, "POST", { data, form_version: 1 });
      if (!result.ok) {
        alert(result.error || "Failed to log entry.");
        return;
      }
      setEntries((prev) => [...prev, entry]);
    }

    const id = crypto.randomUUID();
    const emoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)]!;
    const offset = Math.random() * 80 - 40;
    setPops((p) => [...p, { id, emoji, offset }]);
    setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 900);
  }

  async function handleFinish() {
    setStatus("finished");
    if (isLocal) {
      persistLocalBundle({ status: "finished" });
    } else {
      const result = await finishExerciseInstance(runId);
      if (!result.ok) alert(result.error || "Failed to finish exercise.");
    }
  }

  async function handleSaveToCloud() {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      router.push(`/login?redirect=${encodeURIComponent(`/data-exercises/run/${runId}?claim=1`)}`);
      return;
    }

    setSaving(true);
    const result = await claimLocalRun(title, content, entries);
    setSaving(false);

    if ("error" in result) {
      alert(result.error);
      return;
    }

    localStorage.removeItem(localKey(runId));
    if (status === "finished") await finishExerciseInstance(result.id);
    router.replace(`/data-exercises/run/${result.id}`);
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-indigo-300 font-semibold">Loading exercise...</div>;
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-4">
        <p className="text-zinc-600">{error}</p>
        <button onClick={() => router.push("/data-exercises")} className="text-indigo-600 font-semibold underline">
          Back to Data Exercises
        </button>
      </div>
    );
  }

  const fieldChartFields = fields.filter((f) => chartConfig[f.id] && chartConfig[f.id] !== "none");
  const showTimeChart = liveDuringExercise || status === "finished";

  return (
    <div
      className="min-h-screen"
      style={{ background: "linear-gradient(135deg, #fdf2ff 0%, #eef2ff 50%, #fff7ed 100%)" }}
    >
      <div className="min-h-screen flex flex-col items-center gap-8 px-4 py-8">
        <h1 className="text-2xl font-black text-indigo-700 text-center">{title}</h1>

        {status === "live" && <LiveClock />}

        {status === "live" ? (
          fields.length === 0 ? (
            <div className="relative flex flex-col items-center gap-3">
              <button
                onClick={() => handleLogEntry({})}
                className="relative rounded-full bg-gradient-to-br from-pink-500 to-fuchsia-600 hover:scale-105 active:scale-95 transition text-white font-extrabold text-3xl px-16 py-10 shadow-2xl"
              >
                👋 Log Entry
                {pops.map((p) => (
                  <span
                    key={p.id}
                    className="absolute left-1/2 top-0 text-3xl pointer-events-none"
                    style={{ transform: `translateX(${p.offset}px)`, animation: "class-entry-pop-in 0.9s ease-out forwards" }}
                  >
                    {p.emoji}
                  </span>
                ))}
              </button>
            </div>
          ) : (
            <div className="w-full max-w-md bg-white/70 rounded-3xl shadow-lg p-6">
              <ExerciseEntryForm fields={fields} onSubmit={handleLogEntry} />
            </div>
          )
        ) : (
          <div className="text-xl font-bold text-indigo-500">🏁 Exercise Finished</div>
        )}

        <div className="text-center">
          <div key={entries.length} className="text-6xl font-black text-fuchsia-700 tabular-nums">
            {entries.length}
          </div>
          <div className="text-lg font-bold text-fuchsia-400 uppercase tracking-wide">Entries</div>
        </div>

        {showTimeChart && (
          <div className="w-full max-w-2xl bg-white/70 rounded-3xl shadow-lg p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="inline-flex rounded-full bg-indigo-100 p-1">
                {(["cumulative", "per-minute"] as ChartMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setChartMode(m)}
                    className={`px-4 py-1.5 rounded-full text-sm font-bold transition ${
                      chartMode === m ? "bg-indigo-600 text-white shadow" : "text-indigo-500"
                    }`}
                  >
                    {m === "cumulative" ? "Cumulative" : "Per Minute"}
                  </button>
                ))}
              </div>
              {status === "live" && (
                <button onClick={() => setChartHidden((h) => !h)} className="text-sm font-bold text-indigo-500 hover:text-indigo-700">
                  {chartHidden ? "👀 Reveal Chart" : "🙈 Hide Chart"}
                </button>
              )}
            </div>
            {chartHidden ? (
              <div className="h-72 flex items-center justify-center text-indigo-300 font-semibold text-lg">Chart hidden</div>
            ) : (
              <EntryChart ref={chartRef} entries={entries.map((e) => e.loggedAt)} mode={chartMode} />
            )}
          </div>
        )}

        {fieldChartFields.length > 0 && status === "finished" && (
          <div className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fieldChartFields.map((f) => (
              <FieldChart key={f.id} field={f} chartType={chartConfig[f.id]} entries={entries} />
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-4 justify-center">
          {status === "live" && (
            <button
              onClick={handleFinish}
              className="rounded-full bg-indigo-700 hover:bg-indigo-800 active:scale-95 transition text-white font-bold text-lg px-8 py-3 shadow-lg"
            >
              Finish Exercise
            </button>
          )}
          {status === "finished" && (
            <>
              <button
                onClick={() => exportEntriesToExcel(entries, fields, `${title || "exercise"}.xlsx`)}
                className="rounded-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition text-white font-bold px-6 py-3 shadow-lg"
              >
                📊 Export to Excel
              </button>
              <button
                onClick={() => {
                  const svg = chartRef.current?.getSvg();
                  if (svg) exportSvgAsPng(svg, `${title || "exercise"}-${chartMode}.png`);
                }}
                className="rounded-full bg-sky-600 hover:bg-sky-700 active:scale-95 transition text-white font-bold px-6 py-3 shadow-lg"
              >
                🖼️ Export Chart
              </button>
            </>
          )}
          {isLocal && (
            <button
              onClick={handleSaveToCloud}
              disabled={saving}
              className="rounded-full bg-zinc-900 hover:bg-zinc-800 active:scale-95 transition text-white font-bold px-6 py-3 shadow-lg disabled:opacity-50"
            >
              {saving ? "Saving..." : "☁️ Save to Cloud"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RunnerPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-indigo-300 font-semibold">Loading...</div>}>
      <RunnerPageInner />
    </Suspense>
  );
}
