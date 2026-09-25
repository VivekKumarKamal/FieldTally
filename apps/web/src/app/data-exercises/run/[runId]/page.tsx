"use client";

import { useEffect, useRef, useState, useCallback, useMemo, Suspense } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { apiGet, apiSend } from "@/lib/apiClient";
import { claimLocalRun, finishExerciseInstance } from "@/lib/exerciseInstances";
import { extractExerciseFields, getExerciseSettings, type ExerciseField, type ChartConfig } from "@/lib/exerciseSchema";
import EntryChart, { type ChartMode } from "../../_shared/EntryChart";
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

const POLL_MS = 4000;

function localKey(runId: string) {
  return `ft_exercise_run_${runId}`;
}

const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!now) return null;
  return (
    <div className="flex items-baseline gap-3">
      <span className="hidden sm:inline text-xs uppercase tracking-[0.14em] text-[#6B665C]">
        {now.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}
      </span>
      <span className="font-mono text-lg sm:text-xl font-medium tabular-nums">
        {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-[0.14em] text-[#6B665C]">{label}</div>
      <div className="font-mono text-base sm:text-lg tabular-nums truncate">{value}</div>
    </div>
  );
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
  const [activeTab, setActiveTab] = useState<string>("time");
  const [pops, setPops] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

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

  // Poll entries in cloud mode. Once more after finishing, so the final chart is complete.
  useEffect(() => {
    if (isLocal || loading) return;
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
    if (status !== "live") return () => { cancelled = true; };
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
    setPops((p) => [...p, id]);
    setTimeout(() => setPops((p) => p.filter((x) => x !== id)), 900);
  }

  // Space logs an entry on one-tap exercises, so a facilitator at a laptop never has to aim.
  const oneTap = status === "live" && fields.length === 0 && !loading && !error;
  const logRef = useRef(handleLogEntry);
  logRef.current = handleLogEntry;
  useEffect(() => {
    if (!oneTap) return;
    function onKey(e: KeyboardEvent) {
      if (e.code !== "Space" || e.repeat) return;
      // A focused button already turns Space into a click; don't double-log.
      if (e.target instanceof Element && e.target.closest("input, textarea, select, button")) return;
      e.preventDefault();
      logRef.current({});
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [oneTap]);

  async function handleFinish() {
    if (!confirm("Finish the exercise? No more entries can be logged after this.")) return;
    setStatus("finished");
    setChartHidden(false);
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

  const timestamps = useMemo(() => entries.map((e) => e.loggedAt).sort((a, b) => a - b), [entries]);

  if (loading) {
    return (
      <div className="h-dvh flex items-center justify-center bg-[#F5F3EE] text-sm text-[#6B665C]">Loading exercise…</div>
    );
  }

  if (error) {
    return (
      <div className="h-dvh flex flex-col items-center justify-center gap-4 text-center px-4 bg-[#F5F3EE] text-[#16140F]">
        <p>{error}</p>
        <Link href="/data-exercises" className="text-sm font-medium underline underline-offset-4">
          Back to Data Exercises
        </Link>
      </div>
    );
  }

  const count = entries.length;
  const first = timestamps[0];
  const last = timestamps[timestamps.length - 1];
  const spanMin = first && last ? Math.max(1, (last - first) / 60_000) : 0;
  const perMin = count > 1 ? (count / spanMin).toFixed(1) : "—";

  const fieldTabs = fields.filter((f) => chartConfig[f.id] && chartConfig[f.id] !== "none");
  const chartsAllowed = liveDuringExercise || status === "finished";
  const activeField = fieldTabs.find((f) => f.id === activeTab);

  return (
    <div
      className="h-dvh flex flex-col overflow-hidden bg-[#F5F3EE] text-[#16140F]"
      style={{ fontFamily: "var(--font-geist-sans)" }}
    >
      {/* Top bar */}
      <header className="shrink-0 h-14 px-4 sm:px-6 flex items-center gap-3 sm:gap-4 border-b border-[#DDD8CC]">
        <Link
          href="/data-exercises"
          className="text-sm text-[#6B665C] hover:text-[#16140F] transition-colors whitespace-nowrap"
        >
          ← Exercises
        </Link>
        <span className="h-5 w-px bg-[#DDD8CC]" aria-hidden />
        <h1 className="font-semibold truncate">{title}</h1>
        {status === "live" ? (
          <span className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#1F9D55]">
            <span className="relative flex w-2 h-2">
              <span className="absolute inset-0 rounded-full bg-[#1F9D55] animate-ping opacity-60" />
              <span className="relative w-2 h-2 rounded-full bg-[#1F9D55]" />
            </span>
            Live
          </span>
        ) : (
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6B665C]">Finished</span>
        )}
        <div className="ml-auto">
          <Clock />
        </div>
      </header>

      <main className="flex-1 min-h-0 grid grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] lg:grid-rows-1 lg:grid-cols-[minmax(340px,5fr)_minmax(0,7fr)]">
        {/* Left: count + action */}
        <section className="min-h-0 flex flex-col gap-5 p-4 sm:p-6 lg:p-10 border-b lg:border-b-0 lg:border-r border-[#DDD8CC] max-h-[48dvh] lg:max-h-none overflow-y-auto">
          <div>
            <div className="text-xs uppercase tracking-[0.14em] text-[#6B665C]">Entries logged</div>
            <div
              key={count}
              className={`font-mono font-semibold tabular-nums leading-[0.85] tracking-tight ${
                oneTap || status === "finished" ? "text-[clamp(4.5rem,22vh,15rem)]" : "text-[clamp(3.5rem,11vh,7rem)]"
              }`}
              style={count > 0 ? { animation: "de-count-tick 280ms ease-out" } : undefined}
            >
              {count}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-[#DDD8CC]">
            <Stat label="First" value={first ? fmtTime(first) : "—"} />
            <Stat label="Latest" value={last ? fmtTime(last) : "—"} />
            <Stat label="Per min" value={perMin} />
          </div>

          <div className="mt-auto">
            {status === "live" && fields.length === 0 && (
              <div className="relative">
                <button
                  onClick={() => handleLogEntry({})}
                  className="w-full rounded-xl bg-[#FF5B1F] text-[#16140F] border-2 border-[#16140F] shadow-[0_8px_0_#16140F] active:translate-y-[8px] active:shadow-none transition-[transform,box-shadow] duration-75 h-[clamp(5.5rem,20vh,11rem)] flex flex-col items-center justify-center gap-1 select-none"
                >
                  <span className="text-[clamp(1.75rem,5vh,3rem)] font-bold tracking-tight leading-none">Log entry</span>
                  <span className="hidden sm:block text-xs font-medium uppercase tracking-[0.14em] opacity-70">
                    tap or press space
                  </span>
                </button>
                {pops.map((id) => (
                  <span
                    key={id}
                    className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 font-mono font-bold text-2xl text-[#FF5B1F]"
                    style={{ animation: "class-entry-pop-in 0.9s ease-out forwards" }}
                    aria-hidden
                  >
                    +1
                  </span>
                ))}
              </div>
            )}

            {status === "live" && fields.length > 0 && (
              <ExerciseEntryForm fields={fields} onSubmit={handleLogEntry} />
            )}

            {status === "finished" && (
              <div className="rounded-xl border border-[#DDD8CC] bg-white p-5">
                <div className="text-sm font-semibold">Exercise finished</div>
                <p className="text-sm text-[#6B665C] mt-1">
                  {count} {count === 1 ? "entry" : "entries"}
                  {first && last ? ` over ${Math.round(spanMin)} min` : ""}. Export the data or run it again from the
                  exercises page.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Right: charts */}
        <section className="min-h-0 flex flex-col gap-3 p-4 sm:p-6 lg:p-10">
          <div className="shrink-0 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1 overflow-x-auto" role="tablist">
              {[{ id: "time", label: "Over time" }, ...fieldTabs.map((f) => ({ id: f.id, label: f.label }))].map((tab) => (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors max-w-[14rem] truncate ${
                    activeTab === tab.id ? "bg-[#16140F] text-white" : "text-[#6B665C] hover:text-[#16140F]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="ml-auto flex items-center gap-3">
              {activeTab === "time" && (
                <div className="inline-flex rounded-md border border-[#DDD8CC] bg-white p-0.5 text-xs">
                  {(["cumulative", "per-minute"] as ChartMode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setChartMode(m)}
                      className={`px-2.5 py-1 rounded-[5px] transition-colors ${
                        chartMode === m ? "bg-[#F5F3EE] text-[#16140F] font-medium" : "text-[#6B665C]"
                      }`}
                    >
                      {m === "cumulative" ? "Total" : "Per minute"}
                    </button>
                  ))}
                </div>
              )}
              {status === "live" && chartsAllowed && (
                <button
                  onClick={() => setChartHidden((h) => !h)}
                  className="text-xs font-medium text-[#6B665C] hover:text-[#16140F] underline underline-offset-4"
                >
                  {chartHidden ? "Show chart" : "Hide chart"}
                </button>
              )}
            </div>
          </div>

          <div ref={panelRef} className="flex-1 min-h-0 rounded-xl border border-[#DDD8CC] bg-white p-3 sm:p-5">
            {!chartsAllowed ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-2 px-6">
                <div className="text-lg font-semibold">Results unlock when the exercise ends</div>
                <p className="text-sm text-[#6B665C] max-w-sm">
                  This template keeps the chart hidden while people are still answering.
                </p>
              </div>
            ) : chartHidden ? (
              <div className="h-full flex flex-col items-center justify-center gap-5 text-center">
                <div className="text-sm uppercase tracking-[0.14em] text-[#6B665C]">Chart hidden</div>
                <button
                  onClick={() => setChartHidden(false)}
                  className="px-6 py-3 rounded-lg bg-[#16140F] text-white font-semibold hover:bg-black transition-colors"
                >
                  Reveal the chart
                </button>
              </div>
            ) : activeField ? (
              <FieldChart field={activeField} chartType={chartConfig[activeField.id]!} entries={entries} />
            ) : (
              <EntryChart entries={timestamps} mode={chartMode} />
            )}
          </div>
        </section>
      </main>

      {/* Bottom bar */}
      <footer className="shrink-0 min-h-14 px-4 sm:px-6 py-2 flex items-center gap-2 sm:gap-3 flex-wrap border-t border-[#DDD8CC]">
        {status === "live" ? (
          <button
            onClick={handleFinish}
            className="px-4 py-2 rounded-lg border border-[#16140F] text-sm font-medium hover:bg-[#16140F] hover:text-white transition-colors"
          >
            Finish exercise
          </button>
        ) : (
          <>
            <button
              onClick={() => exportEntriesToExcel(entries, fields, `${title || "exercise"}.xlsx`)}
              className="px-4 py-2 rounded-lg bg-[#16140F] text-white text-sm font-medium hover:bg-black transition-colors"
            >
              Download Excel
            </button>
            <button
              onClick={() => {
                const svg = panelRef.current?.querySelector<SVGSVGElement>("svg.recharts-surface");
                if (svg) exportSvgAsPng(svg, `${title || "exercise"}-chart.png`);
              }}
              className="px-4 py-2 rounded-lg border border-[#16140F] text-sm font-medium hover:bg-[#16140F] hover:text-white transition-colors"
            >
              Download chart
            </button>
          </>
        )}

        <div className="ml-auto flex items-center gap-3">
          {isLocal ? (
            <>
              <span className="hidden md:inline text-xs text-[#6B665C]">Only saved on this device</span>
              <button
                onClick={handleSaveToCloud}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-white border border-[#DDD8CC] text-sm font-medium hover:border-[#16140F] transition-colors disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save to cloud"}
              </button>
            </>
          ) : (
            <span className="text-xs text-[#6B665C]">Saved to your account</span>
          )}
        </div>
      </footer>
    </div>
  );
}

export default function RunnerPage() {
  return (
    <Suspense fallback={<div className="h-dvh bg-[#F5F3EE]" />}>
      <RunnerPageInner />
    </Suspense>
  );
}
