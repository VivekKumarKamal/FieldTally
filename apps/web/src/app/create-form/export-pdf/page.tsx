"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Printer, Settings2, FileText,
  ChevronRight, AlignJustify, Compass, HelpCircle
} from "lucide-react";
import { RenderNode, extractText } from "../../../components/FormRenderer";

// Measured heights

function ExportPdfContent() {
  const [measuredHeights, setMeasuredHeights] = useState<number[]>([]);
  const [isMeasuring, setIsMeasuring] = useState(true);
  const [titleHeight, setTitleHeight] = useState(0);
  const router = useRouter();
  const [formSchema, setFormSchema] = useState<any>(null);
  const [formTitle, setFormTitle] = useState("");

  // Settings
  const [enablePageNumbers, setEnablePageNumbers] = useState(true);
  const [enableHeaderTitle, setEnableHeaderTitle] = useState(true);
  const [customHeaderText, setCustomHeaderText] = useState("");
  const [inputStyle, setInputStyle] = useState<"boxes" | "lines">("boxes");
  const [fontScale, setFontScale] = useState(1.0);
  const [margins, setMargins] = useState({
    top: 2, // in mm
    bottom: 2,
    left: 20,
    right: 20,
  });

  const headerText = useMemo(() => customHeaderText.trim() || formTitle, [customHeaderText, formTitle]);

  useEffect(() => {
    const raw = localStorage.getItem("export_form_schema");
    const title = localStorage.getItem("export_form_title") || "";
    if (raw) {
      try {
        setFormSchema(JSON.parse(raw));
        setFormTitle(title);
      } catch {
        router.push("/create-form");
      }
    } else {
      router.push("/create-form");
    }
  }, [router]);

  useEffect(() => {
    if (formTitle) {
      document.title = `${formTitle} - FieldTally`;
    }
  }, [formTitle]);

  // Make all blocks visible by default
  const visibility = useMemo(() => {
    const vis: Record<string, boolean> = {};
    if (formSchema?.content) {
      for (const node of formSchema.content) {
        if (node.attrs?.id) {
          vis[node.attrs.id] = true;
        }
      }
    }
    return vis;
  }, [formSchema]);

  // Trigger measurement when formSchema, margins, fontScale, or inputStyle change
  useEffect(() => {
    if (formSchema) {
      setIsMeasuring(true);
    }
  }, [formSchema, margins.left, margins.right, fontScale, inputStyle]);

  // Actual measurement logic
  useEffect(() => {
    if (isMeasuring && formSchema?.content) {
      // Use a timeout to ensure DOM has painted the measurement nodes
      const timer = setTimeout(() => {
        const heights: number[] = [];
        const nodes = formSchema.content;

        // Measure title height dynamically
        const titleEl = document.getElementById("measure-title");
        let measuredTitleHeight = 0;
        if (titleEl) {
          const style = window.getComputedStyle(titleEl);
          const mb = parseFloat(style.marginBottom) || 0;
          const mt = parseFloat(style.marginTop) || 0;
          measuredTitleHeight = titleEl.getBoundingClientRect().height + mb + mt;
        }
        setTitleHeight(measuredTitleHeight);

        for (let i = 0; i < nodes.length; i++) {
          if (nodes[i].type === "logicBlock") {
            heights.push(0);
            continue;
          }
          const el = document.getElementById(`measure-node-${i}`);
          if (!el) {
            heights.push(0);
            continue;
          }

          // Find next visible node to measure distance to (accounts for collapsing margins perfectly)
          let nextEl = null;
          for (let j = i + 1; j < nodes.length; j++) {
            nextEl = document.getElementById(`measure-node-${j}`);
            if (nextEl) break;
          }

          if (nextEl) {
            heights.push(nextEl.getBoundingClientRect().top - el.getBoundingClientRect().top);
          } else {
            // For the last element, get its height + bottom margin
            const style = window.getComputedStyle(el.firstElementChild || el);
            const mb = parseFloat(style.marginBottom) || 0;
            heights.push(el.getBoundingClientRect().height + mb);
          }
        }
        setMeasuredHeights(heights);
        setIsMeasuring(false);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isMeasuring, formSchema, formTitle]);

  // A4 Pagination Algorithm based on measured heights
  const pages = useMemo(() => {
    if (!formSchema?.content || (isMeasuring && measuredHeights.length === 0)) return [];

    // Filter out trailing empty paragraphs and logic blocks from the end of the content to prevent empty page generation
    const nodes = [...formSchema.content];
    while (nodes.length > 0) {
      const last = nodes[nodes.length - 1];
      const isLogic = last.type === "logicBlock";
      const isEmptyPara = last.type === "paragraph" && (!last.content || last.content.length === 0);
      if (isLogic || isEmptyPara) {
        nodes.pop();
      } else {
        break;
      }
    }

    // 297mm height converted to pixels minus top and bottom margins (with 12mm baseline for each)
    const printableHeight = (297 - (12 + margins.top) - (12 + margins.bottom)) * 3.78;
    const computedPages: any[][] = [];
    let currentPage: { node: any; height: number }[] = [];
    let currentHeight = 0;

    // Header and footer space (positioned absolutely in margin space, so 0 cost)
    const headerCost = 0;
    const firstPageHeaderCost = titleHeight;
    const footerCost = 0;

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (node.type === "logicBlock") continue;

      const nodeHeight = measuredHeights[i] !== undefined ? measuredHeights[i] : 50;

      const isFirstPage = computedPages.length === 0;
      const currentHeaderCost = isFirstPage ? firstPageHeaderCost : headerCost;
      const availableHeight = printableHeight - currentHeaderCost - footerCost;

      if (currentHeight + nodeHeight > availableHeight && currentPage.length > 0) {
        // Start a new page.
        // Prevent headings from being left alone at the bottom of the page
        let movedNodes: { node: any; height: number }[] = [];
        while (currentPage.length > 1 && currentPage[currentPage.length - 1].node.type === "heading") {
          const popped = currentPage.pop()!;
          movedNodes.unshift(popped);
          currentHeight -= popped.height;
        }

        computedPages.push(currentPage.map(item => item.node));
        currentPage = [...movedNodes, { node, height: nodeHeight }];
        currentHeight = currentPage.reduce((sum, item) => sum + item.height, 0);
      } else {
        currentPage.push({ node, height: nodeHeight });
        currentHeight += nodeHeight;
      }
    }

    if (currentPage.length > 0) {
      computedPages.push(currentPage.map(item => item.node));
    }

    return computedPages;
  }, [formSchema, isMeasuring, measuredHeights, margins.top, margins.bottom, titleHeight]);

  const handlePrint = () => {
    window.print();
  };

  const handleMarginChange = (key: keyof typeof margins, value: string) => {
    const parsed = Math.max(0, Math.min(100, parseInt(value) || 0));
    setMargins(prev => ({ ...prev, [key]: parsed }));
  };

  if (!formSchema) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center text-zinc-500">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-t-blue-600 border-r-blue-600 border-zinc-200 rounded-full animate-spin"></div>
          <p className="text-sm font-medium">Loading workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="export-pdf-root fixed inset-0 bg-zinc-50 text-zinc-800 flex flex-col font-sans selection:bg-blue-600 selection:text-white overflow-hidden">
      {/* Dynamic Style Injection for PDF Margins & Page Setup */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          @page {
            size: A4 portrait;
            margin: 0 !important;
          }
          html, body {
            background: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            overflow: visible !important;
          }
          .export-pdf-root {
            position: relative !important;
            height: auto !important;
            overflow: visible !important;
            display: block !important;
          }
          .page-sheet {
            box-shadow: none !important;
            margin: 0 !important;
            border: none !important;
            page-break-after: always !important;
            break-after: always !important;
            width: 210mm !important;
            height: 297mm !important;
            min-height: 297mm !important;
            box-sizing: border-box !important;
          }
          .settings-sidebar, .export-topbar {
            display: none !important;
          }
          .workspace-container {
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
            height: auto !important;
            overflow: visible !important;
          }
          .option-marker {
            border-color: #71717a !important;
            background-color: transparent !important;
          }
          .option-content {
            color: #18181b !important;
          }
        }
        .page-sheet .flex-1.block > :first-child {
          margin-top: 0 !important;
        }
        .page-sheet .flex-1.block > :last-child {
          margin-bottom: 0 !important;
        }
        .page-sheet h1 {
          font-size: 1.7em !important;
        }
        .page-sheet h2 {
          font-size: 1.4em !important;
        }
        .page-sheet h3 {
          font-size: 1.15em !important;
        }
        .page-sheet.inputs-lines .block-placeholder-input:not(.long-answer-textarea) {
          border-top: none !important;
          border-left: none !important;
          border-right: none !important;
          border-bottom: 1px solid #d4d4d8 !important;
          border-radius: 0 !important;
          background-color: transparent !important;
        }
        .page-sheet.inputs-lines .phone-answer-field,
        .page-sheet.inputs-lines .link-answer-field {
          border-top: none !important;
          border-left: none !important;
          border-right: none !important;
          border-bottom: 1px solid #d4d4d8 !important;
          border-radius: 0 !important;
          background-color: transparent !important;
        }
        .page-sheet.inputs-lines .long-answer-textarea {
          border: none !important;
          background-color: transparent !important;
        }
        .page-sheet.inputs-lines .signature-print-box,
        .page-sheet.inputs-lines .image-print-box {
          border-top: none !important;
          border-left: none !important;
          border-right: none !important;
          border-bottom: 1px solid #d4d4d8 !important;
          border-radius: 0 !important;
          background-color: transparent !important;
        }
        .page-sheet .text-xs {
          font-size: 0.75em !important;
        }
        .page-sheet .short-answer-block,
        .page-sheet .long-answer-block,
        .page-sheet .number-answer-block,
        .page-sheet .email-answer-block,
        .page-sheet .phone-answer-block,
        .page-sheet .link-answer-block,
        .page-sheet .date-answer-block,
        .page-sheet .time-answer-block,
        .page-sheet div[data-type="checkbox-block"],
        .page-sheet div[data-type="multiple-choice-block"] {
          margin: 1.8em 0 !important;
        }
        .page-sheet .block-placeholder-input {
          margin: 0.6em 0 1.25em 0 !important;
        }
        .page-sheet div[data-type="checkbox-option"],
        .page-sheet div[data-type="multiple-choice-option"] {
          padding: 0.25em 0.75em !important;
        }
      `}} />

      {/* Top bar */}
      <div className="export-topbar h-14 border-b border-zinc-200/60 bg-white/70 backdrop-blur-xl px-6 flex items-center justify-between z-50 shrink-0 transition-all duration-200">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-zinc-800 to-zinc-600 rounded flex items-center justify-center shadow-sm">
              <span className="text-white text-xs font-bold tracking-tighter block">FT</span>
            </div>
            <span className="font-semibold text-zinc-800 tracking-tight">FieldTally</span>
          </div>
          <div className="h-4 w-px bg-zinc-200" />
          <button
            onClick={() => window.close()}
            className="flex items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-950 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors py-1.5 px-3.5 cursor-pointer"
          >
            <ArrowLeft size={14} /> Back to Editor
          </button>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-zinc-400" />
            <span className="text-sm text-zinc-700 font-semibold truncate max-w-[200px]">{formTitle}</span>
          </div>
          {pages.length > 0 && (
            <>
              <div className="h-4 w-px bg-zinc-200" />
              <span className="text-xs font-semibold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                {pages.length} {pages.length === 1 ? "Page" : "Pages"}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Main Workspace split */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Simulated A4 Pages scroll list */}
        <div className="workspace-container flex-1 bg-zinc-50 overflow-y-auto p-8 flex flex-col items-center gap-8 relative border-r border-zinc-200/60">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ backgroundImage: "radial-gradient(circle, #e4e4e7 1px, transparent 1px)", backgroundSize: "24px 24px" }}
          />

          {/* Invisible measuring container */}
          {isMeasuring && (
            <div
              className={`absolute top-0 left-[-9999px] visibility-hidden pointer-events-none bg-white page-sheet tiptap form-renderer ${
                inputStyle === "lines" ? "inputs-lines" : ""
              }`}
              style={{
                width: "210mm",
                padding: `${12 + margins.top}mm ${margins.right}mm ${12 + margins.bottom}mm ${margins.left}mm`,
                boxSizing: "border-box",
                fontSize: `${14 * fontScale}px`,
              }}
            >
              <div className="w-full h-full flex flex-col pointer-events-none">
                {formTitle && (
                  <div id="measure-title" className="shrink-0 text-center" style={{ marginBottom: "2.3em" }}>
                    <h1 className="font-extrabold text-zinc-900 tracking-tight leading-none text-center" style={{ fontSize: "2.1em" }}>{formTitle}</h1>
                  </div>
                )}
                <div className="flex-1 block">
                  {formSchema?.content?.map((node: any, i: number) => (
                    <div key={node.attrs?.id || i} id={`measure-node-${i}`}>
                      <RenderNode
                        node={node}
                        answers={{}}
                        updateAnswer={() => { }}
                        toggleCheckbox={() => { }}
                        errors={{}}
                        visibility={visibility}
                        isPrinting={true}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {pages.map((pageNodes, index) => (
            <div
              key={index}
              className={`page-sheet tiptap form-renderer relative bg-white text-zinc-900 shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-zinc-200/50 transition-all duration-300 select-none shrink-0 ${
                inputStyle === "lines" ? "inputs-lines" : ""
              }`}
              style={{
                width: "210mm",
                height: "297mm",
                minHeight: "297mm",
                padding: `${12 + margins.top}mm ${margins.right}mm ${12 + margins.bottom}mm ${margins.left}mm`,
                boxSizing: "border-box",
                fontSize: `${14 * fontScale}px`,
              }}
            >
              {/* Header Title Display (Page 2+) */}
              {enableHeaderTitle && index > 0 && (
                <div
                  className="absolute text-zinc-400 uppercase tracking-wider font-semibold"
                  style={{
                    top: "6mm",
                    left: `${margins.left}mm`,
                    right: `${margins.right}mm`,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    fontSize: "0.7em"
                  }}
                >
                  <span className="truncate max-w-[400px]">{headerText}</span>
                </div>
              )}

              {/* Page Content Renderer */}
              <div className="w-full h-full flex flex-col pointer-events-none">
                {/* Title on the First Page */}
                {index === 0 && formTitle && (
                  <div className="shrink-0 text-center" style={{ marginBottom: "2.3em" }}>
                    <h1 className="font-extrabold text-zinc-900 tracking-tight leading-none text-center" style={{ fontSize: "2.1em" }}>{formTitle}</h1>
                  </div>
                )}

                {/* Nodes inside this page */}
                <div className="flex-1 block">
                  {pageNodes.map((node: any, i: number) => (
                    <RenderNode
                      key={node.attrs?.id || i}
                      node={node}
                      answers={{}}
                      updateAnswer={() => { }}
                      toggleCheckbox={() => { }}
                      errors={{}}
                      visibility={visibility}
                      isPrinting={true}
                    />
                  ))}
                </div>
              </div>

              {/* Page Number Display (Footer) */}
              {enablePageNumbers && (
                <div
                  className="absolute text-zinc-400 font-semibold"
                  style={{
                    bottom: "6mm",
                    left: `${margins.left}mm`,
                    right: `${margins.right}mm`,
                    display: "flex",
                    justifyContent: "center",
                    fontSize: "0.75em"
                  }}
                >
                  {index + 1} of {pages.length}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Right Side: Settings Panel */}
        <div className="settings-sidebar w-80 border-l border-zinc-200 bg-white p-6 flex flex-col justify-between shrink-0 overflow-y-auto">
          <div className="flex flex-col gap-8">
            <div className="flex items-center gap-2">
              <Settings2 size={16} className="text-zinc-500" />
              <h2 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">PDF Settings</h2>
            </div>

            {/* Font Size */}
            <div className="flex flex-col gap-3">
              <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Font Size</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFontScale(prev => Math.max(0.6, parseFloat((prev - 0.05).toFixed(2))))}
                  className="flex-1 bg-zinc-50 border border-zinc-200 hover:border-zinc-300 text-zinc-600 font-semibold text-sm py-1.5 px-3 rounded-lg cursor-pointer text-center select-none active:scale-[0.97] transition-all"
                  title="Decrease Font Size"
                >
                  A-
                </button>
                <button
                  onClick={() => setFontScale(1.0)}
                  className="bg-zinc-100 border border-zinc-200 hover:border-zinc-300 text-zinc-700 font-medium text-xs py-1.5 px-4 rounded-lg cursor-pointer text-center select-none active:scale-[0.97] transition-all min-w-[70px]"
                  title="Reset to 100%"
                >
                  {Math.round(fontScale * 100)}%
                </button>
                <button
                  onClick={() => setFontScale(prev => Math.min(1.8, parseFloat((prev + 0.05).toFixed(2))))}
                  className="flex-1 bg-zinc-50 border border-zinc-200 hover:border-zinc-300 text-zinc-600 font-semibold text-sm py-1.5 px-3 rounded-lg cursor-pointer text-center select-none active:scale-[0.97] transition-all"
                  title="Increase Font Size"
                >
                  A+
                </button>
              </div>
            </div>

            {/* Margins */}
            <div className="flex flex-col gap-4">
              <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Margins (mm)</h3>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(margins).map(([key, val]) => (
                  <div key={key} className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-medium text-zinc-500 capitalize">{key}</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={val}
                      onChange={(e) => handleMarginChange(key as any, e.target.value)}
                      className="w-full bg-zinc-50 border border-zinc-200 hover:border-zinc-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg py-1.5 px-3 text-sm font-medium text-zinc-800 outline-none transition-all"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="h-px bg-zinc-100" />

            {/* Input Style */}
            <div className="flex flex-col gap-3">
              <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Input Style</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setInputStyle("boxes")}
                  className={`flex-1 font-semibold text-xs py-1.5 px-3 rounded-lg cursor-pointer text-center select-none active:scale-[0.97] transition-all border ${
                    inputStyle === "boxes"
                      ? "bg-zinc-900 border-zinc-900 text-white"
                      : "bg-zinc-50 border-zinc-200 text-zinc-600 hover:border-zinc-300"
                  }`}
                >
                  Boxes
                </button>
                <button
                  onClick={() => setInputStyle("lines")}
                  className={`flex-1 font-semibold text-xs py-1.5 px-3 rounded-lg cursor-pointer text-center select-none active:scale-[0.97] transition-all border ${
                    inputStyle === "lines"
                      ? "bg-zinc-900 border-zinc-900 text-white"
                      : "bg-zinc-50 border-zinc-200 text-zinc-600 hover:border-zinc-300"
                  }`}
                >
                  Lines & Space
                </button>
              </div>
            </div>

            <div className="h-px bg-zinc-100" />

            {/* Document Header Options */}
            <div className="flex flex-col gap-5">
              <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Header / Footer</h3>

              {/* Header Title Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-semibold text-zinc-700">Display Header</span>
                  <span className="text-[10px] text-zinc-400">Show form title on every page</span>
                </div>
                <button
                  onClick={() => setEnableHeaderTitle(p => !p)}
                  className={`w-10 h-6 rounded-full p-1 cursor-pointer transition-colors outline-none ${enableHeaderTitle ? "bg-blue-500" : "bg-zinc-200"
                    }`}
                >
                  <div
                    className={`w-4 h-4 bg-white rounded-full transition-transform ${enableHeaderTitle ? "translate-x-4" : "translate-x-0"
                      }`}
                  />
                </button>
              </div>

              {/* Custom Header Text Input */}
              {enableHeaderTitle && (
                <div className="flex flex-col gap-1.5 pl-2 border-l border-zinc-200 transition-all duration-150 animate-in fade-in slide-in-from-top-1">
                  <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Custom Header Text</label>
                  <input
                    type="text"
                    value={customHeaderText}
                    onChange={(e) => setCustomHeaderText(e.target.value)}
                    placeholder="Same as title"
                    className="w-full bg-zinc-50 border border-zinc-200 hover:border-zinc-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg py-1.5 px-3 text-xs font-medium text-zinc-800 outline-none transition-all"
                  />
                </div>
              )}

              {/* Page Numbers Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-semibold text-zinc-700">Page Numbers</span>
                  <span className="text-[10px] text-zinc-400">Display page index at footer</span>
                </div>
                <button
                  onClick={() => setEnablePageNumbers(p => !p)}
                  className={`w-10 h-6 rounded-full p-1 cursor-pointer transition-colors outline-none ${enablePageNumbers ? "bg-blue-500" : "bg-zinc-200"
                    }`}
                >
                  <div
                    className={`w-4 h-4 bg-white rounded-full transition-transform ${enablePageNumbers ? "translate-x-4" : "translate-x-0"
                      }`}
                  />
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 mt-8">
            <button
              onClick={handlePrint}
              className="w-full bg-zinc-800 hover:bg-zinc-600 active:scale-[0.98] text-white font-medium text-sm rounded-lg py-1.5 px-2 shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-all duration-150"
            >
              <Printer size={16} />
              <span>Print / Export PDF ({pages.length} {pages.length === 1 ? "page" : "pages"})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ExportPdfPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50 flex items-center justify-center"><div className="text-zinc-400 animate-pulse font-medium">Loading editor...</div></div>}>
      <ExportPdfContent />
    </Suspense>
  );
}
