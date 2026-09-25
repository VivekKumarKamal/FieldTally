"use client";

import type { ChartTypeId, Summary } from "@/lib/exerciseCharts";
import CategoryChart from "./CategoryChart";
import { BinHistogram, CumulativeChart, DotStack } from "./BinCharts";
import { BoxPlot, NumberLine, NumberSummary } from "./NumberCharts";
import { AnswerWall, TopWords, WordCloud } from "./TextCharts";

function Waiting({ label }: { label: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-3 text-(--de-muted)">
      <div className="flex gap-1.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className="w-2 h-2 rounded-full bg-(--de-muted) animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
        ))}
      </div>
      <p className="text-base">{label}</p>
    </div>
  );
}

export default function ChartView({ summary, type }: { summary: Summary; type: ChartTypeId }) {
  if (summary.answered === 0) {
    return <Waiting label={summary.kind === "arrival" ? "Waiting for the first entry" : "Waiting for the first answer"} />;
  }

  switch (summary.kind) {
    case "single":
    case "multi":
      return <CategoryChart agg={summary.agg} type={type} />;

    case "number":
      if (type === "dots") return <DotStack bins={summary.bins} />;
      if (type === "box" && summary.stats) return <BoxPlot stats={summary.stats} values={summary.values} />;
      if (type === "line") return <NumberLine values={summary.values} />;
      if (type === "summary" && summary.stats) return <NumberSummary stats={summary.stats} />;
      return <BinHistogram bins={summary.bins} />;

    case "text":
      if (type === "words") return <TopWords words={summary.words} />;
      if (type === "wall") return <AnswerWall texts={summary.texts} />;
      return summary.words.length ? <WordCloud words={summary.words} /> : <AnswerWall texts={summary.texts} />;

    case "time":
    case "date":
      return type === "timeline" ? <DotStack bins={summary.bins} /> : <BinHistogram bins={summary.bins} />;

    case "arrival":
      if (type === "cumulative") return <CumulativeChart timestamps={summary.timestamps} />;
      if (type === "timeline") return <DotStack bins={summary.bins} />;
      return <BinHistogram bins={summary.bins} yLabel="Arrivals" />;
  }
}
