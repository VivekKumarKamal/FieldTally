"use client";

import { useMemo } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LabelList } from "recharts";
import { useSize } from "./useSize";
import { SANS, chartStyles, useExerciseTheme, type ExerciseTheme } from "../theme";

type Word = { word: string; count: number };

let measureCtx: CanvasRenderingContext2D | null = null;
function textWidth(text: string, size: number): number {
  measureCtx ??= document.createElement("canvas").getContext("2d");
  if (!measureCtx) return text.length * size * 0.58;
  measureCtx.font = `600 ${size}px system-ui, sans-serif`;
  return measureCtx.measureText(text).width;
}

/** Middle-out order: [a,b,c,d,e] → [d,b,a,c,e], so the biggest items sit in the centre. */
function middleOut<T>(items: T[]): T[] {
  const out: T[] = [];
  items.forEach((item, i) => (i % 2 ? out.unshift(item) : out.push(item)));
  return out;
}

type Placed = { word: string; size: number; x: number; y: number; color: string };

/** Rows of words, biggest in the middle; shrinks the type until everything fits. */
function layoutCloud(words: Word[], width: number, height: number, th: ExerciseTheme): Placed[] {
  const top = words.slice(0, 40);
  if (top.length === 0 || width === 0) return [];
  const maxC = top[0]!.count;
  const minC = top[top.length - 1]!.count;

  // Start big (a few words should fill a projector) and shrink until everything fits.
  for (let maxSize = Math.max(20, Math.min(128, Math.round(height * 0.3))); maxSize >= 14; maxSize -= 6) {
    const minSize = Math.max(13, maxSize * 0.24);
    const sized = top.map((w, i) => ({
      ...w,
      size: maxC === minC ? (maxSize + minSize) / 2 : minSize + ((w.count - minC) / (maxC - minC)) * (maxSize - minSize),
      color: i < th.categories.length ? th.categories[i]! : i % 2 ? th.ink : th.muted,
    }));

    const rows: (typeof sized)[] = [];
    let row: typeof sized = [];
    let rowW = 0;
    for (const w of sized) {
      const ww = textWidth(w.word, w.size) + w.size * 0.5;
      if (row.length && rowW + ww > width * 0.94) {
        rows.push(row);
        row = [];
        rowW = 0;
      }
      row.push(w);
      rowW += ww;
    }
    if (row.length) rows.push(row);

    const rowHeights = rows.map((r) => Math.max(...r.map((w) => w.size)) * 1.15);
    const total = rowHeights.reduce((a, b) => a + b, 0);
    if (total > height && maxSize > 14) continue;

    const ordered = middleOut(rows.map((r, i) => ({ words: middleOut(r), h: rowHeights[i]! })));
    const placed: Placed[] = [];
    let y = (height - total) / 2;
    for (const r of ordered) {
      const widths = r.words.map((w) => textWidth(w.word, w.size) + w.size * 0.5);
      let x = (width - widths.reduce((a, b) => a + b, 0)) / 2;
      r.words.forEach((w, i) => {
        placed.push({ word: w.word, size: w.size, color: w.color, x: x + widths[i]! / 2, y: y + r.h * 0.78 });
        x += widths[i]!;
      });
      y += r.h;
    }
    return placed;
  }
  return [];
}

export function WordCloud({ words }: { words: Word[] }) {
  const th = useExerciseTheme();
  const [ref, { width, height }] = useSize<HTMLDivElement>();
  const placed = useMemo(() => layoutCloud(words, width, height, th), [words, width, height, th]);
  return (
    <div ref={ref} className="h-full w-full">
      {width > 0 && (
        <svg className="chart-surface" width={width} height={height} role="img" aria-label="Word cloud">
          {placed.map((p) => (
            <text key={p.word} x={p.x} y={p.y} textAnchor="middle" fontSize={p.size} fontWeight={600} fill={p.color} fontFamily={SANS}>
              {p.word}
            </text>
          ))}
        </svg>
      )}
    </div>
  );
}

export function TopWords({ words }: { words: Word[] }) {
  const th = useExerciseTheme();
  const s = chartStyles(th);
  const data = words.slice(0, 10);
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 4, bottom: 8 }} barCategoryGap="22%">
        <XAxis type="number" hide domain={[0, max * 1.2]} />
        <YAxis type="category" dataKey="word" width={140} tick={s.categoryTick} tickLine={false} axisLine={{ stroke: th.ink }} />
        <Tooltip contentStyle={s.tooltip} cursor={{ fill: s.cursorFill }} />
        <Bar dataKey="count" fill={th.accent} radius={[0, 4, 4, 0]} maxBarSize={44} isAnimationActive={false}>
          <LabelList dataKey="count" position="right" style={s.dataLabel} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Every written answer, newest first. */
export function AnswerWall({ texts }: { texts: string[] }) {
  const newestFirst = [...texts].reverse().slice(0, 80);
  return (
    <div className="h-full overflow-y-auto">
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-3">
        {newestFirst.map((t, i) => (
          <li key={i} className="rounded-lg bg-(--de-paper) px-4 py-3 text-lg leading-snug text-(--de-ink) break-words">
            {t.length > 180 ? `${t.slice(0, 179)}…` : t}
          </li>
        ))}
      </ul>
      {texts.length > newestFirst.length && (
        <p className="mt-3 text-sm text-(--de-muted)">Showing the latest {newestFirst.length} of {texts.length}. Download Excel for all.</p>
      )}
    </div>
  );
}
