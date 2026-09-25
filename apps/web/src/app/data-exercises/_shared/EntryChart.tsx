"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { INK, ACCENT, LINE, MUTED } from "./theme";

export type ChartMode = "cumulative" | "per-minute";

function buildCumulative(entries: number[]) {
  const sorted = [...entries].sort((a, b) => a - b);
  return sorted.map((ts, i) => ({
    label: new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    count: i + 1,
  }));
}

function buildPerMinute(entries: number[]) {
  if (entries.length === 0) return [];
  const sorted = [...entries].sort((a, b) => a - b);
  const bucketMs = 60_000;
  const first = Math.floor(sorted[0]! / bucketMs) * bucketMs;
  const last = Math.floor(sorted[sorted.length - 1]! / bucketMs) * bucketMs;
  const buckets = new Map<number, number>();
  for (let t = first; t <= last; t += bucketMs) buckets.set(t, 0);
  for (const ts of sorted) {
    const bucket = Math.floor(ts / bucketMs) * bucketMs;
    buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
  }
  return [...buckets.entries()].map(([bucket, count]) => ({
    label: new Date(bucket).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    count,
  }));
}

export const AXIS_TICK = { fontSize: 12, fill: MUTED, fontFamily: "var(--font-geist-mono)" };
export const TOOLTIP_STYLE = {
  background: INK,
  border: "none",
  borderRadius: 6,
  color: "#fff",
  fontSize: 12,
  fontFamily: "var(--font-geist-mono)",
};

export default function EntryChart({
  entries,
  mode,
  emptyLabel = "Waiting for the first entry",
}: {
  entries: number[];
  mode: ChartMode;
  emptyLabel?: string;
}) {
    const data = useMemo(
      () => (mode === "cumulative" ? buildCumulative(entries) : buildPerMinute(entries)),
      [entries, mode],
    );

    if (entries.length === 0) {
      return (
        <div className="h-full flex flex-col items-center justify-center gap-3 text-[#6B665C]">
          <div className="flex gap-1.5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-2 h-2 rounded-full bg-[#6B665C] animate-pulse"
                style={{ animationDelay: `${i * 200}ms` }}
              />
            ))}
          </div>
          <p className="text-sm">{emptyLabel}</p>
        </div>
      );
    }

    return (
      <div className="h-full w-full">
        <ResponsiveContainer width="100%" height="100%">
          {mode === "cumulative" ? (
            <AreaChart data={data} margin={{ top: 12, right: 32, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="entryFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ACCENT} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={LINE} vertical={false} />
              <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: INK }} interval="preserveStartEnd" minTickGap={40} />
              <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ stroke: INK, strokeDasharray: "3 3" }} />
              <Area type="stepAfter" dataKey="count" stroke={ACCENT} strokeWidth={3} fill="url(#entryFill)" isAnimationActive={false} />
            </AreaChart>
          ) : (
            <BarChart data={data} margin={{ top: 12, right: 32, left: -12, bottom: 0 }}>
              <CartesianGrid stroke={LINE} vertical={false} />
              <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: INK }} interval="preserveStartEnd" minTickGap={24} />
              <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(22,20,15,0.05)" }} />
              <Bar dataKey="count" fill={INK} radius={[3, 3, 0, 0]} maxBarSize={48} isAnimationActive={false} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    );
}
