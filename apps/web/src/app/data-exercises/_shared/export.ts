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

// Serializes an inline SVG (e.g. a Recharts chart) to a PNG and triggers a download.
export function exportSvgAsPng(svgEl: SVGSVGElement, filename = "chart.png") {
  const { width, height } = svgEl.getBoundingClientRect();
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));

  const svgData = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.onload = () => {
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, width, height);
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
