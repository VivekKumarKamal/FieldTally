"use client";

// Charts drawn from bins: histograms (numbers, times, dates, arrivals), the
// stacked-dot plot/timeline, and the running-total line for arrivals.

import { useId } from "react";
import { ResponsiveContainer, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, LabelList } from "recharts";
import type { Bin } from "@/lib/exerciseCharts";
import { useSize } from "./useSize";
import { MONO, chartStyles, useExerciseTheme } from "../theme";

const hideZero = (v: unknown) => (v ? String(v) : "");

/** Bars touch on purpose: that's what tells a histogram (ranges) apart from a bar chart (categories). */
export function BinHistogram({ bins, yLabel = "How many" }: { bins: Bin[]; yLabel?: string }) {
  const t = useExerciseTheme();
  const s = chartStyles(t);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={bins} margin={{ top: 28, right: 24, left: 8, bottom: 4 }} barCategoryGap={0}>
        <CartesianGrid stroke={t.line} vertical={false} />
        <XAxis dataKey="label" tick={s.axisTick} tickLine={false} axisLine={{ stroke: t.ink }} minTickGap={12} />
        <YAxis
          allowDecimals={false}
          tick={s.axisTick}
          tickLine={false}
          axisLine={false}
          width={48}
          label={{ value: yLabel, angle: -90, position: "insideLeft", offset: 12, style: { ...s.axisTick, textAnchor: "middle" } }}
        />
        <Tooltip
          contentStyle={s.tooltip}
          labelStyle={s.tooltipLabel}
          cursor={{ fill: s.cursorFill }}
          formatter={(v) => [v, "count"]}
          labelFormatter={(_, p) => p?.[0]?.payload?.range ?? ""}
        />
        <Bar dataKey="count" fill={t.accent} stroke={t.surface} strokeWidth={1} isAnimationActive={false}>
          <LabelList dataKey="count" position="top" formatter={hideZero} style={s.dataLabel} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** One dot per answer, stacked in its bin: the most concrete chart for students ("that dot is you"). */
export function DotStack({ bins }: { bins: Bin[] }) {
  const t = useExerciseTheme();
  const s = chartStyles(t);
  const [ref, { width, height }] = useSize<HTMLDivElement>();
  const pad = { left: 12, right: 12, top: 28, bottom: 36 };
  const maxCount = Math.max(1, ...bins.map((b) => b.count));
  const slot = bins.length ? (width - pad.left - pad.right) / bins.length : 0;
  const plotH = height - pad.top - pad.bottom;
  const r = Math.max(2, Math.min(14, slot * 0.4, plotH / (maxCount * 2.2)));
  const gap = r * 0.2;
  const baseY = height - pad.bottom;
  const longest = Math.max(1, ...bins.map((b) => b.label.length));
  const every = Math.max(1, Math.ceil((longest * 8.5 + 10) / Math.max(slot, 1)));

  return (
    <div ref={ref} className="h-full w-full">
      {width > 0 && (
        <svg className="chart-surface" width={width} height={height} role="img" aria-label="Dot plot">
          <line x1={pad.left} x2={width - pad.right} y1={baseY} y2={baseY} stroke={t.ink} />
          {bins.map((b, i) => {
            const cx = pad.left + slot * (i + 0.5);
            return (
              <g key={i}>
                {Array.from({ length: b.count }, (_, j) => (
                  <circle key={j} cx={cx} cy={baseY - r - gap - j * (2 * r + gap)} r={r} fill={t.accent} />
                ))}
                {b.count > 0 && (
                  <text x={cx} y={baseY - b.count * (2 * r + gap) - 8} textAnchor="middle" style={{ ...s.dataLabel, fontSize: 13 }}>
                    {b.count}
                  </text>
                )}
                {i % every === 0 && (
                  <text x={cx} y={baseY + 22} textAnchor="middle" fontSize={13} fill={t.muted} fontFamily={MONO}>
                    {b.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

export function CumulativeChart({ timestamps }: { timestamps: number[] }) {
  const t = useExerciseTheme();
  const s = chartStyles(t);
  const fillId = `cumulative${useId().replace(/[^\w-]/g, "")}`;
  const data = timestamps.map((ts, i) => ({
    label: new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" }),
    total: i + 1,
  }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 16, right: 32, left: 8, bottom: 4 }}>
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={t.accent} stopOpacity={0.25} />
            <stop offset="100%" stopColor={t.accent} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={t.line} vertical={false} />
        <XAxis dataKey="label" tick={s.axisTick} tickLine={false} axisLine={{ stroke: t.ink }} interval="preserveStartEnd" minTickGap={40} />
        <YAxis
          allowDecimals={false}
          tick={s.axisTick}
          tickLine={false}
          axisLine={false}
          width={48}
          label={{ value: "Total so far", angle: -90, position: "insideLeft", offset: 12, style: { ...s.axisTick, textAnchor: "middle" } }}
        />
        <Tooltip contentStyle={s.tooltip} labelStyle={s.tooltipLabel} cursor={{ stroke: t.ink, strokeDasharray: "3 3" }} />
        <Area type="stepAfter" dataKey="total" stroke={t.accent} strokeWidth={3} fill={`url(#${fillId})`} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
