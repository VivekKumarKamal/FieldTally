"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import type { ElementType, ReactNode } from "react";
import { Send, CheckCircle2 } from "lucide-react";
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

function renderInlineContent(content?: any[]): ReactNode[] {
  if (!content) return [];
  return content.map((node, i) => {
    if (node.type === "text") return <span key={i}>{renderMarks(node.text || "", node.marks)}</span>;
    if (node.type === "hardBreak") return <br key={i} />;
    return null;
  });
}

function extractText(content?: any[]): string {
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
};

// ─── FormRenderer ────────────────────────────────────────

export default function FormRenderer({ schema, title, progressBarOffset, onSubmit }: FormRendererProps) {
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

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

        if (req && isEmpty) {
          newErrors[id] = "This field is required";
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
        <div style={{ position: "fixed", top: progressBarOffset || 0, left: 0, right: 0, zIndex: 40 }}>
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
        />
      ))}

      <div className="mt-8">
        <button onClick={handleSubmit} className="submit-btn flex items-center gap-2"><span>Submit</span><Send size={16} /></button>
      </div>

      <p className="text-center text-xs text-zinc-400 mt-10">
        Powered by <span className="font-semibold text-zinc-500">FieldTally</span>
      </p>
    </div>
  );
}

// ─── Universal Node Renderer ─────────────────────────────

function RenderNode({ node, answers, updateAnswer, toggleCheckbox, errors, visibility }: {
  node: any; answers: Record<string, any>; updateAnswer: (id: string, v: any) => void;
  toggleCheckbox: (id: string, opt: string) => void; errors: Record<string, string>;
  visibility: Record<string, boolean>;
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
          <RenderNode key={i} node={c} answers={answers} updateAnswer={updateAnswer} toggleCheckbox={toggleCheckbox} errors={errors} visibility={visibility} />
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
    return <ul>{(node.content || []).map((li: any, i: number) => <RenderNode key={i} node={li} answers={answers} updateAnswer={updateAnswer} toggleCheckbox={toggleCheckbox} errors={errors} visibility={visibility} />)}</ul>;
  }

  // ── Ordered list ──
  if (node.type === "orderedList") {
    return <ol>{(node.content || []).map((li: any, i: number) => <RenderNode key={i} node={li} answers={answers} updateAnswer={updateAnswer} toggleCheckbox={toggleCheckbox} errors={errors} visibility={visibility} />)}</ol>;
  }

  // ── List item ──
  if (node.type === "listItem") {
    return <li>{(node.content || []).map((c: any, i: number) => <RenderNode key={i} node={c} answers={answers} updateAnswer={updateAnswer} toggleCheckbox={toggleCheckbox} errors={errors} visibility={visibility} />)}</li>;
  }

  // ── Task list ──
  if (node.type === "taskList") {
    return <ul data-type="taskList">{(node.content || []).map((li: any, i: number) => <RenderNode key={i} node={li} answers={answers} updateAnswer={updateAnswer} toggleCheckbox={toggleCheckbox} errors={errors} visibility={visibility} />)}</ul>;
  }
  if (node.type === "taskItem") {
    return (
      <li data-checked={node.attrs?.checked ? "true" : "false"}>
        <label><input type="checkbox" readOnly checked={node.attrs?.checked} /></label>
        <div>{(node.content || []).map((c: any, i: number) => <RenderNode key={i} node={c} answers={answers} updateAnswer={updateAnswer} toggleCheckbox={toggleCheckbox} errors={errors} visibility={visibility} />)}</div>
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
        <div style={{ position: "relative" }}>
          <input
            className={`block-placeholder-input ${hasError ? "preview-error-field" : ""}`}
            type={getInputType(node.type)}
            placeholder={placeholder || ""}
            value={currentVal}
            maxLength={maxLen}
            onChange={e => updateAnswer(id, e.target.value)}
            style={{ color: "#3f3f46", paddingRight: maxLen ? "3rem" : undefined }}
          />
          {maxLen && (
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
            placeholder={placeholder || ""}
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
        <div className="link-answer-field">
          <span className="text-zinc-400 text-sm select-none">https://</span>
          <input
            className={`block-placeholder-input ${hasError ? "preview-error-field" : ""}`}
            type="url"
            placeholder={placeholder || ""}
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
        <div className="long-answer-field-wrapper">
          <textarea
            className={`block-placeholder-input long-answer-textarea ${hasError ? "preview-error-field" : ""}`}
            placeholder={placeholder || ""}
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
          if (!text.trim()) return null;
          const isChecked = selected.includes(text);
          return (
            <div key={i} data-type="checkbox-option" className="cursor-pointer" onClick={() => toggleCheckbox(id, text)}>
              <div className="option-marker" style={{ background: isChecked ? "#232323" : "transparent", borderColor: isChecked ? "#232323" : "#ccc", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {isChecked && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <div className="option-content" style={{ cursor: "pointer" }}>{text}</div>
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
          if (!text.trim()) return null;
          const isSelected = selected === text;
          return (
            <div key={i} data-type="multiple-choice-option" className="cursor-pointer" onClick={() => updateAnswer(id, text)}>
              <div className="option-marker" style={{ background: isSelected ? "#232323" : "transparent", borderColor: isSelected ? "#232323" : "#ccc", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {isSelected && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "white" }} />}
              </div>
              <div className="option-content" style={{ cursor: "pointer" }}>{text}</div>
            </div>
          );
        })}
        {hasError && <p className="text-red-500 text-xs mt-1 font-medium">{errors[id]}</p>}
      </div>
    );
  }

  return null;
}
