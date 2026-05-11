import type { Editor as TiptapEditor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";

export interface TurnIntoTarget {
  nodeType: string;
  attrs?: Record<string, any>;
  label: string;
  category: "simple" | "compound" | "generic";
  group: "basic" | "question";
  titleChild?: string;
  optionChild?: string;
}

export const TURN_INTO_TARGETS: Record<string, TurnIntoTarget> = {
  // ── Basic blocks ──
  paragraph:     { nodeType: "paragraph", label: "Text",          category: "generic", group: "basic" },
  "heading-1":   { nodeType: "heading",   label: "Heading 1",     category: "generic", group: "basic", attrs: { level: 1 } },
  "heading-2":   { nodeType: "heading",   label: "Heading 2",     category: "generic", group: "basic", attrs: { level: 2 } },
  "heading-3":   { nodeType: "heading",   label: "Heading 3",     category: "generic", group: "basic", attrs: { level: 3 } },
  bulletList:    { nodeType: "bulletList", label: "Bullet List",   category: "generic", group: "basic" },
  orderedList:   { nodeType: "orderedList",label: "Numbered List", category: "generic", group: "basic" },
  // ── Question blocks ──
  shortAnswerBlock:    { nodeType: "shortAnswerBlock",    label: "Short Answer",    category: "simple",   group: "question" },
  longAnswerBlock:     { nodeType: "longAnswerBlock",     label: "Long Answer",     category: "simple",   group: "question" },
  numberAnswerBlock:   { nodeType: "numberAnswerBlock",   label: "Number",          category: "simple",   group: "question" },
  emailAnswerBlock:    { nodeType: "emailAnswerBlock",    label: "Email",           category: "simple",   group: "question" },
  phoneAnswerBlock:    { nodeType: "phoneAnswerBlock",    label: "Phone",           category: "simple",   group: "question" },
  linkAnswerBlock:     { nodeType: "linkAnswerBlock",     label: "Link",            category: "simple",   group: "question" },
  dateAnswerBlock:     { nodeType: "dateAnswerBlock",     label: "Date",            category: "simple",   group: "question" },
  timeAnswerBlock:     { nodeType: "timeAnswerBlock",     label: "Time",            category: "simple",   group: "question" },
  checkboxBlock:       { nodeType: "checkboxBlock",       label: "Checkboxes",      category: "compound", group: "question", titleChild: "checkboxTitle", optionChild: "checkboxOption" },
  multipleChoiceBlock: { nodeType: "multipleChoiceBlock", label: "Multiple Choice", category: "compound", group: "question", titleChild: "multipleChoiceTitle", optionChild: "multipleChoiceOption" },
};

/** Resolve a ProseMirror node to its TURN_INTO_TARGETS key. */
export function resolveTargetKey(typeName: string, attrs?: Record<string, any>): string | null {
  if (typeName === "heading") return `heading-${attrs?.level || 1}`;
  if (TURN_INTO_TARGETS[typeName]) return typeName;
  return null;
}

/** Check whether a node type supports "Turn Into". */
export function isConvertibleBlock(typeName: string): boolean {
  if (typeName === "logicBlock") return false;
  if (typeName === "heading") return true;
  return typeName in TURN_INTO_TARGETS;
}

// ── Content extraction helpers ──

const extractInlineContent = (node: any): any[] | null => {
  if (node.content && node.content.size > 0) {
    const r: any[] = [];
    node.content.forEach((c: any) => r.push(c.toJSON()));
    return r.length > 0 ? r : null;
  }
  return null;
};

const extractTitleContent = (node: any): any[] | null => {
  const key = resolveTargetKey(node.type.name, node.attrs);
  const meta = key ? TURN_INTO_TARGETS[key] : null;

  if (meta?.category === "simple" || meta?.category === "generic") {
    // paragraph, heading, and simple question blocks hold inline* directly
    if (["paragraph", "heading"].includes(node.type.name) || meta.category === "simple") {
      return extractInlineContent(node);
    }
    // Lists: extract text from first listItem → paragraph
    if (["bulletList", "orderedList"].includes(node.type.name)) {
      const text = node.textContent;
      return text ? [{ type: "text", text }] : null;
    }
    return null;
  }

  if (meta?.category === "compound" && meta.titleChild) {
    const titleNode = node.firstChild;
    if (titleNode?.type.name === meta.titleChild) return extractInlineContent(titleNode);
  }

  // Unknown — fallback
  const text = node.textContent;
  return text ? [{ type: "text", text }] : null;
};

const extractOptionContents = (node: any): any[][] => {
  const key = resolveTargetKey(node.type.name, node.attrs);
  const meta = key ? TURN_INTO_TARGETS[key] : null;
  if (!meta || meta.category !== "compound" || !meta.optionChild) return [];

  const opts: any[][] = [];
  node.forEach((child: any) => {
    if (child.type.name === meta.optionChild) {
      const inlines: any[] = [];
      if (child.content?.size > 0) child.content.forEach((i: any) => inlines.push(i.toJSON()));
      opts.push(inlines);
    }
  });
  return opts;
};

// ── Build target JSON ──

const buildGenericContent = (
  targetKey: string,
  target: TurnIntoTarget,
  titleContent: any[] | null,
): any => {
  const { nodeType, attrs } = target;

  if (nodeType === "paragraph" || nodeType === "heading") {
    return { type: nodeType, attrs, content: titleContent || undefined };
  }

  // Lists: wrap in listItem → paragraph
  if (nodeType === "bulletList" || nodeType === "orderedList") {
    return {
      type: nodeType,
      content: [{
        type: "listItem",
        content: [{ type: "paragraph", content: titleContent || undefined }],
      }],
    };
  }

  return null;
};

const buildQuestionContent = (
  target: TurnIntoTarget,
  titleContent: any[] | null,
  optionContents: any[][],
  attrs: Record<string, any>,
): any => {
  if (target.category === "simple") {
    return {
      type: target.nodeType,
      attrs: { ...attrs, placeholder: attrs.placeholder || "" },
      content: titleContent || undefined,
    };
  }

  if (target.category === "compound") {
    const titleChild = { type: target.titleChild!, content: titleContent || undefined };
    const options = optionContents.length > 0
      ? optionContents.map(c => ({ type: target.optionChild!, content: c.length > 0 ? c : undefined }))
      : [{ type: target.optionChild! }];
    return { type: target.nodeType, attrs, content: [titleChild, ...options] };
  }

  return null;
};

// ── Main conversion function ──

export function turnBlockInto(editor: TiptapEditor, pos: number, targetKey: string): boolean {
  const { state } = editor;
  const node = state.doc.nodeAt(pos);
  if (!node) return false;

  const currentKey = resolveTargetKey(node.type.name, node.attrs);
  if (currentKey === targetKey) return false;
  if (node.type.name === "logicBlock") return false;

  const target = TURN_INTO_TARGETS[targetKey];
  if (!target) return false;

  const titleContent = extractTitleContent(node);
  const optionContents = extractOptionContents(node);

  // Shared attributes for question blocks
  const sharedAttrs: Record<string, any> = {};
  if (node.attrs.required !== undefined) sharedAttrs.required = node.attrs.required;
  if (node.attrs.id) sharedAttrs.id = node.attrs.id;
  if (node.attrs.logic) sharedAttrs.logic = node.attrs.logic;
  if (node.attrs.placeholder) sharedAttrs.placeholder = node.attrs.placeholder;

  let newContent: any;
  if (target.group === "basic") {
    newContent = buildGenericContent(targetKey, target, titleContent);
  } else {
    newContent = buildQuestionContent(target, titleContent, optionContents, sharedAttrs);
  }
  if (!newContent) return false;

  const from = pos;
  const to = pos + node.nodeSize;
  const tr = state.tr;
  tr.replaceWith(from, to, state.schema.nodeFromJSON(newContent));

  try {
    const newNode = tr.doc.nodeAt(from);
    if (newNode) {
      let cursorPos: number;
      if (target.category === "compound") {
        cursorPos = from + 2;
      } else if (target.nodeType === "bulletList" || target.nodeType === "orderedList") {
        cursorPos = from + 3; // list > listItem > paragraph
      } else {
        cursorPos = from + 1;
      }
      cursorPos = Math.min(cursorPos, tr.doc.content.size);
      tr.setSelection(TextSelection.create(tr.doc, cursorPos));
    }
  } catch { /* cursor positioning is best-effort */ }

  editor.view.dispatch(tr);
  return true;
}
