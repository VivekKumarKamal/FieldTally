"use client";

import { useMemo } from "react";
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { ExerciseField, ChartType } from "@/lib/exerciseSchema";
import { AXIS_TICK, TOOLTIP_STYLE } from "./EntryChart";
import { ACCENT, INK, LINE, SERIES } from "./theme";

function valuesForField(entries: { data: Record<string, any> }[], fieldId: string): any[] {
  const out: any[] = [];
  for (const entry of entries) {
    const value = entry.data[fieldId];
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) out.push(...value);
    else out.push(value);
  }
  return out;
}

function counts(values: any[]): { name: string; count: number }[] {
  const map = new Map<string, number>();
  for (const v of values) {
    const key = String(v);
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

export default function FieldChart({
  field,
  chartType,
  entries,
}: {
  field: ExerciseField;
  chartType: ChartType;
  entries: { data: Record<string, any> }[];
}) {
  const values = useMemo(() => valuesForField(entries, field.id), [entries, field.id]);

  if (chartType === "none") return null;

  if (values.length === 0) {
    return <div className="h-full flex items-center justify-center text-sm text-[#6B665C]">No answers for this question yet</div>;
  }

  if (chartType === "number") {
    const numeric = values.map(Number).filter((n) => !Number.isNaN(n));
    const avg = numeric.length ? numeric.reduce((a, b) => a + b, 0) / numeric.length : null;
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2">
        <div className="font-mono font-semibold tabular-nums text-[clamp(3rem,12vh,7rem)] leading-none text-[#16140F]">
          {avg !== null ? avg.toFixed(1) : values.length}
        </div>
        <div className="text-xs uppercase tracking-[0.14em] text-[#6B665C]">
          {avg !== null ? `average of ${numeric.length}` : "responses"}
        </div>
      </div>
    );
  }

  if (chartType === "line") {
    const data = values.map((v, i) => ({ index: i + 1, value: Number(v) || 0 }));
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 32, left: -12, bottom: 0 }}>
          <CartesianGrid stroke={LINE} vertical={false} />
          <XAxis dataKey="index" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: INK }} />
          <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Line type="monotone" dataKey="value" stroke={ACCENT} strokeWidth={3} dot={{ r: 3, fill: ACCENT }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  const data = counts(values);

  if (chartType === "pie") {
    return (
      <div className="h-full flex items-center gap-6">
        <div className="flex-1 h-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="count" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={2} stroke="none" isAnimationActive={false}>
                {data.map((_, i) => (
                  <Cell key={i} fill={SERIES[i % SERIES.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="w-44 shrink-0 flex flex-col gap-2 text-sm">
          {data.map((d, i) => (
            <li key={d.name} className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: SERIES[i % SERIES.length] }} />
              <span className="truncate text-[#16140F]">{d.name}</span>
              <span className="ml-auto font-mono tabular-nums text-[#6B665C]">{d.count}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
        <CartesianGrid stroke={LINE} horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="name" width={120} tick={{ ...AXIS_TICK, fill: INK, fontFamily: "var(--font-geist-sans)" }} tickLine={false} axisLine={{ stroke: INK }} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(22,20,15,0.05)" }} />
        <Bar dataKey="count" fill={ACCENT} radius={[0, 3, 3, 0]} maxBarSize={36} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
