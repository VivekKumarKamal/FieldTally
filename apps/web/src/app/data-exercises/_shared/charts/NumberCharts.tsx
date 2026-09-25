"use client";

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import type { NumberStats } from "@/lib/exerciseCharts";
import { useSize } from "./useSize";
import { MONO, SANS, chartStyles, useExerciseTheme } from "../theme";

const fmt = (n: number) => String(Number(n.toFixed(2)));

export function NumberLine({ values }: { values: number[] }) {
  const th = useExerciseTheme();
  const s = chartStyles(th);
  const data = values.map((value, i) => ({ n: i + 1, value }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 16, right: 32, left: 8, bottom: 20 }}>
        <CartesianGrid stroke={th.line} vertical={false} />
        <XAxis
          dataKey="n"
          tick={s.axisTick}
          tickLine={false}
          axisLine={{ stroke: th.ink }}
          label={{ value: "Answers in the order they came in", position: "insideBottom", offset: -14, style: s.axisTick }}
        />
        <YAxis tick={s.axisTick} tickLine={false} axisLine={false} width={48} />
        <Tooltip contentStyle={s.tooltip} labelFormatter={(n) => `Answer #${n}`} />
        <Line type="monotone" dataKey="value" stroke={th.accent} strokeWidth={3} dot={{ r: 4, fill: th.accent, strokeWidth: 0 }} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function niceTicks(min: number, max: number, count = 5): number[] {
  if (min === max) return [min];
  const raw = (max - min) / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  const step = (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * pow;
  const ticks: number[] = [];
  for (let t = Math.ceil(min / step) * step; t <= max + 1e-9; t += step) ticks.push(Number(t.toFixed(6)));
  return ticks;
}

/** Box plot with every answer drawn as a dot underneath, so the box has something concrete to summarise. */
export function BoxPlot({ stats, values }: { stats: NumberStats; values: number[] }) {
  const th = useExerciseTheme();
  const [ref, { width, height }] = useSize<HTMLDivElement>();
  const pad = 40;
  const span = stats.max - stats.min || 1;
  const lo = stats.min - span * 0.05;
  const hi = stats.max + span * 0.05;
  const x = (v: number) => pad + ((v - lo) / (hi - lo)) * (width - pad * 2);
  const boxH = Math.min(120, height * 0.24);
  const midY = height * 0.5 - 16;
  const axisY = midY + boxH / 2 + 44;

  // Five labels above the box; nudge a label up a row when it would collide with its neighbour.
  const marks = [
    { v: stats.min, name: "smallest" },
    { v: stats.q1, name: "Q1" },
    { v: stats.median, name: "middle" },
    { v: stats.q3, name: "Q3" },
    { v: stats.max, name: "largest" },
  ];
  let lastX = -Infinity;
  let row = 0;
  const placed = marks.map((m) => {
    const px = x(m.v);
    row = px - lastX < 76 ? row + 1 : 0;
    lastX = px;
    return { ...m, px, row };
  });

  return (
    <div ref={ref} className="h-full w-full">
      {width > 0 && (
        <svg className="chart-surface" width={width} height={height} role="img" aria-label="Box plot">
          <line x1={x(stats.min)} x2={x(stats.q1)} y1={midY} y2={midY} stroke={th.ink} strokeWidth={2} />
          <line x1={x(stats.q3)} x2={x(stats.max)} y1={midY} y2={midY} stroke={th.ink} strokeWidth={2} />
          {[stats.min, stats.max].map((v) => (
            <line key={v} x1={x(v)} x2={x(v)} y1={midY - boxH / 4} y2={midY + boxH / 4} stroke={th.ink} strokeWidth={2} />
          ))}
          <rect x={x(stats.q1)} y={midY - boxH / 2} width={Math.max(2, x(stats.q3) - x(stats.q1))} height={boxH} fill={th.accent} fillOpacity={0.18} stroke={th.accent} strokeWidth={2} rx={3} />
          <line x1={x(stats.median)} x2={x(stats.median)} y1={midY - boxH / 2} y2={midY + boxH / 2} stroke={th.ink} strokeWidth={4} />

          {placed.map((m) => (
            <g key={m.name}>
              <text x={m.px} y={midY - boxH / 2 - 14 - m.row * 36} textAnchor="middle" fontSize={16} fontWeight={600} fill={th.ink} fontFamily={MONO}>
                {fmt(m.v)}
              </text>
              <text x={m.px} y={midY - boxH / 2 - 32 - m.row * 36} textAnchor="middle" fontSize={11} fill={th.muted} fontFamily={SANS} letterSpacing="0.08em">
                {m.name.toUpperCase()}
              </text>
            </g>
          ))}

          {values.map((v, i) => (
            <circle key={i} cx={x(v)} cy={axisY - 14 - (i % 3) * 5} r={4} fill={th.ink} fillOpacity={0.45} />
          ))}
          <line x1={pad} x2={width - pad} y1={axisY} y2={axisY} stroke={th.ink} />
          {niceTicks(stats.min, stats.max).map((t) => (
            <text key={t} x={x(t)} y={axisY + 20} textAnchor="middle" fontSize={13} fill={th.muted} fontFamily={MONO}>
              {fmt(t)}
            </text>
          ))}
        </svg>
      )}
    </div>
  );
}

export function NumberSummary({ stats }: { stats: NumberStats }) {
  const tiles: [string, string, string?][] = [
    ["Average", String(Number(stats.mean.toFixed(1))), "add them all up, divide by how many"],
    ["Middle value", fmt(stats.median), "the median"],
    ["Most common", stats.modes.length ? stats.modes.map(fmt).join(", ") : "None", stats.modes.length ? "the mode" : "no value repeats most"],
    ["Range", fmt(stats.max - stats.min), `from ${fmt(stats.min)} to ${fmt(stats.max)}`],
  ];
  return (
    <div className="h-full grid grid-cols-2 gap-3 content-center">
      {tiles.map(([label, value, hint]) => (
        <div key={label} className="rounded-lg border border-(--de-line) p-4 sm:p-5">
          <div className="text-xs uppercase tracking-[0.14em] text-(--de-muted)">{label}</div>
          <div className="font-mono font-semibold tabular-nums text-[clamp(2rem,6vh,3.5rem)] leading-tight">{value}</div>
          {hint && <div className="text-sm text-(--de-muted)">{hint}</div>}
        </div>
      ))}
    </div>
  );
}
