"use client";

import { useMemo, useRef, forwardRef, useImperativeHandle } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

export type ChartMode = "cumulative" | "per-minute";
export type EntryChartHandle = { getSvg: () => SVGSVGElement | null };

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

const EntryChart = forwardRef<EntryChartHandle, { entries: number[]; mode: ChartMode }>(
  function EntryChart({ entries, mode }, ref) {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const data = useMemo(
      () => (mode === "cumulative" ? buildCumulative(entries) : buildPerMinute(entries)),
      [entries, mode],
    );

    useImperativeHandle(ref, () => ({
      getSvg: () => wrapperRef.current?.querySelector("svg") ?? null,
    }));

    if (entries.length === 0) {
      return (
        <div className="h-72 flex items-center justify-center text-indigo-300 font-semibold text-lg">
          Waiting for the first student...
        </div>
      );
    }

    return (
      <div ref={wrapperRef} className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {mode === "cumulative" ? (
            <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#ec4899" strokeWidth={4} dot={false} />
            </LineChart>
          ) : (
            <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#6366f1" radius={[6, 6, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    );
  },
);

export default EntryChart;
