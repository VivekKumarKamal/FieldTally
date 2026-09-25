"use client";

import { useMemo } from "react";
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { ExerciseField, ChartType } from "@/lib/exerciseSchema";

const PIE_COLORS = ["#ec4899", "#6366f1", "#f59e0b", "#10b981", "#0ea5e9", "#8b5cf6"];

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
  return [...map.entries()].map(([name, count]) => ({ name, count }));
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

  if (chartType === "none" || values.length === 0) return null;

  if (chartType === "number") {
    const numeric = values.map(Number).filter((n) => !Number.isNaN(n));
    const display = numeric.length ? (numeric.reduce((a, b) => a + b, 0) / numeric.length).toFixed(1) : values.length;
    return (
      <div className="bg-white/70 rounded-2xl shadow p-4 text-center">
        <div className="text-3xl font-black text-indigo-700">{display}</div>
        <div className="text-xs font-bold text-indigo-400 uppercase tracking-wide mt-1">
          {field.label} {numeric.length ? "(avg)" : "(responses)"}
        </div>
      </div>
    );
  }

  if (chartType === "line") {
    const data = values.map((v, i) => ({ index: i + 1, value: Number(v) || 0 }));
    return (
      <div className="bg-white/70 rounded-2xl shadow p-4">
        <div className="text-sm font-bold text-indigo-500 mb-2">{field.label}</div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="index" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#ec4899" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  const data = counts(values);

  if (chartType === "pie") {
    return (
      <div className="bg-white/70 rounded-2xl shadow p-4">
        <div className="text-sm font-bold text-indigo-500 mb-2">{field.label}</div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="count" nameKey="name" outerRadius={80} label>
                {data.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  // bar
  return (
    <div className="bg-white/70 rounded-2xl shadow p-4">
      <div className="text-sm font-bold text-indigo-500 mb-2">{field.label}</div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="count" fill="#6366f1" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
