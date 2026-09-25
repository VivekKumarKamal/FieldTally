"use client";

import { useEffect, useRef, useState, useCallback, useMemo, Suspense } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { apiGet, apiSend } from "@/lib/apiClient";
import { claimLocalRun, finishExerciseInstance } from "@/lib/exerciseInstances";
import { extractExerciseFields, getExerciseSettings, type ExerciseField, type ChartConfig } from "@/lib/exerciseSchema";
import {
  dataKindOf,
  resolveChartType,
  summarize,
  NOT_EXPORTABLE,
  type ChartTypeId,
  type DataKind,
} from "@/lib/exerciseCharts";
import * as Popover from "@radix-ui/react-popover";
import { Check, Cloud, CloudUpload, FileSpreadsheet, Flag, ImageDown, Palette, type LucideIcon } from "lucide-react";
import QuestionPanel, { type PanelItem } from "../../_shared/QuestionPanel";
import { DEFAULT_THEME, THEMES, THEME_KEY, ThemeContext, themeVars, type ExerciseTheme } from "../../_shared/theme";
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
const SPLIT_KEY = "ft_exercise_split";
const ARRIVALS_ID = "__arrivals";

interface RunView {
  active: string | null;
  types: Record<string, ChartTypeId>;
}

function localKey(runId: string) {
  return `ft_exercise_run_${runId}`;
}

function viewKey(runId: string) {
  return `ft_exercise_view_${runId}`;
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
      <span className="hidden sm:inline text-xs uppercase tracking-[0.14em] text-(--de-muted)">
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
      <div className="text-[11px] uppercase tracking-[0.14em] text-(--de-muted)">{label}</div>
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
  const [view, setView] = useState<RunView>({ active: null, types: {} });
  const [leftWidth, setLeftWidth] = useState<number | null>(null);
  const [pops, setPops] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  // The facilitator's question + chart-type choices survive a refresh; the panel width is per-device.
  useEffect(() => {
    if (!runId) return;
    try {
      const saved = localStorage.getItem(viewKey(runId));
      if (saved) setView(JSON.parse(saved));
      const w = Number(localStorage.getItem(SPLIT_KEY));
      if (w > 0) setLeftWidth(w);
    } catch {}
  }, [runId]);

  // Colour theme: a per-device preference (the projector laptop keeps its pick across runs).
  const [themeId, setThemeId] = useState(DEFAULT_THEME.id);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved && THEMES.some((t) => t.id === saved)) setThemeId(saved);
    } catch {}
  }, []);
  const theme = THEMES.find((t) => t.id === themeId) ?? DEFAULT_THEME;
  function pickTheme(id: string) {
    setThemeId(id);
    try {
      localStorage.setItem(THEME_KEY, id);
    } catch {}
  }

  function updateView(next: RunView) {
    setView(next);
    try {
      localStorage.setItem(viewKey(runId), JSON.stringify(next));
    } catch {}
  }

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

  // Questions first (the actual answers), arrivals last. A template with no
  // questions only has arrivals, which then opens on arrivals-per-minute.
  const items = useMemo(() => {
    const out: (PanelItem & { field: ExerciseField | null; defaultType: ChartTypeId })[] = [];
    for (const f of fields) {
      const kind = dataKindOf(f.type);
      const defaultType = kind && resolveChartType(kind, chartConfig[f.id]);
      if (kind && defaultType) out.push({ id: f.id, kind, title: f.label, field: f, defaultType });
    }
    out.push({ id: ARRIVALS_ID, kind: "arrival" as DataKind, title: "When did the entries come in?", field: null, defaultType: "histogram" });
    return out;
  }, [fields, chartConfig]);

  const activeIndex = Math.max(0, items.findIndex((i) => i.id === view.active));
  const activeItem = items[activeIndex]!;
  const storedType = view.types[activeItem.id];
  const activeType = storedType && resolveChartType(activeItem.kind, storedType) === storedType ? storedType : activeItem.defaultType;
  const summary = useMemo(() => summarize(activeItem.kind, activeItem.field, entries), [activeItem, entries]);

  const widthRef = useRef<number | null>(null);
  const clampWidth = (w: number, total: number) => Math.round(Math.min(Math.max(w, 240), total * 0.55));
  function saveWidth(w: number | null) {
    try {
      if (w === null) localStorage.removeItem(SPLIT_KEY);
      else localStorage.setItem(SPLIT_KEY, String(w));
    } catch {}
  }
  function startResize(e: React.PointerEvent<HTMLDivElement>) {
    const main = mainRef.current;
    if (!main) return;
    e.preventDefault();
    const rect = main.getBoundingClientRect();
    const move = (ev: PointerEvent) => {
      widthRef.current = clampWidth(ev.clientX - rect.left, rect.width);
      setLeftWidth(widthRef.current);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
      saveWidth(widthRef.current);
    };
    document.body.style.cursor = "col-resize";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }
  function nudgeResize(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const main = mainRef.current;
    if (!main) return;
    e.preventDefault();
    const rect = main.getBoundingClientRect();
    const current = leftWidth ?? rect.width * 0.36;
    const next = clampWidth(current + (e.key === "ArrowLeft" ? -24 : 24), rect.width);
    setLeftWidth(next);
    saveWidth(next);
  }

  if (loading) {
    return (
      <div style={themeVars(theme)} className="h-dvh flex items-center justify-center bg-(--de-paper) text-sm text-(--de-muted)">
        Loading exercise…
      </div>
    );
  }

  if (error) {
    return (
      <div style={themeVars(theme)} className="h-dvh flex flex-col items-center justify-center gap-4 text-center px-4 bg-(--de-paper) text-(--de-ink)">
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

  const chartsAllowed = liveDuringExercise || status === "finished";
  const canDownloadChart = chartsAllowed && !chartHidden && summary.answered > 0 && !NOT_EXPORTABLE.has(activeType);

  function downloadChart() {
    const svg = panelRef.current?.querySelector<SVGSVGElement>("svg.recharts-surface, svg.chart-surface");
    if (!svg) return;
    exportSvgAsPng(svg, `${title || "exercise"} - ${activeItem.title}.png`, {
      title: activeItem.title,
      subtitle: [title, summary.takeaway].filter(Boolean).join(" · "),
      background: theme.surface,
      ink: theme.ink,
      muted: theme.muted,
    });
  }

  return (
    <ThemeContext.Provider value={theme}>
    <div
      className="h-dvh flex flex-col overflow-hidden bg-(--de-paper) text-(--de-ink) transition-colors duration-300"
      style={{ ...themeVars(theme), fontFamily: "var(--font-geist-sans)" }}
    >
      {/* Top bar: everything the facilitator acts on lives up here, so the page below is all data. */}
      <header className="shrink-0 h-14 pl-3 pr-3 sm:px-6 flex items-center gap-2 sm:gap-3 border-b border-(--de-line)">
        <Link
          href="/data-exercises"
          aria-label="Back to Data Exercises"
          className="text-sm text-(--de-muted) hover:text-(--de-ink) transition-colors whitespace-nowrap"
        >
          ←<span className="hidden sm:inline"> Exercises</span>
        </Link>
        <span className="h-5 w-px bg-(--de-line)" aria-hidden />
        <h1 className="font-semibold truncate min-w-0">{title}</h1>
        {status === "live" ? (
          <span className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-(--de-live)">
            <span className="relative flex w-2 h-2">
              <span className="absolute inset-0 rounded-full bg-(--de-live) animate-ping opacity-60" />
              <span className="relative w-2 h-2 rounded-full bg-(--de-live)" />
            </span>
            <span className="hidden sm:inline">Live</span>
          </span>
        ) : (
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-(--de-muted)">Finished</span>
        )}

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {status === "live" ? (
            <BarButton icon={Flag} label="Finish" longLabel="Finish exercise" onClick={handleFinish} strong />
          ) : (
            <>
              <BarButton
                icon={FileSpreadsheet}
                label="Excel"
                longLabel="Download Excel"
                onClick={() => exportEntriesToExcel(entries, fields, `${title || "exercise"}.xlsx`)}
                strong
              />
              <BarButton
                icon={ImageDown}
                label="Chart"
                longLabel="Download chart"
                onClick={downloadChart}
                disabled={!canDownloadChart}
                tip={canDownloadChart ? "Download this chart as an image" : "This view can't be saved as an image. Use Download Excel."}
              />
            </>
          )}
          {isLocal ? (
            <BarButton
              icon={CloudUpload}
              label={saving ? "Saving…" : "Save"}
              longLabel={saving ? "Saving…" : "Save to cloud"}
              onClick={handleSaveToCloud}
              disabled={saving}
              tip="Only saved on this device right now. Sign in to keep it in your account."
            />
          ) : (
            <span className="hidden md:inline-flex items-center gap-1.5 text-xs text-(--de-muted) px-1" title="Saved to your account">
              <Cloud size={14} /> Saved
            </span>
          )}
          <span className="h-5 w-px bg-(--de-line) mx-0.5" aria-hidden />
          <ThemePicker current={theme} onPick={pickTheme} />
          <div className="hidden lg:block pl-2">
            <Clock />
          </div>
        </div>
      </header>

      <main
        ref={mainRef}
        className="flex-1 min-h-0 grid grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] lg:grid-rows-1 lg:grid-cols-[var(--left-w)_minmax(0,1fr)]"
        style={{ "--left-w": leftWidth ? `${leftWidth}px` : "minmax(300px,36%)" } as React.CSSProperties}
      >
        {/* Left: count + action. A size container, so the big number scales with however wide it's dragged. */}
        <section className="@container relative min-h-0 min-w-0 flex flex-col gap-5 p-4 sm:p-6 lg:p-8 border-b lg:border-b-0 lg:border-r border-(--de-line) max-h-[42dvh] lg:max-h-none overflow-y-auto">
          <div>
            <div className="text-xs uppercase tracking-[0.14em] text-(--de-muted)">Entries logged</div>
            <div
              key={count}
              className={`font-mono font-semibold tabular-nums leading-[0.85] tracking-tight ${
                oneTap || status === "finished"
                  ? "text-[clamp(3rem,min(34cqw,9vh),15rem)] lg:text-[clamp(3rem,min(34cqw,22vh),15rem)]"
                  : "text-[clamp(2.5rem,min(20cqw,8vh),7rem)] lg:text-[clamp(2.5rem,min(20cqw,11vh),7rem)]"
              }`}
              style={count > 0 ? { animation: "de-count-tick 280ms ease-out" } : undefined}
            >
              {count}
            </div>
          </div>

          <div className="grid grid-cols-2 @[19rem]:grid-cols-3 gap-4 pt-4 border-t border-(--de-line)">
            <Stat label="First" value={first ? fmtTime(first) : "—"} />
            <Stat label="Latest" value={last ? fmtTime(last) : "—"} />
            <Stat label="Per min" value={perMin} />
          </div>

          <div className="mt-auto">
            {status === "live" && fields.length === 0 && (
              <div className="relative">
                <button
                  onClick={() => handleLogEntry({})}
                  className="w-full rounded-xl bg-(--de-accent) text-(--de-on-accent) border-2 border-(--de-edge) shadow-[0_8px_0_var(--de-edge)] active:translate-y-[8px] active:shadow-none transition-[transform,box-shadow] duration-75 h-[clamp(4.5rem,11vh,11rem)] lg:h-[clamp(5.5rem,20vh,11rem)] flex flex-col items-center justify-center gap-1 select-none"
                >
                  <span className="text-[clamp(1.5rem,min(10cqw,5vh),3rem)] font-bold tracking-tight leading-none">Log entry</span>
                  <span className="hidden sm:block text-xs font-medium uppercase tracking-[0.14em] opacity-70">
                    tap or press space
                  </span>
                </button>
                {pops.map((id) => (
                  <span
                    key={id}
                    className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 font-mono font-bold text-2xl text-(--de-accent)"
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
              <div className="hidden lg:block rounded-xl border border-(--de-line) bg-(--de-surface) p-5">
                <div className="text-sm font-semibold">Exercise finished</div>
                <p className="text-sm text-(--de-muted) mt-1">
                  {count} {count === 1 ? "entry" : "entries"}
                  {first && last ? ` over ${Math.round(spanMin)} min` : ""}. Export the data or run it again from the
                  exercises page.
                </p>
              </div>
            )}
          </div>

          {/* Drag to resize (desktop). Double-click resets. */}
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize logging panel"
            tabIndex={0}
            onPointerDown={startResize}
            onKeyDown={nudgeResize}
            onDoubleClick={() => {
              setLeftWidth(null);
              saveWidth(null);
            }}
            title="Drag to resize · double-click to reset"
            className="group hidden lg:block absolute top-0 right-0 translate-x-1/2 h-full w-3 cursor-col-resize z-10 touch-none outline-none"
          >
            <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent group-hover:bg-(--de-ink) group-focus-visible:bg-(--de-ink) transition-colors" />
            <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-10 w-1.5 rounded-full bg-(--de-line) group-hover:bg-(--de-ink) group-focus-visible:bg-(--de-ink) transition-colors" />
          </div>
        </section>

        <QuestionPanel
          items={items}
          activeIndex={activeIndex}
          onActiveIndexChange={(i) => updateView({ ...view, active: items[i]!.id })}
          type={activeType}
          onTypeChange={(t) => updateView({ ...view, active: activeItem.id, types: { ...view.types, [activeItem.id]: t } })}
          summary={summary}
          total={count}
          locked={!chartsAllowed}
          hidden={chartHidden}
          onHiddenChange={setChartHidden}
          canHide={status === "live"}
          chartRef={panelRef}
        />
      </main>
    </div>
    </ThemeContext.Provider>
  );
}

/** Top-bar action: icon-only on phones, short label from md, full label from xl. */
function BarButton({
  icon: Icon,
  label,
  longLabel,
  onClick,
  disabled,
  strong,
  tip,
}: {
  icon: LucideIcon;
  label: string;
  longLabel: string;
  onClick: () => void;
  disabled?: boolean;
  strong?: boolean;
  tip?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={tip ?? longLabel}
      aria-label={longLabel}
      className={`h-9 inline-flex items-center gap-2 rounded-lg px-2.5 md:px-3 text-sm font-medium transition-[opacity,background-color,color,border-color] disabled:opacity-40 disabled:cursor-not-allowed ${
        strong
          ? "bg-(--de-ink) text-(--de-paper) hover:opacity-90 disabled:hover:opacity-40"
          : "border border-(--de-line) bg-(--de-surface) hover:border-(--de-ink) disabled:hover:border-(--de-line)"
      }`}
    >
      <Icon size={16} strokeWidth={2} />
      <span className="hidden md:inline xl:hidden">{label}</span>
      <span className="hidden xl:inline">{longLabel}</span>
    </button>
  );
}

function ThemePicker({ current, onPick }: { current: ExerciseTheme; onPick: (id: string) => void }) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          aria-label="Change colours"
          title="Change colours"
          className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-(--de-line) bg-(--de-surface) hover:border-(--de-ink) transition-colors"
        >
          <Palette size={16} />
        </button>
      </Popover.Trigger>
      <Popover.Content
        align="end"
        sideOffset={8}
        className="z-50 w-72 rounded-xl border border-(--de-line) bg-(--de-surface) p-2 shadow-xl outline-none"
      >
        <div className="px-2 pt-1 pb-2 text-xs uppercase tracking-[0.14em] text-(--de-muted)">Colours</div>
        <ul className="flex flex-col gap-1" role="radiogroup" aria-label="Colour theme">
          {THEMES.map((t) => {
            const on = t.id === current.id;
            return (
              <li key={t.id}>
                <button
                  role="radio"
                  aria-checked={on}
                  onClick={() => onPick(t.id)}
                  className={`w-full flex items-center gap-3 rounded-lg p-2 text-left transition-colors ${
                    on ? "bg-(--de-paper)" : "hover:bg-(--de-paper)"
                  }`}
                >
                  {/* A tiny preview of the theme itself: its paper, text, accent and option colours. */}
                  <span
                    className="shrink-0 w-14 h-10 rounded-md border flex flex-col justify-between p-1.5"
                    style={{ background: t.paper, borderColor: t.line }}
                    aria-hidden
                  >
                    <span className="h-1 w-7 rounded-full" style={{ background: t.ink }} />
                    <span className="flex gap-0.5">
                      {[t.accent, ...t.categories.slice(1, 4)].map((c, i) => (
                        <span key={i} className="w-2 h-2 rounded-full" style={{ background: c }} />
                      ))}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{t.name}</span>
                    <span className="block text-xs text-(--de-muted) truncate">{t.note}</span>
                  </span>
                  {on && <Check size={16} className="shrink-0" />}
                </button>
              </li>
            );
          })}
        </ul>
      </Popover.Content>
    </Popover.Root>
  );
}

export default function RunnerPage() {
  return (
    <Suspense fallback={<div className="h-dvh" style={{ background: DEFAULT_THEME.paper }} />}>
      <RunnerPageInner />
    </Suspense>
  );
}
