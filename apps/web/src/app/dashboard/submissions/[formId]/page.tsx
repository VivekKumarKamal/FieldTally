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
};

// ─── Helpers ──────────────────────────────────────────────

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
      cols.push({ id, label, type: node.type });
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

function exportExcel(
  columns: QuestionColumn[],
  submissions: Submission[],
  formTitle: string,
  version: number
) {
  // Generate an Excel-compatible XML spreadsheet
  const headers = ["#", "Submitted At", ...columns.map((c) => c.label)];
  const rows = submissions.map((s, i) => [
    String(i + 1),
    formatDateTime(s.filled_at),
    ...columns.map((c) => formatCellValue(s.data[c.id])),
  ]);

  const escapeXml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  let xml = `<?xml version="1.0"?>\n<?mso-application progid="Excel.Sheet"?>\n`;
  xml += `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n`;
  xml += ` xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n`;
  xml += `<Styles>\n`;
  xml += `<Style ss:ID="header"><Font ss:Bold="1" ss:Size="11"/><Interior ss:Color="#F4F4F5" ss:Pattern="Solid"/></Style>\n`;
  xml += `<Style ss:ID="cell"><Font ss:Size="10"/></Style>\n`;
  xml += `</Styles>\n`;
  xml += `<Worksheet ss:Name="Submissions">\n<Table>\n`;

  // Header row
  xml += `<Row ss:StyleID="header">\n`;
  for (const h of headers) {
    xml += `<Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>\n`;
  }
  xml += `</Row>\n`;

  // Data rows
  for (const row of rows) {
    xml += `<Row ss:StyleID="cell">\n`;
    for (const cell of row) {
      xml += `<Cell><Data ss:Type="String">${escapeXml(cell)}</Data></Cell>\n`;
    }
    xml += `</Row>\n`;
  }

  xml += `</Table>\n</Worksheet>\n</Workbook>`;
  downloadFile(
    `${formTitle}_v${version}_submissions.xls`,
    xml,
    "application/vnd.ms-excel"
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
                        <div className="font-medium">Excel (.xls)</div>
                        <div className="text-[11px] text-zinc-400">Spreadsheet format</div>
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
      <div className="max-w-7xl mx-auto px-6 py-6">
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
                      {columns.map((col) => (
                        <td
                          key={col.id}
                          className="px-4 py-3 text-zinc-700 max-w-[300px]"
                        >
                          <span className="block truncate" title={formatCellValue(sub.data[col.id])}>
                            {formatCellValue(sub.data[col.id])}
                          </span>
                        </td>
                      ))}
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
