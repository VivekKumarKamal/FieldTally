/**
 * Checks the Data Exercises chart maths in apps/web/src/lib/exerciseCharts.ts —
 * the numbers students will be shown on a projector.
 *
 * Run: npx tsx scripts/dev/verify-exercise-charts.ts
 */
import {
  categoryCounts,
  categoryTakeaway,
  numberBins,
  numberStats,
  numberTakeaway,
  parseTime,
  parseDate,
  timeBins,
  dateBins,
  arrivalBins,
  wordFrequencies,
  wordsTakeaway,
  resolveChartType,
  chartOptionsFor,
  summarize,
  type Entry,
} from "../../apps/web/src/lib/exerciseCharts";
import type { ExerciseField } from "../../apps/web/src/lib/exerciseSchema";

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n      expected ${JSON.stringify(expected)}\n      got      ${JSON.stringify(actual)}`}`);
}

const e = (data: Record<string, any>, loggedAt = 0): Entry => ({ data, loggedAt });

// ── Categories ──
const mood: ExerciseField = { id: "mood", type: "multipleChoiceBlock", label: "Mood", required: false, options: ["Great", "Okay", "Stressed"] };
const moodAgg = categoryCounts(mood, [e({ mood: "Okay" }), e({ mood: "Great" }), e({ mood: "Okay" }), e({})]);
check("single: authored order kept, zero-count option included", moodAgg.rows.map((r) => [r.name, r.count]), [["Great", 1], ["Okay", 2], ["Stressed", 0]]);
check("single: blank answers don't count as answered", moodAgg.answered, 3);
check("single: % of people who answered", Math.round(moodAgg.rows[1]!.pct), 67);
check("single: an option keeps its colour slot whatever the answers", moodAgg.rows.map((r) => r.index), categoryCounts(mood, []).rows.map((r) => r.index));
check("single: takeaway", categoryTakeaway(moodAgg), "Most chosen: Okay, 2 of 3 (67%)");
check("single: tie wording", categoryTakeaway(categoryCounts(mood, [e({ mood: "Okay" }), e({ mood: "Great" })])), "Tie: Great and Okay (1 each)");
check("single: nothing answered → no takeaway", categoryTakeaway(categoryCounts(mood, [])), "");
check("single: answer to a removed option still shown", categoryCounts(mood, [e({ mood: "Sleepy" })]).rows.map((r) => r.name), ["Great", "Okay", "Stressed", "Sleepy"]);

const moodCounts = [...Array(10).fill("Great"), ...Array(9).fill("Okay"), ...Array(5).fill("Stressed")].map((m) => e({ mood: m }));
const shown = categoryCounts(mood, moodCounts).rows.map((r) => r.pctShown);
check("single: shown % add up to exactly 100 (10/9/5 of 24 → 42/37/21, not 42/38/21)", [shown, shown.reduce((a, b) => a + b, 0)], [[42, 37, 21], 100]);

const travel: ExerciseField ={ id: "t", type: "checkboxBlock", label: "Travel", required: false, options: ["Walk", "Bus"] };
const travelAgg = categoryCounts(travel, [e({ t: ["Walk", "Bus"] }), e({ t: ["Walk"] })]);
check("multi: % base is people, so shares can exceed 100% in total", travelAgg.rows.map((r) => r.pct), [100, 50]);
check("multi: takeaway", categoryTakeaway(travelAgg), "Most picked: Walk, chosen by 2 of 2 people (100%)");

// ── Numbers ──
check("bins: small whole-number range → one bar per value", numberBins([1, 3, 3, 5]).map((b) => [b.label, b.count]), [["1", 1], ["2", 0], ["3", 2], ["4", 0], ["5", 1]]);
const wide = numberBins([5, 12, 18, 25, 29, 40, 51, 60]);
check("bins: wide range → ranged bins covering every value", wide.reduce((a, b) => a + b.count, 0), 8);
check("bins: ranged labels are inclusive whole numbers", wide[0]!.label, "0–9");
check("bins: all identical decimals → one bin", numberBins([2.5, 2.5]).map((b) => [b.label, b.count]), [["2.5", 2]]);
check("bins: empty", numberBins([]), []);

const odd = numberStats([7, 1, 3, 9, 5])!;
check("stats odd n: median/quartiles (median excluded from halves)", [odd.median, odd.q1, odd.q3], [5, 2, 8]);
const even = numberStats([1, 2, 3, 4, 5, 6])!;
check("stats even n: median/quartiles", [even.median, even.q1, even.q3], [3.5, 2, 5]);
check("stats: no mode when all values unique", even.modes, []);
check("stats: bimodal", numberStats([1, 1, 2, 2, 3])!.modes, [1, 2]);
check("number takeaway", numberTakeaway(numberStats([5, 10, 15])), "Average 10 · middle value 10 · from 5 to 15");
check("summary: non-numeric answers ignored", summarize("number", { id: "n", type: "numberAnswerBlock", label: "", required: false }, [e({ n: "4" }), e({ n: "abc" }), e({})]).answered, 1);

// ── Time & date ──
check("parseTime", [parseTime("09:05"), parseTime("23:59"), parseTime("24:00"), parseTime("")], [545, 1439, null, null]);
check("time bins: 5-minute steps for a short span", timeBins([540, 542, 551]).map((b) => [b.range, b.count]), [["9:00–9:05", 2], ["9:05–9:10", 0], ["9:10–9:15", 1]]);
check("parseDate", [parseDate("1970-01-02"), parseDate("2026-13-99x")], [1, null]);
check("date bins: per day for a short span", dateBins([parseDate("2026-09-01")!, parseDate("2026-09-01")!, parseDate("2026-09-03")!]).map((b) => b.count), [2, 0, 1]);
check("date bins: per week for a long span", dateBins([0, 100]).length, 15);
check("time bins: 2-hour spread → 10-minute steps, ≤12 bars", timeBins([360, 400, 479]).map((b) => b.label), ["6:00", "6:10", "6:20", "6:30", "6:40", "6:50", "7:00", "7:10", "7:20", "7:30", "7:40", "7:50"]);
const weekly = summarize("date", { id: "d", type: "dateAnswerBlock", label: "", required: false }, [e({ d: "2026-01-01" }), e({ d: "2026-03-01" })]);
check("date takeaway says 'week' when grouped by week", weekly.takeaway.startsWith("Busiest week"), true);

const t0 = Date.UTC(2026, 8, 25, 9, 0, 0);
const arr = arrivalBins([t0, t0 + 10_000, t0 + 125_000]);
check("arrivals: per minute, empty minutes kept", [arr.stepMinutes, arr.bins.map((b) => b.count)], [1, [2, 0, 1]]);
check("arrivals: 5-minute steps for a long session", arrivalBins([t0, t0 + 90 * 60_000]).stepMinutes, 5);
check("arrival takeaway", summarize("arrival", null, [e({}, t0), e({}, t0 + 1000)]).takeaway.startsWith("Busiest minute:"), true);

// ── Words ──
const words = wordFrequencies(["I am so happy!", "Happy and tired", "TIRED, happy"]);
check("words: lowercased, punctuation + stopwords removed", words, [{ word: "happy", count: 3 }, { word: "tired", count: 2 }]);
check("words takeaway", wordsTakeaway(words), 'Most used word: "happy" (3 times)');
check("words: all unique", wordsTakeaway(wordFrequencies(["red", "blue"])), "2 different words so far");

// ── Chart catalog ──
check("no pie for multi-select", chartOptionsFor("multi").includes("pie"), false);
check("histogram only for numbers/times/dates/arrivals", (["single", "multi", "text"] as const).some((k) => chartOptionsFor(k).includes("histogram")), false);
check("resolve: valid choice kept", resolveChartType("single", "donut"), "donut");
check("resolve: none hides", resolveChartType("number", "none"), null);
check("resolve: missing → default", resolveChartType("number", undefined), "histogram");
check("resolve: legacy 'number' on a number question → summary", resolveChartType("number", "number"), "summary");
check("resolve: legacy 'bar' on single choice → bars", resolveChartType("single", "bar"), "bar");
check("resolve: invalid for kind → default", resolveChartType("multi", "pie"), "bar");

console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
