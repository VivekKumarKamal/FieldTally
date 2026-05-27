"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import type { ElementType, ReactNode } from "react";
import { Send, CheckCircle2, MapPin, RefreshCw, Upload, Loader2, Image, PenTool, Trash } from "lucide-react";
import { useParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import { evaluateLogic, LogicBlockNode } from "../lib/logic";

// ─── Text rendering helpers ──────────────────────────────

function renderMarks(text: string, marks?: any[]): ReactNode {
  if (!marks || marks.length === 0) return text;
  let el: ReactNode = text;
  for (const mark of marks) {
    switch (mark.type) {
      case "bold": el = <strong>{el}</strong>; break;
      case "italic": el = <em>{el}</em>; break;
      case "strike": el = <s>{el}</s>; break;
      case "underline": el = <u>{el}</u>; break;
      case "code": el = <code className="bg-zinc-100 px-1 py-0.5 rounded text-sm">{el}</code>; break;
      case "link": el = <a href={mark.attrs?.href} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">{el}</a>; break;
    }
  }
  return el;
}

export function renderInlineContent(content?: any[]): ReactNode[] {
  if (!content) return [];
  return content.map((node, i) => {
    if (node.type === "text") return <span key={i}>{renderMarks(node.text || "", node.marks)}</span>;
    if (node.type === "hardBreak") return <br key={i} />;
    return null;
  });
}

export function extractText(content?: any[]): string {
  if (!content) return "";
  return content.map(n => {
    if (n.type === "text") return n.text || "";
    if (n.content) return extractText(n.content);
    return "";
  }).join("");
}

function getInputType(t: string): string {
  const m: Record<string, string> = {
    numberAnswerBlock: "number", emailAnswerBlock: "email",
    phoneAnswerBlock: "tel", linkAnswerBlock: "url",
    dateAnswerBlock: "date", timeAnswerBlock: "time",
  };
  return m[t] || "text";
}

function blockClass(t: string): string {
  const m: Record<string, string> = {
    shortAnswerBlock: "short-answer-block", longAnswerBlock: "long-answer-block",
    numberAnswerBlock: "number-answer-block", emailAnswerBlock: "email-answer-block",
    phoneAnswerBlock: "phone-answer-block", linkAnswerBlock: "link-answer-block",
    dateAnswerBlock: "date-answer-block", timeAnswerBlock: "time-answer-block",
  };
  return m[t] || "";
}

function titleCls(t: string): string {
  const m: Record<string, string> = {
    shortAnswerBlock: "short-answer-title", longAnswerBlock: "long-answer-title",
    numberAnswerBlock: "number-answer-title", emailAnswerBlock: "email-answer-title",
    phoneAnswerBlock: "phone-answer-title", linkAnswerBlock: "link-answer-title",
    dateAnswerBlock: "date-answer-title", timeAnswerBlock: "time-answer-title",
  };
  return m[t] || "";
}

const TEXT_INPUT_TYPES = [
  "shortAnswerBlock", "numberAnswerBlock", "emailAnswerBlock",
  "dateAnswerBlock", "timeAnswerBlock",
];

// Input limits per block type
const INPUT_LIMITS: Record<string, number> = {
  shortAnswerBlock: 30,
  numberAnswerBlock: 15,
  emailAnswerBlock: 100,
};

// ─── Props ───────────────────────────────────────────────

type FormRendererProps = {
  schema: any;
  title?: string;
  progressBarOffset?: number | string;
  /** Called with the final answers map when the user submits. */
  onSubmit?: (answers: Record<string, any>) => void;
  isPrinting?: boolean;
};

// ─── FormRenderer ────────────────────────────────────────

export default function FormRenderer({ schema, title, progressBarOffset, onSubmit, isPrinting = false }: FormRendererProps) {
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [gpsState, setGpsState] = useState<Record<string, { loading: boolean; error: string | null }>>({});
  const [uploadState, setUploadState] = useState<Record<string, { loading: boolean; error: string | null }>>({});

  const params = useParams() || {};
  const formId = (params.formId as string) || "preview";

  const handleImageUpload = useCallback(async (id: string, file: File, formId: string) => {
    if (!file) return;
    setUploadState(prev => ({ ...prev, [id]: { loading: true, error: null } }));
    
    try {
      if (formId === "preview") {
        const localUrl = URL.createObjectURL(file);
        setAnswers(prev => ({ ...prev, [id]: localUrl }));
        setErrors(prev => {
          if (prev[id]) { const n = { ...prev }; delete n[id]; return n; }
          return prev;
        });
        setUploadState(prev => ({ ...prev, [id]: { loading: false, error: null } }));
        return;
      }

      const fileExt = file.name.split('.').pop() || 'png';
      const fileName = `${id}-${Date.now()}.${fileExt}`;
      const filePath = `submissions/${formId}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('fieldtally')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('fieldtally').getPublicUrl(filePath);
      if (!data?.publicUrl) throw new Error("Failed to resolve URL");

      setAnswers(prev => ({ ...prev, [id]: data.publicUrl }));
      setErrors(prev => {
        if (prev[id]) { const n = { ...prev }; delete n[id]; return n; }
        return prev;
      });
      setUploadState(prev => ({ ...prev, [id]: { loading: false, error: null } }));
    } catch (err: any) {
      console.error("Image upload failed:", err);
      setUploadState(prev => ({ ...prev, [id]: { loading: false, error: err.message || "Failed to upload image" } }));
    }
  }, []);

  const captureLocationForField = useCallback((id: string) => {
    setGpsState(prev => ({ ...prev, [id]: { loading: true, error: null } }));
    
    if (typeof window === "undefined" || !navigator.geolocation) {
      setGpsState(prev => ({ ...prev, [id]: { loading: false, error: "Geolocation not supported by browser" } }));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        setAnswers(prev => ({ ...prev, [id]: coords }));
        setErrors(prev => {
          if (prev[id]) { const n = { ...prev }; delete n[id]; return n; }
          return prev;
        });
        setGpsState(prev => ({ ...prev, [id]: { loading: false, error: null } }));
      },
      (err) => {
        console.error("GPS Error for field", id, err);
        let errorMsg = "Failed to retrieve location";
        if (err.code === 1) {
          errorMsg = "Permission denied. Please allow location access.";
        } else if (err.code === 2) {
          errorMsg = "Location unavailable.";
        } else if (err.code === 3) {
          errorMsg = "Location request timed out.";
        }
        setGpsState(prev => ({ ...prev, [id]: { loading: false, error: errorMsg } }));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, []);

  // Auto-request location on load if there's any required GPS block
  useEffect(() => {
    if (!schema?.content) return;
    const requiredGpsBlocks = schema.content.filter(
      (node: any) =>
        node.type === "gpsAnswerBlock" &&
        node.attrs?.id &&
        (node.attrs.required === true || node.attrs.required === "true")
    );

    if (requiredGpsBlocks.length > 0) {
      requiredGpsBlocks.forEach((node: any) => {
        captureLocationForField(node.attrs.id);
      });
    }
  }, [schema, captureLocationForField]);

  // Build logic nodes from all doc nodes
  const logicNodes: LogicBlockNode[] = useMemo(() => {
    if (!schema?.content) return [];
    return schema.content
      .filter((node: any) => node.attrs?.id || node.type === "logicBlock")
      .map((node: any, index: number) => ({
        id: node.attrs?.id || `logic-${index}`,
        type: node.type,
        rule: node.attrs?.rule,
        logic: node.attrs?.logic,
      }));
  }, [schema]);

  const logicResult = useMemo(() => evaluateLogic(logicNodes, answers), [logicNodes, answers]);

  const updateAnswer = useCallback((id: string, value: any) => {
    setAnswers(prev => ({ ...prev, [id]: value }));
    setErrors(prev => {
      if (prev[id]) { const n = { ...prev }; delete n[id]; return n; }
      return prev;
    });
  }, []);

  // Initialize phone fields with default +91
  useEffect(() => {
    if (!schema?.content) return;
    const phoneDefaults: Record<string, string> = {};
    for (const node of schema.content) {
      if (node.type === "phoneAnswerBlock" && node.attrs?.id) {
        phoneDefaults[node.attrs.id] = "+91 ";
      }
    }
    if (Object.keys(phoneDefaults).length > 0) {
      setAnswers(prev => {
        const merged = { ...phoneDefaults, ...prev }; // prev wins so existing answers aren't overwritten
        return merged;
      });
    }
  }, [schema]);

  const toggleCheckbox = useCallback((id: string, opt: string) => {
    setAnswers(prev => {
      const cur: string[] = prev[id] || [];
      return { ...prev, [id]: cur.includes(opt) ? cur.filter(o => o !== opt) : [...cur, opt] };
    });
  }, []);

  const handleSubmit = () => {
    const newErrors: Record<string, string> = {};
    if (schema?.content) {
      for (const node of schema.content) {
        const id = node.attrs?.id;
        if (!id || node.type === "logicBlock") continue;
        if (logicResult.visibility[id] === false) continue;
        
        const req = node.attrs?.required === true || node.attrs?.required === "true";
        const val = answers[id];
        const isEmpty = val == null || val === "" || (Array.isArray(val) && val.length === 0);

        if (req && (isEmpty || (node.type === "gpsAnswerBlock" && (!val?.latitude || !val?.longitude)))) {
          if (node.type === "gpsAnswerBlock") {
            newErrors[id] = "Location access is required";
          } else if (node.type === "imageAnswerBlock") {
            newErrors[id] = "Image upload is required";
          } else if (node.type === "signatureAnswerBlock") {
            newErrors[id] = "Signature drawing is required";
          } else {
            newErrors[id] = "This field is required";
          }
          continue;
        }

        // Validate formats if there's an entry
        if (!isEmpty) {
          if (node.type === "emailAnswerBlock") {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(val)) {
              newErrors[id] = "Please enter a valid email address";
            }
          } else if (node.type === "phoneAnswerBlock") {
            const spaceIdx = val.indexOf(" ");
            const numPart = spaceIdx > 0 ? val.slice(spaceIdx + 1) : val.replace(/^\+\d+\s?/, "");
            if (numPart.length < 10) {
              newErrors[id] = "Please enter a valid 10-digit phone number";
            }
          } else if (node.type === "linkAnswerBlock") {
            if (!val.includes(".")) {
               newErrors[id] = "Please enter a valid link";
            }
          }
        }
      }
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      const first = Object.keys(newErrors)[0];
      document.getElementById(`field-${first}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (onSubmit) onSubmit(answers);
    setSubmitted(true);
  };

  // ─── Progress calculation ───
  const { totalFields, filledFields } = useMemo(() => {
    if (!schema?.content) return { totalFields: 0, filledFields: 0 };
    let total = 0;
    let filled = 0;
    for (const node of schema.content) {
      const id = node.attrs?.id;
      if (!id || node.type === "logicBlock") continue;
      if (logicResult.visibility[id] === false) continue;
      total++;
      const val = answers[id];
      if (val != null && val !== "" && !(Array.isArray(val) && val.length === 0)) filled++;
    }
    return { totalFields: total, filledFields: filled };
  }, [schema, answers, logicResult]);

  const progressPct = totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;

  // ─── Success screen ───
  if (submitted) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center max-w-md px-8">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={32} className="text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-zinc-800 mb-2">Response submitted!</h2>
          <p className="text-zinc-500 mb-8">Your response has been recorded successfully.</p>
          <button
            onClick={() => { setSubmitted(false); setAnswers({}); setErrors({}); }}
            className="px-5 py-2.5 text-sm font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
          >
            Submit another response
          </button>
        </div>
      </div>
    );
  }

  // ─── Form ───
  return (
    <div className="tiptap form-renderer">
      {/* Progress bar */}
      {totalFields > 0 && (
        <div className="print:hidden" style={{ position: "fixed", top: progressBarOffset || 0, left: 0, right: 0, zIndex: 40 }}>
          <div style={{ height: 3, background: "#f4f4f5" }}>
            <div
              style={{
                height: "100%",
                width: `${progressPct}%`,
                background: progressPct === 100 ? "#22c55e" : "#3b82f6",
                transition: "width 0.4s ease, background 0.3s ease",
              }}
            />
          </div>
        </div>
      )}

      {title && (
        <div className="mb-8">
          <div className="form-title-input" style={{ cursor: "default" }}>{title}</div>
        </div>
      )}

      {(schema.content || []).map((node: any, i: number) => (
        <RenderNode
          key={node.attrs?.id || i}
          node={node}
          answers={answers}
          updateAnswer={updateAnswer}
          toggleCheckbox={toggleCheckbox}
          errors={errors}
          visibility={logicResult.visibility}
          isPrinting={isPrinting}
          gpsState={gpsState}
          captureLocationForField={captureLocationForField}
          formId={formId}
          uploadState={uploadState}
          handleImageUpload={handleImageUpload}
        />
      ))}

      <div className="mt-8 print:hidden">
        <button onClick={handleSubmit} className="submit-btn flex items-center gap-2"><span>Submit</span><Send size={16} /></button>
      </div>

      <p className="text-center text-xs text-zinc-400 mt-10 print:hidden">
        Powered by <span className="font-semibold text-zinc-500">FieldTally</span>
      </p>
    </div>
  );
}

// ─── Universal Node Renderer ─────────────────────────────

export function RenderNode({ node, answers, updateAnswer, toggleCheckbox, errors, visibility, isPrinting = false, gpsState, captureLocationForField, formId, uploadState, handleImageUpload }: {
  node: any; answers: Record<string, any>; updateAnswer: (id: string, v: any) => void;
  toggleCheckbox: (id: string, opt: string) => void; errors: Record<string, string>;
  visibility: Record<string, boolean>;
  isPrinting?: boolean;
  gpsState?: Record<string, { loading: boolean; error: string | null }>;
  captureLocationForField?: (id: string) => void;
  formId?: string;
  uploadState?: Record<string, { loading: boolean; error: string | null }>;
  handleImageUpload?: (id: string, file: File, formId: string) => void;
}) {
  const id = node.attrs?.id;

  // Logic blocks: hidden, logic runs via parent
  if (node.type === "logicBlock") return null;

  // Form blocks with IDs: check visibility
  if (id && visibility[id] === false) return null;

  const hasError = id ? !!errors[id] : false;
  const required = node.attrs?.required === true || node.attrs?.required === "true";

  // ── Paragraph ──
  if (node.type === "paragraph") {
    if (!node.content || node.content.length === 0) return <p className="min-h-[1.5em]">&nbsp;</p>;
    return <p>{renderInlineContent(node.content)}</p>;
  }

  // ── Heading ──
  if (node.type === "heading") {
    const level = Math.min(Math.max(Number(node.attrs?.level || 1), 1), 6);
    const Tag = `h${level}` as ElementType;
    return <Tag>{renderInlineContent(node.content)}</Tag>;
  }

  // ── Blockquote ──
  if (node.type === "blockquote") {
    return (
      <blockquote>
        {(node.content || []).map((c: any, i: number) => (
          <RenderNode key={i} node={c} answers={answers} updateAnswer={updateAnswer} toggleCheckbox={toggleCheckbox} errors={errors} visibility={visibility} isPrinting={isPrinting} gpsState={gpsState} captureLocationForField={captureLocationForField} formId={formId} uploadState={uploadState} handleImageUpload={handleImageUpload} />
        ))}
      </blockquote>
    );
  }

  // ── Code block ──
  if (node.type === "codeBlock") {
    return <pre className="bg-zinc-100 rounded-lg p-4 text-sm overflow-x-auto"><code>{extractText(node.content)}</code></pre>;
  }

  // ── Horizontal rule ──
  if (node.type === "horizontalRule") return <hr className="my-4 border-zinc-200" />;

  // ── Bullet list ──
  if (node.type === "bulletList") {
    return <ul>{(node.content || []).map((li: any, i: number) => <RenderNode key={i} node={li} answers={answers} updateAnswer={updateAnswer} toggleCheckbox={toggleCheckbox} errors={errors} visibility={visibility} isPrinting={isPrinting} gpsState={gpsState} captureLocationForField={captureLocationForField} formId={formId} uploadState={uploadState} handleImageUpload={handleImageUpload} />)}</ul>;
  }

  // ── Ordered list ──
  if (node.type === "orderedList") {
    return <ol>{(node.content || []).map((li: any, i: number) => <RenderNode key={i} node={li} answers={answers} updateAnswer={updateAnswer} toggleCheckbox={toggleCheckbox} errors={errors} visibility={visibility} isPrinting={isPrinting} gpsState={gpsState} captureLocationForField={captureLocationForField} formId={formId} uploadState={uploadState} handleImageUpload={handleImageUpload} />)}</ol>;
  }

  // ── List item ──
  if (node.type === "listItem") {
    return <li>{(node.content || []).map((c: any, i: number) => <RenderNode key={i} node={c} answers={answers} updateAnswer={updateAnswer} toggleCheckbox={toggleCheckbox} errors={errors} visibility={visibility} isPrinting={isPrinting} gpsState={gpsState} captureLocationForField={captureLocationForField} formId={formId} uploadState={uploadState} handleImageUpload={handleImageUpload} />)}</li>;
  }

  // ── Task list ──
  if (node.type === "taskList") {
    return <ul data-type="taskList">{(node.content || []).map((li: any, i: number) => <RenderNode key={i} node={li} answers={answers} updateAnswer={updateAnswer} toggleCheckbox={toggleCheckbox} errors={errors} visibility={visibility} isPrinting={isPrinting} gpsState={gpsState} captureLocationForField={captureLocationForField} formId={formId} uploadState={uploadState} handleImageUpload={handleImageUpload} />)}</ul>;
  }
  if (node.type === "taskItem") {
    return (
      <li data-checked={node.attrs?.checked ? "true" : "false"}>
        <label><input type="checkbox" readOnly checked={node.attrs?.checked} /></label>
        <div>{(node.content || []).map((c: any, i: number) => <RenderNode key={i} node={c} answers={answers} updateAnswer={updateAnswer} toggleCheckbox={toggleCheckbox} errors={errors} visibility={visibility} isPrinting={isPrinting} gpsState={gpsState} captureLocationForField={captureLocationForField} formId={formId} uploadState={uploadState} handleImageUpload={handleImageUpload} />)}</div>
      </li>
    );
  }

  // ── Text-input form blocks (short, number, email, date, time) ──
  if (TEXT_INPUT_TYPES.includes(node.type)) {
    const placeholder = node.attrs?.placeholder || "";
    const maxLen = INPUT_LIMITS[node.type];
    const currentVal: string = answers[id] || "";
    return (
      <div id={id ? `field-${id}` : undefined} className={blockClass(node.type)} data-required={required ? "true" : undefined}>
        <div className="question-title-row">
          <div className={`${titleCls(node.type)} outline-none`}>{renderInlineContent(node.content)}</div>
          {required && <span className="required-badge">*</span>}
        </div>
        {isPrinting && placeholder && (
          <p className="text-xs text-zinc-400 italic mt-1 mb-1.5">
            Note: {placeholder}
          </p>
        )}
        <div style={{ position: "relative" }}>
          <input
            className={`block-placeholder-input ${hasError ? "preview-error-field" : ""}`}
            type={getInputType(node.type)}
            placeholder={isPrinting ? "" : (placeholder || "")}
            value={currentVal}
            maxLength={maxLen}
            onChange={e => updateAnswer(id, e.target.value)}
            style={{ color: "#3f3f46", paddingRight: (!isPrinting && maxLen) ? "3rem" : undefined }}
          />
          {!isPrinting && maxLen && (
            <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: "0.7rem", color: currentVal.length >= maxLen ? "#ef4444" : "#a1a1aa" }}>
              {currentVal.length}/{maxLen}
            </span>
          )}
        </div>
        {hasError && <p className="text-red-500 text-xs mt-1 font-medium">{errors[id]}</p>}
      </div>
    );
  }

  // ── Phone answer (split: country code + 10-digit number) ──
  if (node.type === "phoneAnswerBlock") {
    const placeholder = node.attrs?.placeholder || "";
    const stored: string = answers[id] || "";
    const spaceIdx = stored.indexOf(" ");
    const storedCC = spaceIdx > 0 ? stored.slice(1, spaceIdx) : "91";
    const storedNum = spaceIdx > 0 ? stored.slice(spaceIdx + 1) : "";
    return (
      <div id={id ? `field-${id}` : undefined} className="phone-answer-block" data-required={required ? "true" : undefined}>
        <div className="question-title-row">
          <div className="phone-answer-title outline-none">{renderInlineContent(node.content)}</div>
          {required && <span className="required-badge">*</span>}
        </div>
        {isPrinting && placeholder && (
          <p className="text-xs text-zinc-400 italic mt-1 mb-1.5">
            Note: {placeholder}
          </p>
        )}
        <div className={`phone-answer-field ${hasError ? "preview-error-field" : ""}`}>
          <span className="phone-cc-prefix">+</span>
          <input
            type="text"
            inputMode="numeric"
            maxLength={4}
            value={storedCC}
            onChange={e => {
              const cc = e.target.value.replace(/\D/g, "");
              updateAnswer(id, `+${cc} ${storedNum}`);
            }}
            className="phone-cc-input"
            style={{ width: `${Math.max(1, storedCC.length)}ch` }}
          />
          <span className="phone-separator">|</span>
          <input
            className="phone-num-input"
            type="tel"
            inputMode="numeric"
            placeholder={isPrinting ? "" : (placeholder || "")}
            maxLength={10}
            value={storedNum}
            onChange={e => {
              const num = e.target.value.replace(/\D/g, "").slice(0, 10);
              updateAnswer(id, `+${storedCC} ${num}`);
            }}
          />
        </div>
        {hasError && <p className="text-red-500 text-xs mt-1 font-medium">{errors[id]}</p>}
      </div>
    );
  }

  // ── Link answer ──
  if (node.type === "linkAnswerBlock") {
    const placeholder = node.attrs?.placeholder || "";
    return (
      <div id={id ? `field-${id}` : undefined} className="link-answer-block" data-required={required ? "true" : undefined}>
        <div className="question-title-row">
          <div className="link-answer-title outline-none">{renderInlineContent(node.content)}</div>
          {required && <span className="required-badge">*</span>}
        </div>
        {isPrinting && placeholder && (
          <p className="text-xs text-zinc-400 italic mt-1 mb-1.5">
            Note: {placeholder}
          </p>
        )}
        <div className="link-answer-field">
          <span className="text-zinc-400 text-sm select-none">https://</span>
          <input
            className={`block-placeholder-input ${hasError ? "preview-error-field" : ""}`}
            type="url"
            placeholder={isPrinting ? "" : (placeholder || "")}
            value={answers[id] || ""}
            onChange={e => updateAnswer(id, e.target.value)}
            style={{ color: "#3f3f46" }}
          />
        </div>
        {hasError && <p className="text-red-500 text-xs mt-1 font-medium">{errors[id]}</p>}
      </div>
    );
  }

  // ── Long answer ──
  if (node.type === "longAnswerBlock") {
    const placeholder = node.attrs?.placeholder || "";
    const rows = node.attrs?.rows || 3;
    return (
      <div id={id ? `field-${id}` : undefined} className="long-answer-block" data-required={required ? "true" : undefined}>
        <div className="question-title-row">
          <div className="long-answer-title outline-none">{renderInlineContent(node.content)}</div>
          {required && <span className="required-badge">*</span>}
        </div>
        {isPrinting && placeholder && (
          <p className="text-xs text-zinc-400 italic mt-1 mb-1.5">
            Note: {placeholder}
          </p>
        )}
        <div className="long-answer-field-wrapper">
          <textarea
            className={`block-placeholder-input long-answer-textarea ${hasError ? "preview-error-field" : ""}`}
            placeholder={isPrinting ? "" : (placeholder || "")}
            rows={rows}
            value={answers[id] || ""}
            onChange={e => updateAnswer(id, e.target.value)}
            style={{ color: "#3f3f46" }}
          />
        </div>
        {hasError && <p className="text-red-500 text-xs mt-1 font-medium">{errors[id]}</p>}
      </div>
    );
  }

  // ── Checkbox block ──
  if (node.type === "checkboxBlock") {
    const titleNode = node.content?.find((c: any) => c.type === "checkboxTitle");
    const optionNodes = node.content?.filter((c: any) => c.type === "checkboxOption") || [];
    const selected: string[] = answers[id] || [];
    return (
      <div id={id ? `field-${id}` : undefined} data-type="checkbox-block" data-required={required ? "true" : undefined}>
        <div data-type="checkbox-title">
          {renderInlineContent(titleNode?.content)}
          {required && <span className="required-badge ml-2">*</span>}
        </div>
        {optionNodes.map((opt: any, i: number) => {
          const text = extractText(opt.content);
          if (!text.trim() && !isPrinting) return null;
          const displayTxt = text.trim() ? text : `Option ${i + 1}`;
          const isChecked = selected.includes(displayTxt);
          return (
            <div key={i} data-type="checkbox-option" className="cursor-pointer" onClick={() => toggleCheckbox(id, displayTxt)}>
              <div className="option-marker" style={{ background: isChecked ? "#232323" : "transparent", borderColor: isChecked ? "#232323" : "#ccc", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {isChecked && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <div className="option-content" style={{ cursor: "pointer", color: text.trim() ? "inherit" : "#adb5bd" }}>{displayTxt}</div>
            </div>
          );
        })}
        {hasError && <p className="text-red-500 text-xs mt-1 font-medium">{errors[id]}</p>}
      </div>
    );
  }

  // ── Multiple choice block ──
  if (node.type === "multipleChoiceBlock") {
    const titleNode = node.content?.find((c: any) => c.type === "multipleChoiceTitle");
    const optionNodes = node.content?.filter((c: any) => c.type === "multipleChoiceOption") || [];
    const selected = answers[id] || "";
    return (
      <div id={id ? `field-${id}` : undefined} data-type="multiple-choice-block" data-required={required ? "true" : undefined}>
        <div data-type="multiple-choice-title">
          {renderInlineContent(titleNode?.content)}
          {required && <span className="required-badge ml-2">*</span>}
        </div>
        {optionNodes.map((opt: any, i: number) => {
          const text = extractText(opt.content);
          if (!text.trim() && !isPrinting) return null;
          const displayTxt = text.trim() ? text : `Option ${i + 1}`;
          const isSelected = selected === displayTxt;
          return (
            <div key={i} data-type="multiple-choice-option" className="cursor-pointer" onClick={() => updateAnswer(id, displayTxt)}>
              <div className="option-marker" style={{ background: isSelected ? "#232323" : "transparent", borderColor: isSelected ? "#232323" : "#ccc", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {isSelected && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "white" }} />}
              </div>
              <div className="option-content" style={{ cursor: "pointer", color: text.trim() ? "inherit" : "#adb5bd" }}>{displayTxt}</div>
            </div>
          );
        })}
        {hasError && <p className="text-red-500 text-xs mt-1 font-medium">{errors[id]}</p>}
      </div>
    );
  }

  // ── GPS Answer Block ──
  if (node.type === "gpsAnswerBlock") {
    const value = answers[id];
    const isCaptured = !!(value?.latitude && value?.longitude);
    const fieldGpsState = gpsState?.[id] || { loading: false, error: null };

    return (
      <div id={id ? `field-${id}` : undefined} className="gps-answer-block" data-required={required ? "true" : undefined}>
        <div className="question-title-row">
          <div className="gps-answer-title outline-none">{renderInlineContent(node.content)}</div>
          {required && <span className="required-badge">*</span>}
        </div>
        
        <div className="mt-2">
          {isPrinting ? (
            <div className="flex gap-6 w-full">
              <div className="flex-1 flex flex-col gap-1">
                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Latitude</span>
                <input
                  type="text"
                  className="block-placeholder-input !mt-1 !mb-0"
                  placeholder=""
                  readOnly
                  value={value?.latitude != null ? value.latitude.toString() : ""}
                />
              </div>
              <div className="flex-1 flex flex-col gap-1">
                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Longitude</span>
                <input
                  type="text"
                  className="block-placeholder-input !mt-1 !mb-0"
                  placeholder=""
                  readOnly
                  value={value?.longitude != null ? value.longitude.toString() : ""}
                />
              </div>
            </div>
          ) : (
            <div className={`mt-2 flex flex-col gap-2 p-4 border rounded-xl bg-white shadow-xs transition-all ${hasError ? "border-red-300 bg-red-25/25" : "border-zinc-200"}`}>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {/* Checkbox indicator */}
                  <div 
                    className="w-5 h-5 rounded border flex items-center justify-center transition-all select-none"
                    style={{ 
                      background: isCaptured ? "#22c55e" : "#f4f4f5", 
                      borderColor: isCaptured ? "#22c55e" : "#d4d4d8" 
                    }}
                  >
                    {isCaptured && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>

                  {/* Status information */}
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-zinc-800">
                      {isCaptured 
                        ? "Location Captured" 
                        : fieldGpsState.loading 
                          ? "Acquiring coordinates..." 
                          : "Location not captured"
                      }
                    </span>
                    
                    {isCaptured && (
                      <span className="text-xs text-zinc-500 font-medium tabular-nums mt-0.5">
                        Lat: {value.latitude.toFixed(6)}, Lng: {value.longitude.toFixed(6)}
                        {value.accuracy && ` (±${Math.round(value.accuracy)}m)`}
                      </span>
                    )}

                    {!isCaptured && fieldGpsState.error && (
                      <span className="text-xs text-red-500 font-semibold mt-0.5">
                        {fieldGpsState.error}
                      </span>
                    )}
                  </div>
                </div>

                {/* Action button */}
                {!isPrinting && (
                  <div>
                    {required ? (
                      (!isCaptured && !fieldGpsState.loading) && (
                        <button
                          type="button"
                          onClick={() => captureLocationForField?.(id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 hover:border-zinc-300 rounded-lg shadow-2xs transition-all cursor-pointer"
                        >
                          <RefreshCw size={13} className={fieldGpsState.loading ? "animate-spin" : ""} />
                          <span>Retry</span>
                        </button>
                      )
                    ) : (
                      <button
                        type="button"
                        disabled={fieldGpsState.loading}
                        onClick={() => captureLocationForField?.(id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-200 disabled:text-zinc-400 rounded-lg shadow-2xs transition-all cursor-pointer"
                      >
                        {fieldGpsState.loading ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : isCaptured ? (
                          <RefreshCw size={13} />
                        ) : (
                          <Upload size={13} />
                        )}
                        <span>{isCaptured ? "Update Location" : "Capture Location"}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        {hasError && <p className="text-red-500 text-xs mt-1 font-medium">{errors[id]}</p>}
      </div>
    );
  }

  // ── Image Answer Block ──
  if (node.type === "imageAnswerBlock") {
    const value = answers[id];
    const fieldUploadState = uploadState?.[id] || { loading: false, error: null };

    return (
      <div id={id ? `field-${id}` : undefined} className="image-answer-block" data-required={required ? "true" : undefined}>
        <div className="question-title-row">
          <div className="image-answer-title outline-none">{renderInlineContent(node.content)}</div>
          {required && <span className="required-badge">*</span>}
        </div>
        
        <div className="mt-2">
          {value ? (
            <div className="relative w-full max-w-sm rounded-lg overflow-hidden border border-zinc-200 bg-zinc-50 p-2 group">
              <img src={value} alt="Upload preview" className="w-full max-h-48 object-contain rounded" />
              {!isPrinting && (
                <button
                  type="button"
                  onClick={() => updateAnswer(id, null)}
                  className="absolute top-4 right-4 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 hover:scale-105 transition-all cursor-pointer shadow-xs animate-in fade-in"
                  title="Remove Image"
                >
                  <Trash size={14} />
                </button>
              )}
            </div>
          ) : (
            <div 
              className={`image-print-box flex flex-col items-center justify-center border border-dashed rounded-xl bg-zinc-50 hover:bg-zinc-100/70 transition-all cursor-pointer relative ${hasError ? "border-red-300 bg-red-25/25" : "border-zinc-200"}`}
              style={{ minHeight: isPrinting ? "300px" : "auto", padding: isPrinting ? "40px" : "24px" }}
            >
              {!isPrinting && (
                <input
                  type="file"
                  accept="image/*"
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && formId && handleImageUpload) {
                      handleImageUpload(id, file, formId);
                    }
                  }}
                  disabled={fieldUploadState.loading}
                />
              )}
              {fieldUploadState.loading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                  <span className="text-xs text-zinc-500 font-medium">Uploading image...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1.5 text-center select-none">
                  <Upload className="w-6 h-6 text-zinc-400" />
                  <span className="text-sm font-semibold text-zinc-700">
                    {isPrinting ? "Attach the image here" : "Upload Image File"}
                  </span>
                  {!isPrinting && <span className="text-xs text-zinc-400">Click or drag image file here</span>}
                </div>
              )}
              {fieldUploadState.error && (
                <span className="text-xs text-red-500 font-semibold mt-2">{fieldUploadState.error}</span>
              )}
            </div>
          )}
        </div>
        {hasError && <p className="text-red-500 text-xs mt-1 font-medium">{errors[id]}</p>}
      </div>
    );
  }

  // ── Signature Answer Block ──
  if (node.type === "signatureAnswerBlock") {
    const value = answers[id];

    return (
      <div id={id ? `field-${id}` : undefined} className="signature-answer-block" data-required={required ? "true" : undefined}>
        <div className="question-title-row">
          <div className="signature-answer-title outline-none">{renderInlineContent(node.content)}</div>
          {required && <span className="required-badge">*</span>}
        </div>
        
        <div className="mt-2">
          {isPrinting ? (
            value ? (
              <div 
                className="border border-zinc-200 rounded-lg p-2 flex items-center justify-center relative overflow-hidden select-none"
                style={{ width: "300px", aspectRatio: "7/3" }}
              >
                <img src={value} alt="Signature" className="h-full max-w-full object-contain" />
              </div>
            ) : (
              <div 
                className="signature-print-box border border-zinc-300 border-dashed rounded-lg bg-zinc-50/50 flex flex-col justify-end p-3 relative overflow-hidden select-none"
                style={{ width: "300px", aspectRatio: "7/3" }}
              >
                <div className="absolute top-2 right-2 flex items-center gap-1">
                  <PenTool size={10} className="text-zinc-400" />
                  <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-wider">Sign here</span>
                </div>
              </div>
            )
          ) : (
            formId && (
              <SignaturePad
                id={id}
                formId={formId}
                value={value}
                required={required}
                onChange={(url) => updateAnswer(id, url)}
                hasError={hasError}
              />
            )
          )}
        </div>
        {hasError && <p className="text-red-500 text-xs mt-1 font-medium">{errors[id]}</p>}
      </div>
    );
  }

  return null;
}

// ─── Interactive Signature Pad ──────────────────────────

interface SignaturePadProps {
  id: string;
  formId: string;
  value?: string;
  required?: boolean;
  onChange: (url: string | null) => void;
  hasError?: boolean;
}

export function SignaturePad({ id, formId, value, onChange, hasError }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const uploadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || value) return;

    // Fix internal resolution to exactly 1000x600 (5:3 aspect ratio) for retina sharpness
    canvas.width = 1000;
    canvas.height = 600;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#18181b"; // zinc-900
      ctx.lineWidth = 4.0; // Adjusted stroke width for 1000x600 resolution
      ctxRef.current = ctx;
    }
  }, [value]);

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !ctxRef.current) return;

    canvas.setPointerCapture(e.pointerId);

    const rect = canvas.getBoundingClientRect();
    // Scale client mouse/touch position to canvas coordinate space
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;

    ctxRef.current.beginPath();
    ctxRef.current.moveTo(x, y);
    setIsDrawing(true);

    if (uploadTimeoutRef.current) clearTimeout(uploadTimeoutRef.current);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!isDrawing || !ctxRef.current || !canvas) return;

    const rect = canvas.getBoundingClientRect();
    // Scale coordinates proportionally to canvas space
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;

    ctxRef.current.lineTo(x, y);
    ctxRef.current.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (uploadTimeoutRef.current) clearTimeout(uploadTimeoutRef.current);
    uploadTimeoutRef.current = setTimeout(uploadToStorage, 1500);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !ctxRef.current) {
      onChange(null);
      setStatus("idle");
      return;
    }
    ctxRef.current.clearRect(0, 0, canvas.width, canvas.height);
    onChange(null);
    setStatus("idle");
    if (uploadTimeoutRef.current) clearTimeout(uploadTimeoutRef.current);
  };

  const uploadToStorage = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setStatus("saving");

    if (formId === "preview") {
      const base64 = canvas.toDataURL("image/png");
      onChange(base64);
      setStatus("saved");
      return;
    }

    // Upload will automatically be exactly 500x300 as fixed by canvas.width/height
    canvas.toBlob(async (blob) => {
      if (!blob) {
        setStatus("error");
        setErrorMessage("Failed to capture canvas");
        return;
      }

      try {
        const fileName = `${id}-${Date.now()}.png`;
        const filePath = `submissions/${formId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('fieldtally')
          .upload(filePath, blob, { contentType: 'image/png' });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('fieldtally').getPublicUrl(filePath);
        if (!data?.publicUrl) throw new Error("Failed to get URL");

        onChange(data.publicUrl);
        setStatus("saved");
      } catch (err: any) {
        console.error("Signature save error:", err);
        setStatus("error");
        setErrorMessage(err.message || "Failed to upload signature");
      }
    }, 'image/png');
  };

  return (
    <div className={`flex flex-col gap-2 p-4 border rounded-xl bg-white shadow-xs transition-all ${hasError ? "border-red-300 bg-red-25/25" : "border-zinc-200"}`}>
      {value ? (
        <div className="flex flex-col items-center gap-3">
          <div className="w-full aspect-[5/3] bg-zinc-50 border border-zinc-100 rounded-lg flex items-center justify-center p-2 relative overflow-hidden select-none">
            <img src={value} alt="Signature" className="h-full max-w-full object-contain" />
            <span className="absolute top-2 right-2 text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
              Saved
            </span>
          </div>
          <button
            type="button"
            onClick={clearCanvas}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-100 rounded-lg cursor-pointer transition-colors"
          >
            <Trash size={13} />
            <span>Clear & Redraw</span>
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="relative w-full aspect-[5/3] border border-zinc-200 border-dashed rounded-lg bg-zinc-50 overflow-hidden cursor-crosshair">
            <canvas
              ref={canvasRef}
              onPointerDown={startDrawing}
              onPointerMove={draw}
              onPointerUp={stopDrawing}
              className="w-full h-full touch-none"
            />
            <div className="absolute top-2 right-2 flex items-center gap-1.5 pointer-events-none select-none">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all ${
                status === "saving" 
                  ? "text-blue-600 bg-blue-50 border-blue-200 animate-pulse" 
                  : status === "error"
                    ? "text-red-600 bg-red-50 border-red-200"
                    : "text-zinc-400 bg-zinc-100 border-zinc-200"
              }`}>
                {status === "saving" ? "Saving..." : status === "error" ? "Error" : "Draw Signature"}
              </span>
            </div>
            <div className="absolute bottom-6 left-6 right-6 border-t border-zinc-200 border-dotted pointer-events-none" />
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-zinc-400 font-medium">
              {status === "error" ? errorMessage : "Signature is uploaded automatically 1.5s after lifting your pen."}
            </span>
            <button
              type="button"
              onClick={clearCanvas}
              className="px-2 py-1 text-xs text-zinc-500 hover:text-zinc-800 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
