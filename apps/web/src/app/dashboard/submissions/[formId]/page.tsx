"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  FileSpreadsheet,
  FileJson,
  FileText,
  ChevronDown,
  Inbox,
  Loader2,
  BarChart3,
  PieChart,
} from "lucide-react";
import { supabase } from "../../../../lib/supabase";

// ─── Types ────────────────────────────────────────────────

type FormVersion = {
  id: string;
  version: number;
  title: string;
  content: any;
  created_at: string | null;
};

type Submission = {
  id: string;
  form_version: number;
  submitted_by: string | null;
  data: Record<string, any>;
  filled_at: string | null;
  synced_at: string | null;
};

type QuestionColumn = {
  id: string;
  label: string;
  type: string;
  options?: string[];
};

// ─── Helpers ──────────────────────────────────────────────

function extractNodeOptions(node: any): string[] {
  if (!node.content) return [];
  const optionTypes = ["checkboxOption", "multipleChoiceOption"];
  return node.content
    .filter((c: any) => optionTypes.includes(c.type))
    .map((opt: any) => extractTextFromContent(opt.content).trim())
    .filter(Boolean);
}

/** Extract the question columns from a form version's content schema */
function extractColumns(content: any): QuestionColumn[] {
  if (!content?.content) return [];
  const cols: QuestionColumn[] = [];
  for (const node of content.content) {
    const id = node.attrs?.id;
    if (!id) continue;
    // Skip logic blocks — they aren't questions
    if (node.type === "logicBlock") continue;

    const label = extractQuestionText(node);
    if (label) {
      const options = (node.type === "checkboxBlock" || node.type === "multipleChoiceBlock")
        ? extractNodeOptions(node)
        : undefined;
      cols.push({ id, label, type: node.type, options });
    }
  }
  return cols;
}

/** Pull plain-text question label from a node's content tree */
function extractQuestionText(node: any): string {
  // For checkbox and multiple choice blocks, look for the title subnode
  if (node.type === "checkboxBlock") {
    const titleNode = node.content?.find((c: any) => c.type === "checkboxTitle");
    return extractTextFromContent(titleNode?.content) || "Checkbox";
  }
  if (node.type === "multipleChoiceBlock") {
    const titleNode = node.content?.find((c: any) => c.type === "multipleChoiceTitle");
    return extractTextFromContent(titleNode?.content) || "Multiple Choice";
  }
  // For other question types, the question text is in node.content
  return extractTextFromContent(node.content) || node.type.replace(/Block$/, "");
}

function extractTextFromContent(content?: any[]): string {
  if (!content) return "";
  return content
    .map((n: any) => {
      if (n.type === "text") return n.text || "";
      if (n.content) return extractTextFromContent(n.content);
      return "";
    })
    .join("");
}

/** Format a cell value for display */
function formatCellValue(val: any): string {
  if (val == null || val === "") return "—";
  if (Array.isArray(val)) return val.join(", ");
  if (typeof val === "object" && val.latitude != null && val.longitude != null) {
    return `${val.latitude.toFixed(6)}, ${val.longitude.toFixed(6)}`;
  }
  if (typeof val === "string" && val.startsWith("http") && val.includes("fieldtally")) {
    if (val.includes("signature") || val.endsWith(".png")) {
      return "Signature Captured";
    }
    return "Image File";
  }
  return String(val);
}

/** Format date/time for table */
function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Export utilities ─────────────────────────────────────

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeCSV(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function exportCSV(
  columns: QuestionColumn[],
  submissions: Submission[],
  formTitle: string,
  version: number
) {
  const headers = ["#", "Submitted At", ...columns.map((c) => c.label)];
  const rows = submissions.map((s, i) => [
    String(i + 1),
    formatDateTime(s.filled_at),
    ...columns.map((c) => formatCellValue(s.data[c.id])),
  ]);
  const csv = [headers.map(escapeCSV).join(","), ...rows.map((r) => r.map(escapeCSV).join(","))].join("\n");
  downloadFile(`${formTitle}_v${version}_submissions.csv`, csv, "text/csv;charset=utf-8;");
}

function exportJSON(
  columns: QuestionColumn[],
  submissions: Submission[],
  formTitle: string,
  version: number
) {
  const data = submissions.map((s, i) => {
    const row: Record<string, any> = {
      "#": i + 1,
      "Submitted At": formatDateTime(s.filled_at),
    };
    for (const col of columns) {
      row[col.label] = s.data[col.id] ?? null;
    }
    return row;
  });
  const json = JSON.stringify(data, null, 2);
  downloadFile(`${formTitle}_v${version}_submissions.json`, json, "application/json");
}

async function exportExcel(
  columns: QuestionColumn[],
  submissions: Submission[],
  formTitle: string,
  version: number
) {
  try {
    const XLSX = await import("xlsx");
    const headers = ["#", "Submitted At", ...columns.map((c) => c.label)];
    const rows = submissions.map((s, i) => [
      i + 1,
      formatDateTime(s.filled_at),
      ...columns.map((c) => formatCellValue(s.data[c.id])),
    ]);

    const worksheetData = [headers, ...rows];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Submissions");

    XLSX.writeFile(workbook, `${formTitle}_v${version}_submissions.xlsx`);
  } catch (err) {
    console.error("Failed to export to Excel:", err);
    alert("Failed to export to Excel. Please try again.");
  }
}

// ─── Analytics Charting Components ─────────────────────────

const CHART_COLORS = [
  "#3b82f6", // Blue
  "#10b981", // Emerald
  "#6366f1", // Indigo
  "#f59e0b", // Amber
  "#ec4899", // Pink
  "#8b5cf6", // Violet
  "#14b8a6", // Teal
  "#ef4444", // Red
];

function getChartData(col: QuestionColumn, submissions: Submission[]) {
  const counts: Record<string, number> = {};

  if (col.options) {
    for (const opt of col.options) {
      counts[opt] = 0;
    }
  }

  let totalResponses = 0;

  for (const sub of submissions) {
    const val = sub.data[col.id];
    if (val == null || val === "") continue;

    if (Array.isArray(val)) {
      for (const item of val) {
        if (item) {
          counts[item] = (counts[item] || 0) + 1;
          totalResponses++;
        }
      }
    } else {
      let item = "";
      if (typeof val === "object" && val.latitude != null && val.longitude != null) {
        item = `Lat: ${val.latitude.toFixed(4)}, Lng: ${val.longitude.toFixed(4)}`;
      } else if (typeof val === "string" && val.startsWith("http") && val.includes("fieldtally")) {
        item = (val.includes("signature") || val.endsWith(".png")) ? "Signature Captured" : "Image File";
      } else {
        item = String(val);
      }
      counts[item] = (counts[item] || 0) + 1;
      totalResponses++;
    }
  }

  const data = Object.entries(counts).map(([label, value]) => ({
    label,
    value,
  }));

  if (col.options) {
    data.sort((a, b) => col.options!.indexOf(a.label) - col.options!.indexOf(b.label));
  } else {
    data.sort((a, b) => b.value - a.value);
  }

  if (!col.options) {
    if (data.length > 6) {
      const top = data.slice(0, 5);
      const rest = data.slice(5);
      const otherValue = rest.reduce((sum, item) => sum + item.value, 0);
      return {
        data: [...top, { label: "Other", value: otherValue }],
        total: totalResponses,
      };
    }
  }

  return {
    data: data.filter(d => d.value > 0 || col.options),
    total: totalResponses,
  };
}

type BarChartProps = {
  data: { label: string; value: number }[];
  total: number;
};

function BarChart({ data, total }: BarChartProps) {
  const chartData = useMemo(() => data.filter(d => d.value > 0), [data]);
  const totalSubmissions = useMemo(() => chartData.reduce((sum, d) => sum + d.value, 0), [chartData]);

  if (totalSubmissions === 0) {
    return (
      <div className="h-44 flex items-center justify-center text-zinc-400 text-xs font-medium">
        No answers submitted for this question
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 py-2 pr-1">
      {chartData.map((d, index) => {
        const pct = Math.round((d.value / totalSubmissions) * 100);
        return (
          <div key={index} className="flex flex-col gap-1">
            <div className="flex justify-between items-center text-xs">
              <span className="truncate pr-4 text-zinc-600" title={d.label}>{d.label}</span>
              <span className="font-semibold text-zinc-800 shrink-0">
                {d.value} ({pct}%)
              </span>
            </div>
            <div className="w-full bg-zinc-100 rounded-full h-2">
              <div
                className="h-2 rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

type DonutChartProps = {
  data: { label: string; value: number }[];
  total: number;
};

function DonutChart({ data, total }: DonutChartProps) {
  const radius = 40;
  const strokeWidth = 12;
  const circumference = 2 * Math.PI * radius; // ~251.327

  let accumulatedPercent = 0;

  const chartData = useMemo(() => data.filter(d => d.value > 0), [data]);
  const totalSubmissions = useMemo(() => chartData.reduce((sum, d) => sum + d.value, 0), [chartData]);

  if (totalSubmissions === 0) {
    return (
      <div className="h-44 flex items-center justify-center text-zinc-400 text-xs font-medium">
        No answers submitted for this question
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6 py-2">
      <div className="relative w-36 h-36 flex-shrink-0">
        <svg width="100%" height="100%" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="transparent"
            stroke="#f4f4f5"
            strokeWidth={strokeWidth}
          />
          {chartData.map((d, index) => {
            const percent = d.value / totalSubmissions;
            const strokeLength = percent * circumference;
            const strokeOffset = -accumulatedPercent * circumference;
            accumulatedPercent += percent;

            return (
              <circle
                key={index}
                cx="50"
                cy="50"
                r={radius}
                fill="transparent"
                stroke={CHART_COLORS[index % CHART_COLORS.length]}
                strokeWidth={strokeWidth}
                strokeDasharray={`${strokeLength} ${circumference}`}
                strokeDashoffset={strokeOffset}
                transform="rotate(-90 50 50)"
                className="transition-all duration-350 ease-out"
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-extrabold text-zinc-800 leading-none">{totalSubmissions}</span>
          <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mt-1">Total</span>
        </div>
      </div>

      <div className="flex-1 w-full flex flex-col gap-1.5 pr-1">
        {chartData.map((d, index) => {
          const pct = Math.round((d.value / totalSubmissions) * 100);
          return (
            <div key={index} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                />
                <span className="truncate text-zinc-600" title={d.label}>{d.label}</span>
              </div>
              <span className="font-semibold text-zinc-800 shrink-0 ml-2">
                {d.value} ({pct}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Utility to draw rounded rectangles on canvas
function drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  if (width < 2 * radius) radius = width / 2;
  if (height < 2 * radius) radius = height / 2;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function exportChartToJPEG(col: QuestionColumn, data: { label: string; value: number }[], total: number, chartType: "bar" | "donut") {
  const canvas = document.createElement("canvas");
  const scale = 2;
  const width = 600 * scale;
  const height = 400 * scale;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.scale(scale, scale);

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 600, 400);

  // Border
  ctx.strokeStyle = "#e4e4e7";
  ctx.lineWidth = 1;
  ctx.strokeRect(10, 10, 580, 380);

  // Question Title
  ctx.fillStyle = "#18181b";
  ctx.font = "bold 16px Inter, system-ui, sans-serif";
  
  const title = col.label;
  const words = title.split(" ");
  let line = "";
  let y = 42;
  const maxWidth = 540;
  const lineHeight = 22;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + " ";
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line, 30, y);
      line = words[n] + " ";
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, 30, y);
  
  y += 18;
  ctx.fillStyle = "#a1a1aa";
  ctx.font = "bold 10px Inter, system-ui, sans-serif";
  ctx.fillText(col.type.replace(/Block$/, "").replace(/([A-Z])/g, " $1").toUpperCase(), 30, y);

  y += 30;

  const colors = [
    "#3b82f6", // Blue
    "#10b981", // Emerald
    "#6366f1", // Indigo
    "#f59e0b", // Amber
    "#ec4899", // Pink
    "#8b5cf6", // Violet
    "#14b8a6", // Teal
    "#ef4444", // Red
  ];

  const activeData = data.filter(d => d.value > 0);
  const totalSubmissions = activeData.reduce((sum, d) => sum + d.value, 0);

  if (totalSubmissions === 0) {
    ctx.fillStyle = "#71717a";
    ctx.font = "medium 14px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("No answers submitted for this question", 300, y + 100);
    downloadJPEG();
    return;
  }

  if (chartType === "bar") {
    const barStartX = 30;
    const barWidth = 540;
    const barHeight = 12;
    const spacing = 45;

    activeData.forEach((d, index) => {
      const pct = d.value / totalSubmissions;
      const displayPct = Math.round(pct * 100);
      const currentY = y + index * spacing;

      if (currentY > 370) return;

      ctx.fillStyle = "#3f3f46";
      ctx.font = "medium 12px Inter, system-ui, sans-serif";
      ctx.textAlign = "left";
      
      let label = d.label;
      const maxLabelWidth = 400;
      if (ctx.measureText(label).width > maxLabelWidth) {
        while (ctx.measureText(label + "...").width > maxLabelWidth && label.length > 0) {
          label = label.slice(0, -1);
        }
        label += "...";
      }
      ctx.fillText(label, barStartX, currentY);

      ctx.fillStyle = "#18181b";
      ctx.font = "bold 12px Inter, system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(`${d.value} (${displayPct}%)`, barStartX + barWidth, currentY);

      const barY = currentY + 8;
      ctx.fillStyle = "#f4f4f5";
      drawRoundRect(ctx, barStartX, barY, barWidth, barHeight, 6);
      ctx.fill();

      ctx.fillStyle = colors[index % colors.length];
      const fillWidth = Math.max(barWidth * pct, 6);
      drawRoundRect(ctx, barStartX, barY, fillWidth, barHeight, 6);
      ctx.fill();
    });
  } else {
    const centerX = 160;
    const centerY = y + 100;
    const radius = 70;
    const strokeWidth = 22;

    ctx.strokeStyle = "#f4f4f5";
    ctx.lineWidth = strokeWidth;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.stroke();

    let startAngle = -Math.PI / 2;

    activeData.forEach((d, index) => {
      const pct = d.value / totalSubmissions;
      const angle = pct * 2 * Math.PI;

      ctx.strokeStyle = colors[index % colors.length];
      ctx.lineWidth = strokeWidth;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, startAngle, startAngle + angle);
      ctx.stroke();

      startAngle += angle;
    });

    ctx.fillStyle = "#18181b";
    ctx.font = "extrabold 22px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(String(totalSubmissions), centerX, centerY + 4);
    
    ctx.fillStyle = "#a1a1aa";
    ctx.font = "bold 10px Inter, system-ui, sans-serif";
    ctx.fillText("TOTAL", centerX, centerY + 18);

    const legendX = 320;
    const legendY = y + 10;
    const legendSpacing = 26;

    activeData.forEach((d, index) => {
      const currentLegendY = legendY + index * legendSpacing;
      if (currentLegendY > 370) return;

      const pct = Math.round((d.value / totalSubmissions) * 100);

      ctx.fillStyle = colors[index % colors.length];
      ctx.beginPath();
      ctx.arc(legendX, currentLegendY - 4, 5, 0, 2 * Math.PI);
      ctx.fill();

      ctx.fillStyle = "#3f3f46";
      ctx.font = "medium 12px Inter, system-ui, sans-serif";
      ctx.textAlign = "left";
      
      let label = d.label;
      const maxLegendLabelWidth = 160;
      if (ctx.measureText(label).width > maxLegendLabelWidth) {
        while (ctx.measureText(label + "...").width > maxLegendLabelWidth && label.length > 0) {
          label = label.slice(0, -1);
        }
        label += "...";
      }
      ctx.fillText(label, legendX + 15, currentLegendY);

      ctx.fillStyle = "#18181b";
      ctx.font = "bold 12px Inter, system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(`${d.value} (${pct}%)`, 560, currentLegendY);
    });
  }

  downloadJPEG();

  function downloadJPEG() {
    const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${col.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-chart.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

type QuestionCardProps = {
  col: QuestionColumn;
  submissions: Submission[];
};

function QuestionCard({ col, submissions }: QuestionCardProps) {
  const [chartType, setChartType] = useState<"bar" | "donut">("bar");
  const { data, total } = useMemo(() => getChartData(col, submissions), [col, submissions]);

  return (
    <div className="bg-white border border-zinc-200/80 rounded-xl p-5 shadow-sm flex flex-col gap-4">
      <div className="flex justify-between items-start gap-4">
        <div className="flex flex-col gap-0.5 min-w-0">
          <h3 className="text-sm font-bold text-zinc-800 leading-snug line-clamp-2" title={col.label}>
            {col.label}
          </h3>
          <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider mt-0.5">
            {col.type.replace(/Block$/, "").replace(/([A-Z])/g, " $1").trim()}
          </span>
        </div>

        {total > 0 && (
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => exportChartToJPEG(col, data, total, chartType)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 border border-zinc-200/50 shadow-sm transition-all cursor-pointer bg-white"
              title="Download Chart as JPEG"
            >
              <Download size={14} />
            </button>
            <div className="flex bg-zinc-100 p-0.5 rounded-lg border border-zinc-200/40">
              <button
                onClick={() => setChartType("bar")}
                className={`p-1 rounded-md transition-all cursor-pointer ${
                  chartType === "bar" ? "bg-white text-zinc-800 shadow-sm" : "text-zinc-400 hover:text-zinc-600"
                }`}
                title="Bar Chart"
              >
                <BarChart3 size={14} />
              </button>
              <button
                onClick={() => setChartType("donut")}
                className={`p-1 rounded-md transition-all cursor-pointer ${
                  chartType === "donut" ? "bg-white text-zinc-800 shadow-sm" : "text-zinc-400 hover:text-zinc-600"
                }`}
                title="Donut Chart"
              >
                <PieChart size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 mt-2">
        {chartType === "bar" ? (
          <BarChart data={data} total={total} />
        ) : (
          <DonutChart data={data} total={total} />
        )}
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────

function SubmissionsContent() {
  const params = useParams()!;
  const router = useRouter();
  const formId = params.formId as string;

  const [loading, setLoading] = useState(true);
  const [formTitle, setFormTitle] = useState("");
  const [versions, setVersions] = useState<FormVersion[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"responses" | "analysis">("responses");

  // Fetch data
  useEffect(() => {
    async function load() {
      // Auth check
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }

      // Form info
      const { data: form } = await supabase
        .from("forms")
        .select("id, draft_schema, created_by")
        .eq("id", formId)
        .single();

      if (!form || form.created_by !== user.id) {
        router.replace("/dashboard");
        return;
      }

      setFormTitle((form.draft_schema as any)?.title || "Untitled Form");

      // Form versions
      const { data: versionRows } = await supabase
        .from("form_versions")
        .select("id, version, title, content, created_at")
        .eq("form_id", formId)
        .order("version", { ascending: false });

      const vList = (versionRows as FormVersion[]) || [];
      setVersions(vList);

      // Default to latest version
      if (vList.length > 0) {
        setSelectedVersion(vList[0].version);
      }

      // All submissions
      const { data: subRows } = await supabase
        .from("submissions")
        .select("id, form_version, submitted_by, data, filled_at, synced_at")
        .eq("form_id", formId)
        .order("filled_at", { ascending: false });

      setSubmissions((subRows as Submission[]) || []);
      setLoading(false);
    }

    load();
  }, [formId, router]);

  // Derived: columns for selected version
  const activeVersion = useMemo(
    () => versions.find((v) => v.version === selectedVersion),
    [versions, selectedVersion]
  );

  const columns = useMemo(() => {
    if (!activeVersion) return [];
    return extractColumns(activeVersion.content);
  }, [activeVersion]);

  // Derived: filtered submissions for selected version
  const filteredSubmissions = useMemo(
    () => submissions.filter((s) => s.form_version === selectedVersion),
    [submissions, selectedVersion]
  );

  // Submission count per version
  const countByVersion = useMemo(() => {
    const map: Record<number, number> = {};
    for (const s of submissions) {
      map[s.form_version] = (map[s.form_version] || 0) + 1;
    }
    return map;
  }, [submissions]);

  const totalCount = submissions.length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="flex items-center gap-2 text-zinc-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="font-medium">Loading submissions…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200/60">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Dashboard
            </Link>
            <div className="w-px h-5 bg-zinc-200" />
            <h1 className="text-sm font-semibold text-zinc-900 truncate max-w-[300px]">
              {formTitle}
            </h1>
            <span className="text-xs text-zinc-400 font-medium bg-zinc-100 px-2 py-0.5 rounded-full">
              {totalCount} {totalCount === 1 ? "response" : "responses"}
            </span>
          </div>

          {/* Export dropdown */}
          {filteredSubmissions.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setExportOpen(!exportOpen)}
                className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-zinc-700 bg-white border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 rounded-lg transition-all shadow-sm"
              >
                <Download className="w-4 h-4" />
                Export
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              </button>
              {exportOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setExportOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-zinc-200 rounded-xl shadow-xl z-50 py-1 animate-in fade-in slide-in-from-top-1 duration-150">
                    <button
                      onClick={() => {
                        exportExcel(columns, filteredSubmissions, formTitle, selectedVersion!);
                        setExportOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      <div className="text-left">
                        <div className="font-medium">Excel (.xlsx)</div>
                        <div className="text-[11px] text-zinc-400">Microsoft Excel</div>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        exportCSV(columns, filteredSubmissions, formTitle, selectedVersion!);
                        setExportOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
                    >
                      <FileText className="w-4 h-4 text-blue-600" />
                      <div className="text-left">
                        <div className="font-medium">CSV (.csv)</div>
                        <div className="text-[11px] text-zinc-400">Comma-separated</div>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        exportJSON(columns, filteredSubmissions, formTitle, selectedVersion!);
                        setExportOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
                    >
                      <FileJson className="w-4 h-4 text-amber-600" />
                      <div className="text-left">
                        <div className="font-medium">JSON (.json)</div>
                        <div className="text-[11px] text-zinc-400">Structured data</div>
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Version tabs */}
      {versions.length > 0 && (
        <div className="bg-white border-b border-zinc-200/60">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex items-center gap-1 -mb-px overflow-x-auto scrollbar-none">
              {versions.map((v) => {
                const isActive = v.version === selectedVersion;
                const count = countByVersion[v.version] || 0;
                return (
                  <button
                    key={v.version}
                    onClick={() => setSelectedVersion(v.version)}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                      isActive
                        ? "border-zinc-900 text-zinc-900"
                        : "border-transparent text-zinc-400 hover:text-zinc-600 hover:border-zinc-300"
                    }`}
                  >
                    <span>Version {v.version}</span>
                    <span
                      className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                        isActive
                          ? "bg-zinc-900 text-white"
                          : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col gap-6">
        {versions.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Inbox className="w-8 h-8 text-zinc-300" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-700 mb-1">No versions published</h3>
            <p className="text-sm text-zinc-400">
              Publish your form first to start receiving submissions.
            </p>
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Inbox className="w-8 h-8 text-zinc-300" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-700 mb-1">No responses yet</h3>
            <p className="text-sm text-zinc-400">
              Responses for Version {selectedVersion} will appear here.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200">
            {/* View Switcher Segmented Control */}
            <div className="flex justify-between items-center bg-white border border-zinc-200/80 rounded-xl p-3 shadow-sm">
              <div className="flex bg-zinc-100 p-0.5 rounded-lg border border-zinc-200/40">
                <button
                  onClick={() => setActiveTab("responses")}
                  className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === "responses"
                      ? "bg-white text-zinc-900 shadow-sm"
                      : "text-zinc-400 hover:text-zinc-600"
                  }`}
                >
                  Responses Table
                </button>
                <button
                  onClick={() => setActiveTab("analysis")}
                  className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === "analysis"
                      ? "bg-white text-zinc-900 shadow-sm"
                      : "text-zinc-400 hover:text-zinc-600"
                  }`}
                >
                  Analysis & Charts
                </button>
              </div>
              <span className="text-xs text-zinc-400 font-medium hidden sm:inline">
                Switch between raw data table and visual analysis charts
              </span>
            </div>

            {activeTab === "responses" ? (
              <div className="bg-white border border-zinc-200/80 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-100">
                        <th className="text-left px-4 py-3 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider bg-zinc-50/80 whitespace-nowrap sticky left-0 z-10">
                          #
                        </th>
                        <th className="text-left px-4 py-3 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider bg-zinc-50/80 whitespace-nowrap min-w-[160px]">
                          Submitted At
                        </th>
                        {columns.map((col) => (
                          <th
                            key={col.id}
                            className="text-left px-4 py-3 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider bg-zinc-50/80 whitespace-nowrap min-w-[180px] max-w-[300px]"
                            title={col.label}
                          >
                            <span className="truncate block">{col.label}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSubmissions.map((sub, i) => (
                        <tr
                          key={sub.id}
                          className={`border-b border-zinc-50 hover:bg-zinc-50/50 transition-colors ${
                            i % 2 === 0 ? "" : "bg-zinc-25"
                          }`}
                        >
                          <td className="px-4 py-3 text-zinc-400 font-medium tabular-nums sticky left-0 bg-white z-10">
                            {i + 1}
                          </td>
                          <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">
                            {formatDateTime(sub.filled_at)}
                          </td>
                          {columns.map((col) => {
                            const val = sub.data[col.id];
                            const isGps = col.type === "gpsAnswerBlock" && val && val.latitude != null && val.longitude != null;
                            const isImage = col.type === "imageAnswerBlock" && val && typeof val === "string" && val.startsWith("http");
                            const isSignature = col.type === "signatureAnswerBlock" && val && typeof val === "string" && val.startsWith("http");
                            return (
                              <td
                                key={col.id}
                                className="px-4 py-2 text-zinc-700 max-w-[300px]"
                              >
                                {isGps ? (
                                  <a
                                    href={`https://www.google.com/maps?q=${val.latitude},${val.longitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline bg-blue-50/70 border border-blue-100 px-2 py-1 rounded-md transition-colors"
                                  >
                                    <span>{val.latitude.toFixed(5)}, {val.longitude.toFixed(5)}</span>
                                  </a>
                                ) : isImage ? (
                                  <a
                                    href={val}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-block relative w-10 h-10 border border-zinc-200 rounded overflow-hidden bg-zinc-50 hover:ring-2 hover:ring-blue-100 transition-all"
                                    title="View Full Image"
                                  >
                                    <img src={val} alt="Submission asset" className="w-full h-full object-cover" />
                                  </a>
                                ) : isSignature ? (
                                  <a
                                    href={val}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-block relative w-16 h-8 border border-zinc-200 rounded overflow-hidden bg-zinc-50 hover:ring-2 hover:ring-blue-100 transition-all p-0.5"
                                    title="View Signature"
                                  >
                                    <img src={val} alt="Signature asset" className="w-full h-full object-contain" />
                                  </a>
                                ) : (
                                  <span className="block truncate" title={formatCellValue(val)}>
                                    {formatCellValue(val)}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Footer */}
                <div className="px-4 py-3 border-t border-zinc-100 bg-zinc-50/50 flex items-center justify-between">
                  <span className="text-xs text-zinc-400">
                    Showing {filteredSubmissions.length}{" "}
                    {filteredSubmissions.length === 1 ? "response" : "responses"} for
                    Version {selectedVersion}
                  </span>
                  <span className="text-xs text-zinc-300">
                    {totalCount} total across all versions
                  </span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {/* Left Column */}
                <div className="flex flex-col gap-6">
                  {columns
                    .filter((_, idx) => idx % 2 === 0)
                    .map((col) => (
                      <QuestionCard key={col.id} col={col} submissions={filteredSubmissions} />
                    ))}
                </div>
                {/* Right Column */}
                <div className="flex flex-col gap-6">
                  {columns
                    .filter((_, idx) => idx % 2 === 1)
                    .map((col) => (
                      <QuestionCard key={col.id} col={col} submissions={filteredSubmissions} />
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SubmissionsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-zinc-50">
          <div className="text-zinc-400 animate-pulse font-medium">Loading…</div>
        </div>
      }
    >
      <SubmissionsContent />
    </Suspense>
  );
}
