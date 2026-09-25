// Chart catalog + the aggregation maths behind every Data Exercises chart.
// Pure functions only, so scripts/dev/verify-exercise-charts.ts can check them.

import type { ExerciseField } from "./exerciseSchema";

export type DataKind = "single" | "multi" | "number" | "text" | "time" | "date" | "arrival";

export type ChartTypeId =
  | "bar"
  | "column"
  | "pie"
  | "donut"
  | "waffle"
  | "table"
  | "histogram"
  | "dots"
  | "box"
  | "line"
  | "summary"
  | "cloud"
  | "words"
  | "wall"
  | "timeline"
  | "cumulative";

export const CHART_LABELS: Record<ChartTypeId, string> = {
  bar: "Bars",
  column: "Columns",
  pie: "Pie",
  donut: "Donut",
  waffle: "Waffle",
  table: "Table",
  histogram: "Histogram",
  dots: "Dot plot",
  box: "Box plot",
  line: "Line",
  summary: "Summary",
  cloud: "Word cloud",
  words: "Top words",
  wall: "Answers",
  timeline: "Timeline",
  cumulative: "Running total",
};

// First entry is the default. Pie/donut/waffle only for single choice: with
// multi-select the shares add up to more than 100%, so a pie would mislead.
const OPTIONS: Record<DataKind, ChartTypeId[]> = {
  single: ["bar", "column", "pie", "donut", "waffle", "table"],
  multi: ["bar", "column", "table"],
  number: ["histogram", "dots", "box", "line", "summary"],
  text: ["cloud", "words", "wall"],
  time: ["histogram", "timeline"],
  date: ["histogram", "timeline"],
  arrival: ["histogram", "cumulative", "timeline"],
};

/** Views that aren't an SVG, so "Download chart" can't turn them into a PNG. */
export const NOT_EXPORTABLE = new Set<ChartTypeId>(["table", "wall", "summary"]);

export function dataKindOf(type: ExerciseField["type"]): DataKind | null {
  switch (type) {
    case "multipleChoiceBlock":
      return "single";
    case "checkboxBlock":
      return "multi";
    case "numberAnswerBlock":
      return "number";
    case "shortAnswerBlock":
    case "longAnswerBlock":
      return "text";
    case "timeAnswerBlock":
      return "time";
    case "dateAnswerBlock":
      return "date";
    default:
      return null; // photos, GPS, signatures, email/phone/link aren't charted
  }
}

export const chartOptionsFor = (kind: DataKind) => OPTIONS[kind];
export const defaultChartFor = (kind: DataKind) => OPTIONS[kind][0]!;

// Settings saved by the first version of the editor ("bar" | "pie" | "line" | "number").
const LEGACY: Partial<Record<DataKind, Record<string, ChartTypeId>>> = {
  number: { bar: "histogram", pie: "histogram", number: "summary" },
  text: { bar: "words", pie: "words", number: "wall", line: "wall" },
  time: { bar: "histogram", pie: "histogram", line: "timeline", number: "histogram" },
  date: { bar: "histogram", pie: "histogram", line: "timeline", number: "histogram" },
  single: { line: "bar", number: "table" },
  multi: { line: "bar", number: "table", pie: "bar" },
};

/** The chart to show for a question, or null if the author chose "Don't chart". */
export function resolveChartType(kind: DataKind, configured?: string | null): ChartTypeId | null {
  if (configured === "none") return null;
  if (configured && (OPTIONS[kind] as string[]).includes(configured)) return configured as ChartTypeId;
  return (configured && LEGACY[kind]?.[configured]) || defaultChartFor(kind);
}

// ── Aggregation ──────────────────────────────────────────

export interface Entry {
  data: Record<string, any>;
  loggedAt: number;
}

const isBlank = (v: unknown) => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);

export interface CategoryRow {
  name: string;
  count: number;
  pct: number;
  /** Whole-number % shown everywhere. For single choice these always sum to exactly 100. */
  pctShown: number;
  /** Position in the author's option order; the theme maps it to a colour, so an option keeps its colour across chart types. */
  index: number;
}

/** Largest-remainder rounding: whole numbers that still add up to exactly 100. */
export function roundTo100(values: number[]): number[] {
  const total = values.reduce((a, b) => a + b, 0);
  if (total === 0) return values.map(() => 0);
  const exact = values.map((v) => (v / total) * 100);
  const out = exact.map(Math.floor);
  let left = 100 - out.reduce((a, b) => a + b, 0);
  exact
    .map((v, i) => [v - Math.floor(v), i] as const)
    .sort((a, b) => b[0] - a[0])
    .forEach(([, i]) => {
      if (left-- > 0) out[i]!++;
    });
  return out;
}

export interface CategoryAgg {
  rows: CategoryRow[];
  answered: number;
  multi: boolean;
}

/** Counts per option in the author's order, including options nobody picked. */
export function categoryCounts(field: ExerciseField, entries: Entry[]): CategoryAgg {
  const multi = field.type === "checkboxBlock";
  const names = [...(field.options ?? [])];
  const counts = new Map<string, number>(names.map((n) => [n, 0]));
  let answered = 0;

  for (const entry of entries) {
    const value = entry.data[field.id];
    if (isBlank(value)) continue;
    answered++;
    for (const v of Array.isArray(value) ? value : [value]) {
      const key = String(v);
      if (!counts.has(key)) {
        counts.set(key, 0); // an answer to an option that was renamed or removed
        names.push(key);
      }
      counts.set(key, counts.get(key)! + 1);
    }
  }

  // Single choice: shares add up to 100, so round them so they visibly do. Multi-select
  // shares are independent ("% of people who picked it"), so each rounds on its own.
  const values = names.map((n) => counts.get(n)!);
  const shown = multi ? values.map((c) => (answered ? Math.round((c / answered) * 100) : 0)) : roundTo100(values);

  return {
    multi,
    answered,
    rows: names.map((name, i) => ({
      name,
      count: values[i]!,
      pct: answered ? (values[i]! / answered) * 100 : 0,
      pctShown: shown[i]!,
      index: i,
    })),
  };
}

export function numericValues(entries: Entry[], fieldId: string): number[] {
  const out: number[] = [];
  for (const entry of entries) {
    const v = entry.data[fieldId];
    if (isBlank(v)) continue;
    const n = Number(v);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

export function textValues(entries: Entry[], fieldId: string): string[] {
  return entries.map((e) => e.data[fieldId]).filter((v) => typeof v === "string" && v.trim() !== "");
}

export interface Bin {
  /** Short label for the axis. */
  label: string;
  /** Full range for sentences, e.g. "10–14" or "9:00–9:05". */
  range: string;
  count: number;
}

/** Nearest of 1/2/5×10ⁿ — nearest, not next-up, so a small dataset doesn't collapse into 3 bars. */
function niceStep(raw: number): number {
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * pow;
}

const trim = (n: number) => String(Number(n.toFixed(2)));

/** Equal-width bins from `start`, `step` wide, covering every value (last bin includes max). */
function linearBins(values: number[], start: number, step: number, fmt: (a: number, b: number) => [string, string]): Bin[] {
  const max = Math.max(...values);
  const bins: Bin[] = [];
  for (let a = start; a <= max; a += step) {
    const [label, range] = fmt(a, a + step);
    bins.push({ label, range, count: 0 });
  }
  for (const v of values) {
    const i = Math.min(Math.floor((v - start) / step), bins.length - 1);
    bins[i]!.count++;
  }
  return bins;
}

export function numberBins(values: number[]): Bin[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const allInt = values.every(Number.isInteger);

  // Small whole-number range: one bar per value, so students can read "how many said 3".
  if (allInt && max - min <= 14) {
    return linearBins(values, min, 1, (a) => [String(a), String(a)]);
  }
  if (min === max) return [{ label: trim(min), range: trim(min), count: values.length }];

  const target = Math.min(12, Math.max(5, Math.ceil(Math.log2(values.length) + 1)));
  let step = niceStep((max - min) / target);
  if (allInt) step = Math.max(1, Math.round(step));
  const start = Math.floor(min / step) * step;
  return linearBins(values, start, step, (a, b) => {
    const r = allInt ? `${a}–${b - 1}` : `${trim(a)}–${trim(b)}`;
    return [r, r];
  });
}

export interface NumberStats {
  n: number;
  mean: number;
  median: number;
  q1: number;
  q3: number;
  min: number;
  max: number;
  /** Empty when every value is equally common, i.e. there's no mode. */
  modes: number[];
}

const medianOf = (sorted: number[]) => {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};

/** Quartiles by the median-of-halves method taught in school (median excluded when n is odd). */
export function numberStats(values: number[]): NumberStats | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const half = Math.floor(s.length / 2);
  const lower = s.slice(0, half);
  const upper = s.slice(s.length % 2 ? half + 1 : half);

  const freq = new Map<number, number>();
  for (const v of s) freq.set(v, (freq.get(v) || 0) + 1);
  const top = Math.max(...freq.values());
  const modes = top > 1 ? [...freq.entries()].filter(([, c]) => c === top).map(([v]) => v) : [];

  return {
    n: s.length,
    mean: s.reduce((a, b) => a + b, 0) / s.length,
    median: medianOf(s),
    q1: lower.length ? medianOf(lower) : s[0]!,
    q3: upper.length ? medianOf(upper) : s[s.length - 1]!,
    min: s[0]!,
    max: s[s.length - 1]!,
    modes,
  };
}

/** "09:05" → 545 (minutes after midnight). */
export function parseTime(v: unknown): number | null {
  const m = typeof v === "string" ? /^(\d{1,2}):(\d{2})/.exec(v) : null;
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

/** "2026-09-25" → days since 1970-01-01 (UTC, so no timezone drift). */
export function parseDate(v: unknown): number | null {
  const m = typeof v === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(v) : null;
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000;
}

const clock = (minutes: number) => {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
};

function minuteStep(spanMinutes: number) {
  return spanMinutes <= 30 ? 1 : spanMinutes <= 180 ? 5 : spanMinutes <= 720 ? 15 : 60;
}

/** Time-of-day answers ("07:30"), in minutes after midnight. Step chosen for ~12 bars or fewer. */
export function timeBins(minutes: number[]): Bin[] {
  if (minutes.length === 0) return [];
  const span = Math.max(...minutes) - Math.min(...minutes);
  const step = [5, 10, 15, 30, 60, 120, 180].find((s) => span / s <= 12) ?? 240;
  const start = Math.floor(Math.min(...minutes) / step) * step;
  return linearBins(minutes, start, step, (a, b) => [clock(a), `${clock(a)}–${clock(b)}`]);
}

const DAY_FMT: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", timeZone: "UTC" };
const fmtDay = (day: number) => new Date(day * 86_400_000).toLocaleDateString("en-GB", DAY_FMT);

const dateStep = (days: number[]) => {
  const span = Math.max(...days) - Math.min(...days);
  return span <= 31 ? 1 : span <= 180 ? 7 : 30;
};

/** Date answers, in days since epoch: per day, then per week, then per 30 days as the span grows. */
export function dateBins(days: number[]): Bin[] {
  if (days.length === 0) return [];
  const step = dateStep(days);
  const start = Math.min(...days);
  return linearBins(days, start, step, (a, b) =>
    step === 1 ? [fmtDay(a), fmtDay(a)] : [fmtDay(a), `${fmtDay(a)}–${fmtDay(b - 1)}`],
  );
}

/** Entry timestamps (ms): per minute, widening to 5/15/60 minutes for long sessions. */
export function arrivalBins(timestamps: number[]): { bins: Bin[]; stepMinutes: number } {
  if (timestamps.length === 0) return { bins: [], stepMinutes: 1 };
  const MIN = 60_000;
  const first = Math.min(...timestamps);
  const step = minuteStep((Math.max(...timestamps) - first) / MIN);
  const localClock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const start = Math.floor(first / (step * MIN)) * step * MIN;
  const bins = linearBins(timestamps, start, step * MIN, (a, b) => [
    localClock(a),
    step === 1 ? localClock(a) : `${localClock(a)}–${localClock(b)}`,
  ]);
  return { bins, stepMinutes: step };
}

const STOPWORDS = new Set(
  (
    "a an and are as at be but by for from has have he her his i in is it its me my of on or our she so that the " +
    "their them they this to too very was we were what when which who will with you your im its not no yes do did " +
    "just really about all am been can could if into more than then there these those us would should"
  ).split(" "),
);

export function wordFrequencies(texts: string[]): { word: string; count: number }[] {
  const freq = new Map<string, number>();
  for (const t of texts) {
    for (const raw of t.toLowerCase().replace(/[’']/g, "").split(/[^\p{L}\p{N}]+/u)) {
      if (raw.length < 2 || STOPWORDS.has(raw)) continue;
      freq.set(raw, (freq.get(raw) || 0) + 1);
    }
  }
  return [...freq.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
}

// ── Summaries: everything a question panel needs, computed once ──

export type Summary =
  | { kind: "single" | "multi"; answered: number; takeaway: string; agg: CategoryAgg }
  | { kind: "number"; answered: number; takeaway: string; values: number[]; bins: Bin[]; stats: NumberStats | null }
  | { kind: "text"; answered: number; takeaway: string; texts: string[]; words: { word: string; count: number }[] }
  | { kind: "time" | "date"; answered: number; takeaway: string; bins: Bin[] }
  | { kind: "arrival"; answered: number; takeaway: string; bins: Bin[]; timestamps: number[]; stepMinutes: number };

const joinNames = (names: string[]) =>
  names.length <= 2 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

export function categoryTakeaway(agg: CategoryAgg): string {
  const top = Math.max(0, ...agg.rows.map((r) => r.count));
  if (top === 0) return "";
  const leaders = agg.rows.filter((r) => r.count === top);
  if (leaders.length > 1) return `Tie: ${joinNames(leaders.map((r) => r.name))} (${top} each)`;
  const r = leaders[0]!;
  return agg.multi
    ? `Most picked: ${r.name}, chosen by ${r.count} of ${agg.answered} people (${r.pctShown}%)`
    : `Most chosen: ${r.name}, ${r.count} of ${agg.answered} (${r.pctShown}%)`;
}

export function numberTakeaway(stats: NumberStats | null): string {
  if (!stats) return "";
  const one = (n: number) => String(Number(n.toFixed(1)));
  if (stats.n === 1) return `One answer so far: ${one(stats.min)}`;
  return `Average ${one(stats.mean)} · middle value ${one(stats.median)} · from ${one(stats.min)} to ${one(stats.max)}`;
}

export function wordsTakeaway(words: { word: string; count: number }[]): string {
  if (words.length === 0) return "";
  const top = words[0]!;
  if (top.count === 1) return `${words.length} different words so far`;
  const tied = words.filter((w) => w.count === top.count).map((w) => `"${w.word}"`);
  return tied.length > 1
    ? `Most used words: ${joinNames(tied)} (${top.count} times each)`
    : `Most used word: ${tied[0]} (${top.count} times)`;
}

export function binTakeaway(bins: Bin[], what: string, unit?: string): string {
  const top = Math.max(0, ...bins.map((b) => b.count));
  if (top === 0) return "";
  const leaders = bins.filter((b) => b.count === top);
  const noun = unit ? ` ${top === 1 ? unit : `${unit}s`}` : "";
  if (leaders.length > 2) return `${leaders.length} ${what}s tied for busiest (${top}${noun} each)`;
  return `Busiest ${what}: ${joinNames(leaders.map((b) => b.range))} (${top}${noun}${leaders.length > 1 ? " each" : ""})`;
}

export function summarize(kind: DataKind, field: ExerciseField | null, entries: Entry[]): Summary {
  if (kind === "arrival" || !field) {
    const timestamps = entries.map((e) => e.loggedAt).sort((a, b) => a - b);
    const { bins, stepMinutes } = arrivalBins(timestamps);
    const what = stepMinutes === 1 ? "minute" : `${stepMinutes} minutes`;
    return { kind: "arrival", answered: timestamps.length, timestamps, bins, stepMinutes, takeaway: binTakeaway(bins, what, "arrival") };
  }

  switch (kind) {
    case "single":
    case "multi": {
      const agg = categoryCounts(field, entries);
      return { kind, answered: agg.answered, agg, takeaway: categoryTakeaway(agg) };
    }
    case "number": {
      const values = numericValues(entries, field.id);
      const stats = numberStats(values);
      return { kind, answered: values.length, values, bins: numberBins(values), stats, takeaway: numberTakeaway(stats) };
    }
    case "text": {
      const texts = textValues(entries, field.id);
      const words = wordFrequencies(texts);
      return { kind, answered: texts.length, texts, words, takeaway: wordsTakeaway(words) };
    }
    case "time": {
      const mins = entries.map((e) => parseTime(e.data[field.id])).filter((v): v is number => v !== null);
      const bins = timeBins(mins);
      return { kind, answered: mins.length, bins, takeaway: binTakeaway(bins, "time") };
    }
    case "date": {
      const days = entries.map((e) => parseDate(e.data[field.id])).filter((v): v is number => v !== null);
      const bins = dateBins(days);
      const what = !days.length || dateStep(days) === 1 ? "date" : dateStep(days) === 7 ? "week" : "month";
      return { kind, answered: days.length, bins, takeaway: binTakeaway(bins, what) };
    }
  }
}

/** "Pick one · 18 of 21 answered" and friends, for under the question title. */
export function metaLine(kind: DataKind, answered: number, total: number): string {
  const answers = answered === total ? `${total} ${total === 1 ? "answer" : "answers"}` : `${answered} of ${total} answered`;
  switch (kind) {
    case "single":
      return `Pick one · ${answers}`;
    case "multi":
      return `Pick any · ${answers} · totals can add up to more than ${answered}`;
    case "number":
      return `A number · ${answers}`;
    case "text":
      return `Written answers · ${answers}`;
    case "time":
      return `A time of day · ${answers}`;
    case "date":
      return `A date · ${answers}`;
    case "arrival":
      return `One per tap of Log entry · ${total} ${total === 1 ? "entry" : "entries"}`;
  }
}
