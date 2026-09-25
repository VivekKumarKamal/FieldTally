import * as XLSX from "xlsx";
import type { ExerciseField } from "@/lib/exerciseSchema";

export interface ExportableEntry {
  loggedAt: number;
  data: Record<string, any>;
}

export function exportEntriesToExcel(entries: ExportableEntry[], fields: ExerciseField[], filename = "exercise-entries.xlsx") {
  const rows = entries.map((entry, i) => {
    const row: Record<string, any> = { "#": i + 1, Timestamp: new Date(entry.loggedAt).toLocaleString() };
    for (const field of fields) {
      const value = entry.data[field.id];
      row[field.label] = Array.isArray(value) ? value.join(", ") : (value ?? "");
    }
    return row;
  });
  const sheet = XLSX.utils.json_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Entries");
  XLSX.writeFile(book, filename);
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Serializes an inline SVG chart to a PNG and triggers a download. With a
 * header, the question and takeaway are drawn above the chart so the image
 * makes sense on its own in a slide or worksheet.
 */
export function exportSvgAsPng(
  svgEl: SVGSVGElement,
  filename = "chart.png",
  header?: { title: string; subtitle?: string; background?: string; ink?: string; muted?: string },
) {
  const { width, height } = svgEl.getBoundingClientRect();
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));

  // CSS variables don't exist inside an SVG rendered as an image; swap in real font stacks.
  const rootStyle = getComputedStyle(document.documentElement);
  const sans = `${rootStyle.getPropertyValue("--font-geist-sans").trim() || "system-ui"}, system-ui, sans-serif`;
  const mono = `${rootStyle.getPropertyValue("--font-geist-mono").trim() || "ui-monospace"}, ui-monospace, monospace`;
  const svgData = new XMLSerializer()
    .serializeToString(clone)
    .replace(/var\(--font-geist-sans\)/g, sans.replace(/"/g, "'"))
    .replace(/var\(--font-geist-mono\)/g, mono.replace(/"/g, "'"));
  const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.onload = () => {
    const scale = 2;
    const pad = 32;
    const measure = document.createElement("canvas").getContext("2d")!;
    measure.font = `600 28px ${sans}`;
    const titleLines = header ? wrapLines(measure, header.title, width - pad * 2) : [];
    const headerH = header ? pad + titleLines.length * 36 + (header.subtitle ? 30 : 0) + 16 : 0;

    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = (height + headerH) * scale;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = header?.background ?? "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);

    if (header) {
      ctx.fillStyle = header.ink ?? "#16140F";
      ctx.font = `600 28px ${sans}`;
      titleLines.forEach((line, i) => ctx.fillText(line, pad, pad + 26 + i * 36));
      if (header.subtitle) {
        ctx.fillStyle = header.muted ?? "#6B665C";
        ctx.font = `16px ${sans}`;
        ctx.fillText(header.subtitle, pad, pad + titleLines.length * 36 + 20);
      }
    }

    ctx.drawImage(img, 0, headerH, width, height);
    URL.revokeObjectURL(url);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
    });
  };
  img.src = url;
}
