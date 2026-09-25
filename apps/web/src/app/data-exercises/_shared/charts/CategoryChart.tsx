"use client";

import { ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, LabelList } from "recharts";
import type { CategoryAgg, ChartTypeId } from "@/lib/exerciseCharts";
import { useSize } from "./useSize";
import { MONO, SANS, categoryColor, chartStyles, useExerciseTheme, type ExerciseTheme } from "../theme";

const short = (s: string, max = 16) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

type Row = CategoryAgg["rows"][number] & { label: string; color: string };

/** 10×10 squares, one per percent; pctShown already sums to exactly 100 for single choice. */
function Waffle({ rows, t }: { rows: Row[]; t: ExerciseTheme }) {
  const [ref, { width, height }] = useSize<HTMLDivElement>();
  const side = Math.max(0, Math.min(height - 16, width * 0.55));
  const cell = side / 10;
  const colors = rows.flatMap((r) => Array<string>(r.pctShown).fill(r.color));
  const rowH = Math.min(40, (height - 16) / Math.max(rows.length, 1));

  return (
    <div ref={ref} className="h-full w-full">
      {width > 0 && (
        <svg className="chart-surface" width={width} height={height} role="img" aria-label="Waffle chart">
          <g transform={`translate(0 ${(height - side) / 2})`}>
            {Array.from({ length: 100 }, (_, i) => (
              <rect
                key={i}
                x={(i % 10) * cell + 1.5}
                y={Math.floor(i / 10) * cell + 1.5}
                width={cell - 3}
                height={cell - 3}
                rx={2}
                fill={colors[i] ?? t.line}
              />
            ))}
          </g>
          <g transform={`translate(${side + 32} ${(height - rowH * rows.length) / 2})`}>
            {rows.map((r, i) => (
              <g key={r.name} transform={`translate(0 ${i * rowH})`}>
                <rect y={rowH / 2 - 8} width={16} height={16} rx={3} fill={r.color} />
                <text x={26} y={rowH / 2 + 5} fontSize={17} fill={t.ink} fontFamily={SANS}>
                  {short(r.name, 22)}
                  <tspan fontFamily={MONO} fontWeight={600} dx={10}>
                    {r.pctShown}%
                  </tspan>
                </text>
              </g>
            ))}
          </g>
        </svg>
      )}
    </div>
  );
}

function PieOrDonut({ rows, answered, donut, t }: { rows: Row[]; answered: number; donut: boolean; t: ExerciseTheme }) {
  const s = chartStyles(t);
  const [ref, { width, height }] = useSize<HTMLDivElement>();
  // Recharts' % radii are relative to half the smaller side (after margins); size the centre label to the hole.
  const hole = (Math.min(width - 48, height - 48) / 2) * 0.46;
  const big = Math.max(14, Math.min(44, hole * 0.62));

  const renderLabel = (props: any) => {
    const { cx, cy, midAngle, outerRadius, payload } = props;
    const RAD = Math.PI / 180;
    const r = outerRadius + 22;
    const x = cx + r * Math.cos(-midAngle * RAD);
    const y = cy + r * Math.sin(-midAngle * RAD);
    return (
      <text x={x} y={y} textAnchor={x > cx ? "start" : "end"} dominantBaseline="central" fontSize={16} fill={t.ink} fontFamily={SANS}>
        {short(payload.name, 18)}
        <tspan dx={8} fontFamily={MONO} fontWeight={600}>
          {payload.pctShown}%
        </tspan>
      </text>
    );
  };

  return (
    <div ref={ref} className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 24, right: 24, bottom: 24, left: 24 }}>
          <Pie
            data={rows}
            dataKey="count"
            nameKey="name"
            outerRadius="72%"
            innerRadius={donut ? "46%" : 0}
            paddingAngle={donut ? 2 : 0}
            stroke={t.surface}
            strokeWidth={2}
            label={renderLabel}
            labelLine={{ stroke: t.muted }}
            isAnimationActive={false}
          >
            {rows.map((r) => (
              <Cell key={r.name} fill={r.color} />
            ))}
          </Pie>
          {donut && width > 0 && (
            <>
              <text x="50%" y="50%" dy={hole > 44 ? -big * 0.12 : big * 0.35} textAnchor="middle" fontSize={big} fontWeight={600} fill={t.ink} fontFamily={MONO}>
                {answered}
              </text>
              {hole > 44 && (
                <text x="50%" y="50%" dy={big * 0.62} textAnchor="middle" fontSize={13} fill={t.muted} fontFamily={SANS}>
                  answers
                </text>
              )}
            </>
          )}
          <Tooltip contentStyle={s.tooltip} itemStyle={s.tooltipLabel} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function CategoryChart({ agg, type }: { agg: CategoryAgg; type: ChartTypeId }) {
  const t = useExerciseTheme();
  const s = chartStyles(t);
  const data: Row[] = agg.rows.map((r) => ({ ...r, label: `${r.count} · ${r.pctShown}%`, color: categoryColor(t, r.index) }));
  const maxCount = Math.max(1, ...data.map((d) => d.count));

  if (type === "waffle") return <Waffle rows={data} t={t} />;

  if (type === "table") {
    return (
      <div className="h-full overflow-auto">
        <table className="w-full text-lg">
          <thead>
            <tr className="text-left text-xs uppercase tracking-[0.14em] text-(--de-muted) border-b border-(--de-ink)">
              <th className="py-2 font-medium">Answer</th>
              <th className="py-2 font-medium text-right">Count</th>
              <th className="py-2 font-medium text-right">Share</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.name} className="border-b border-(--de-line)">
                <td className="py-3">
                  <span className="inline-block w-3 h-3 rounded-sm mr-3 align-middle" style={{ background: r.color }} />
                  {r.name}
                </td>
                <td className="py-3 text-right font-mono tabular-nums">{r.count}</td>
                <td className="py-3 text-right font-mono tabular-nums">{r.pctShown}%</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="pt-3 text-sm text-(--de-muted)">{agg.multi ? "People who answered" : "Total"}</td>
              <td className="pt-3 text-right font-mono tabular-nums">{agg.answered}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    );
  }

  if (type === "pie" || type === "donut") {
    return <PieOrDonut rows={data.filter((d) => d.count > 0)} answered={agg.answered} donut={type === "donut"} t={t} />;
  }

  if (type === "column") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 32, right: 16, left: 16, bottom: 4 }}>
          <CartesianGrid stroke={t.line} vertical={false} />
          <XAxis dataKey="name" tick={s.categoryTick} tickFormatter={(v) => short(v, 14)} tickLine={false} axisLine={{ stroke: t.ink }} interval={0} />
          <YAxis hide domain={[0, maxCount * 1.12]} />
          <Tooltip contentStyle={s.tooltip} labelStyle={s.tooltipLabel} cursor={{ fill: s.cursorFill }} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={96} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
            <LabelList dataKey="label" position="top" style={s.dataLabel} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // Horizontal bars (default): long answer labels stay readable.
  const labelWidth = Math.min(260, Math.max(80, Math.max(...data.map((d) => Math.min(d.name.length, 26))) * 9.5 + 12));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 4, bottom: 8 }} barCategoryGap="22%">
        <XAxis type="number" hide domain={[0, maxCount * 1.3]} />
        <YAxis type="category" dataKey="name" width={labelWidth} tick={s.categoryTick} tickFormatter={(v) => short(v, 26)} tickLine={false} axisLine={{ stroke: t.ink }} />
        <Tooltip contentStyle={s.tooltip} labelStyle={s.tooltipLabel} cursor={{ fill: s.cursorFill }} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={56} minPointSize={2} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
          <LabelList dataKey="label" position="right" style={s.dataLabel} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
