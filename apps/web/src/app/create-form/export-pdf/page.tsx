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
  const [margins, setMargins] = useState({
    top: 20, // in mm
    bottom: 20,
    left: 20,
    right: 20,
  });

  useEffect(() => {
    const raw = localStorage.getItem("export_form_schema");
    const title = localStorage.getItem("export_form_title") || "Untitled Form";
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

  // Trigger measurement when formSchema or margins change
  useEffect(() => {
    if (formSchema) {
      setIsMeasuring(true);
    }
  }, [formSchema, margins.left, margins.right]);

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
    if (!formSchema?.content || isMeasuring) return [];

    // 297mm height converted to pixels minus top and bottom margins (with 12mm baseline for each)
    const printableHeight = (297 - (12 + margins.top) - (12 + margins.bottom)) * 3.78;
    const computedPages: any[][] = [];
    let currentPage: { node: any; height: number }[] = [];
    let currentHeight = 0;

    // Header and footer space (positioned absolutely in margin space, so 0 cost)
    const headerCost = 0;
    const firstPageHeaderCost = titleHeight;
    const footerCost = 0;

    for (let i = 0; i < formSchema.content.length; i++) {
      const node = formSchema.content[i];
      if (node.type === "logicBlock") continue;

      const nodeHeight = measuredHeights[i] || 50;

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
          <div className="h-4 w-px bg-zinc-200" />
          <button
            onClick={handlePrint}
            className="px-4 py-1 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 shadow-sm rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Printer size={14} />
            <span>Print / Export PDF</span>
          </button>
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
              className="absolute top-0 left-[-9999px] visibility-hidden pointer-events-none bg-white page-sheet tiptap form-renderer"
              style={{
                width: "210mm",
                padding: `${12 + margins.top}mm ${margins.right}mm ${12 + margins.bottom}mm ${margins.left}mm`,
                boxSizing: "border-box",
              }}
            >
              <div className="w-full h-full flex flex-col pointer-events-none">
                {formTitle && (
                  <div id="measure-title" className="mb-8 shrink-0 text-center">
                    <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight leading-none text-center">{formTitle}</h1>
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

          {!isMeasuring && pages.map((pageNodes, index) => (
            <div
              key={index}
              className="page-sheet tiptap form-renderer relative bg-white text-zinc-900 shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-zinc-200/50 transition-all duration-300 select-none shrink-0"
              style={{
                width: "210mm",
                height: "297mm",
                minHeight: "297mm",
                padding: `${12 + margins.top}mm ${margins.right}mm ${12 + margins.bottom}mm ${margins.left}mm`,
                boxSizing: "border-box",
              }}
            >
              {/* Header Title Display (Page 2+) */}
              {enableHeaderTitle && index > 0 && (
                <div
                  className="absolute text-zinc-400 text-[10px] uppercase tracking-wider font-semibold"
                  style={{
                    top: "6mm",
                    left: `${margins.left}mm`,
                    right: `${margins.right}mm`,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center"
                  }}
                >
                  <span className="truncate max-w-[400px]">{formTitle}</span>
                </div>
              )}

              {/* Page Content Renderer */}
              <div className="w-full h-full flex flex-col pointer-events-none">
                {/* Title on the First Page */}
                {index === 0 && formTitle && (
                  <div className="mb-8 shrink-0 text-center">
                    <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight leading-none text-center">{formTitle}</h1>
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
                  className="absolute text-zinc-400 text-[10px] font-semibold"
                  style={{
                    bottom: "6mm",
                    left: `${margins.left}mm`,
                    right: `${margins.right}mm`,
                    display: "flex",
                    justifyContent: "center"
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
              className="w-full bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-medium text-sm rounded-lg py-2.5 px-4 shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-all duration-150"
            >
              <Printer size={16} />
              <span>Print / Export PDF</span>
            </button>
            <p className="text-[10px] text-center text-zinc-400 leading-normal">
              For best results, disable default browser headers and footers in your print settings dialog.
            </p>
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
