"use client";

import { useEffect, type RefObject } from "react";
import {
  AlignHorizontalDistributeCenter,
  ChartArea,
  ChartBar,
  ChartBarDecreasing,
  ChartColumn,
  ChartColumnBig,
  ChartLine,
  ChartPie,
  ChartScatter,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cloud,
  Donut,
  Grid3x3,
  Sigma,
  Table,
  TextQuote,
  type LucideIcon,
} from "lucide-react";
import {
  CHART_LABELS,
  chartOptionsFor,
  metaLine,
  type ChartTypeId,
  type DataKind,
  type Summary,
} from "@/lib/exerciseCharts";
import ChartView from "./charts/ChartView";

const ICONS: Record<ChartTypeId, LucideIcon> = {
  bar: ChartBar,
  column: ChartColumn,
  pie: ChartPie,
  donut: Donut,
  waffle: Grid3x3,
  table: Table,
  histogram: ChartColumnBig,
  dots: ChartScatter,
  box: AlignHorizontalDistributeCenter,
  line: ChartLine,
  summary: Sigma,
  cloud: Cloud,
  words: ChartBarDecreasing,
  wall: TextQuote,
  timeline: ChartScatter,
  cumulative: ChartArea,
};

export interface PanelItem {
  id: string;
  kind: DataKind;
  title: string;
}

export default function QuestionPanel({
  items,
  activeIndex,
  onActiveIndexChange,
  type,
  onTypeChange,
  summary,
  total,
  locked,
  hidden,
  onHiddenChange,
  canHide,
  chartRef,
}: {
  items: PanelItem[];
  activeIndex: number;
  onActiveIndexChange: (i: number) => void;
  type: ChartTypeId;
  onTypeChange: (t: ChartTypeId) => void;
  summary: Summary;
  total: number;
  locked: boolean;
  hidden: boolean;
  onHiddenChange: (hidden: boolean) => void;
  canHide: boolean;
  chartRef: RefObject<HTMLDivElement | null>;
}) {
  const item = items[activeIndex]!;
  const questionCount = items.filter((i) => i.kind !== "arrival").length;
  const isArrival = item.kind === "arrival";
  const go = (delta: number) => onActiveIndexChange(Math.min(items.length - 1, Math.max(0, activeIndex + delta)));

  // ← / → step through questions, unless someone is typing an answer.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.altKey || e.metaKey || e.ctrlKey) return;
      if (e.target instanceof Element && e.target.closest("input, textarea, select, [contenteditable], [role=separator], [role=radiogroup]")) return;
      e.preventDefault();
      go(e.key === "ArrowLeft" ? -1 : 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <section className="min-h-0 min-w-0 flex flex-col gap-3 sm:gap-4 p-4 sm:p-6 lg:p-8">
      {/* Navigation */}
      {items.length > 1 && (
        <div className="shrink-0 flex items-center gap-2">
          <button
            onClick={() => go(-1)}
            disabled={activeIndex === 0}
            aria-label="Previous question"
            className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-(--de-line) bg-(--de-surface) hover:border-(--de-ink) disabled:opacity-30 disabled:hover:border-(--de-line) transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => go(1)}
            disabled={activeIndex === items.length - 1}
            aria-label="Next question"
            className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-(--de-line) bg-(--de-surface) hover:border-(--de-ink) disabled:opacity-30 disabled:hover:border-(--de-line) transition-colors"
          >
            <ChevronRight size={16} />
          </button>
          <span className="ml-1 text-xs uppercase tracking-[0.14em] text-(--de-muted) whitespace-nowrap">
            {isArrival ? "Arrivals" : `Question ${activeIndex + 1} of ${questionCount}`}
          </span>
          <div className="hidden sm:flex items-center gap-1 ml-2 overflow-x-auto" aria-label="Jump to question">
            {items.map((it, i) => (
              <button
                key={it.id}
                onClick={() => onActiveIndexChange(i)}
                title={it.title}
                aria-current={i === activeIndex}
                className={`h-7 min-w-7 px-2 inline-flex items-center justify-center rounded-md text-xs font-mono transition-colors ${
                  i === activeIndex ? "bg-(--de-ink) text-(--de-paper)" : "text-(--de-muted) hover:bg-(--de-surface) hover:text-(--de-ink)"
                }`}
              >
                {it.kind === "arrival" ? <Clock size={13} /> : i + 1}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* The question itself is the headline. */}
      <h2
        className="shrink-0 text-[clamp(1.5rem,2.4vw,2.5rem)] font-semibold leading-[1.15] tracking-tight [text-wrap:balance] line-clamp-3"
        title={item.title}
      >
        {item.title}
      </h2>

      <div className="shrink-0 flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-sm text-(--de-muted)">{metaLine(item.kind, summary.answered, total)}</p>
        <div role="radiogroup" aria-label="Chart type" className="sm:ml-auto inline-flex flex-wrap gap-0.5 rounded-lg border border-(--de-line) bg-(--de-surface) p-0.5">
          {chartOptionsFor(item.kind).map((t) => {
            const Icon = ICONS[t];
            const on = t === type;
            return (
              <button
                key={t}
                role="radio"
                aria-checked={on}
                title={CHART_LABELS[t]}
                onClick={() => onTypeChange(t)}
                className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-sm transition-colors ${
                  on ? "bg-(--de-ink) text-(--de-paper)" : "text-(--de-muted) hover:text-(--de-ink) hover:bg-(--de-paper)"
                }`}
              >
                <Icon size={15} strokeWidth={2} />
                <span className={on ? "hidden sm:inline" : "hidden 2xl:inline"}>{CHART_LABELS[t]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div ref={chartRef} className="flex-1 min-h-0 rounded-xl border border-(--de-line) bg-(--de-surface) p-3 sm:p-5">
        {locked ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-2 px-6">
            <div className="text-lg font-semibold">Results unlock when the exercise ends</div>
            <p className="text-sm text-(--de-muted) max-w-sm">This template keeps the chart hidden while people are still answering.</p>
          </div>
        ) : hidden ? (
          <div className="h-full flex flex-col items-center justify-center gap-5 text-center px-6">
            <div className="text-[clamp(1.25rem,2vw,1.75rem)] font-semibold">What do you think the answer will look like?</div>
            <p className="text-(--de-muted) -mt-2">Make a guess, then reveal.</p>
            <button
              onClick={() => onHiddenChange(false)}
              className="px-6 py-3 rounded-lg bg-(--de-ink) text-(--de-paper) font-semibold hover:opacity-90 transition-colors"
            >
              Reveal the chart
            </button>
          </div>
        ) : (
          <ChartView summary={summary} type={type} />
        )}
      </div>

      <div className="shrink-0 flex items-start gap-4 min-h-7">
        {!locked && !hidden && summary.takeaway && (
          <p className="text-[clamp(1rem,1.4vw,1.25rem)] leading-snug">
            <span className="inline-block w-2 h-2 rounded-full bg-(--de-accent) mr-2.5 align-middle" aria-hidden />
            {summary.takeaway}
          </p>
        )}
        {canHide && !locked && (
          <button
            onClick={() => onHiddenChange(!hidden)}
            className="ml-auto shrink-0 text-sm text-(--de-muted) hover:text-(--de-ink) underline underline-offset-4"
          >
            {hidden ? "Show chart" : "Hide chart"}
          </button>
        )}
      </div>
    </section>
  );
}
