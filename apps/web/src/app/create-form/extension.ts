import {
  TiptapLink,
  UpdatedImage,
  TaskList,
  TaskItem,
  HorizontalRule,
  StarterKit,
  Placeholder,
  GlobalDragHandle,
} from "novel";

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import Underline from "@tiptap/extension-underline";
import { cx } from "class-variance-authority";
import { CheckboxBlock, CheckboxTitle, CheckboxOption } from "../extensions/checkboxes";
import { MultipleChoiceBlock, MultipleChoiceTitle, MultipleChoiceOption } from "../extensions/multipleChoice";
import { ShortAnswerBlock } from "../extensions/shortAnswer";
import { NumberAnswerBlock } from "../extensions/numberAnswer";
import { EmailAnswerBlock } from "../extensions/emailAnswer";
import { PhoneAnswerBlock } from "../extensions/phoneAnswer";
import { LinkAnswerBlock } from "../extensions/linkAnswer";
import { DateAnswerBlock } from "../extensions/dateAnswer";
import { TimeAnswerBlock } from "../extensions/timeAnswer";
import { LongAnswerBlock } from "../extensions/longAnswer";
import { LogicBlock } from "../extensions/logicBlock";
import { GpsAnswerBlock } from "../extensions/gpsAnswer";
import { ImageAnswerBlock } from "../extensions/imageAnswer";
import { SignatureAnswerBlock } from "../extensions/signatureAnswer";

const ID_BLOCK_TYPES = [
  "shortAnswerBlock",
  "longAnswerBlock",
  "numberAnswerBlock",
  "emailAnswerBlock",
  "phoneAnswerBlock",
  "linkAnswerBlock",
  "dateAnswerBlock",
  "timeAnswerBlock",
  "checkboxBlock",
  "multipleChoiceBlock",
  "logicBlock",
  "gpsAnswerBlock",
  "imageAnswerBlock",
  "signatureAnswerBlock",
];

const QUIZ_BLOCK_TYPES = [
  "multipleChoiceBlock",
  "checkboxBlock",
  "numberAnswerBlock",
];

export const QuizAttribute = Extension.create({
  name: "quizAttribute",
  addGlobalAttributes() {
    return [
      {
        types: QUIZ_BLOCK_TYPES,
        attributes: {
          correctAnswer: {
            default: null,
            renderHTML: attributes => {
              if (attributes.correctAnswer == null) return {};
              return { "data-correct-answer": JSON.stringify(attributes.correctAnswer) };
            },
            parseHTML: element => {
              const raw = element.getAttribute("data-correct-answer");
              if (!raw) return null;
              try { return JSON.parse(raw); } catch { return null; }
            },
          },
          quizPoints: {
            default: 1,
            renderHTML: attributes => {
              if (attributes.quizPoints === 1) return {};
              return { "data-quiz-points": String(attributes.quizPoints) };
            },
            parseHTML: element => {
              const raw = element.getAttribute("data-quiz-points");
              return raw ? Number(raw) : 1;
            },
          },
        },
      },
    ];
  },
});

export const DocumentAttributes = Extension.create({
  name: "documentAttributes",
  addGlobalAttributes() {
    return [
      {
        types: ["doc"],
        attributes: {
          quizMode: {
            default: false,
            renderHTML: attributes => {
              return {
                "data-quiz-mode": attributes.quizMode ? "true" : "false",
              };
            },
            parseHTML: element => element.getAttribute("data-quiz-mode") === "true",
          },
          showResultsImmediately: {
            default: true,
            renderHTML: attributes => {
              return {
                "data-show-results-immediately": attributes.showResultsImmediately ? "true" : "false",
              };
            },
            parseHTML: element => element.getAttribute("data-show-results-immediately") !== "false",
          },
        },
      },
    ];
  },
});

export const RequiredAttribute = Extension.create({
  name: "requiredAttribute",
  addGlobalAttributes() {
    return [
      {
        types: [
          "shortAnswerBlock", 
          "numberAnswerBlock", 
          "emailAnswerBlock", 
          "phoneAnswerBlock", 
          "linkAnswerBlock", 
          "dateAnswerBlock", 
          "timeAnswerBlock",
          "checkboxBlock",
          "multipleChoiceBlock",
          "longAnswerBlock",
          "logicBlock",
          "gpsAnswerBlock",
          "imageAnswerBlock",
          "signatureAnswerBlock",
        ],
        attributes: {
          required: {
            default: true,
            renderHTML: attributes => {
              return { "data-required": attributes.required ? "true" : "false" };
            },
            parseHTML: element => element.getAttribute("data-required") !== "false",
          },
          logic: {
            default: [],
            renderHTML: attributes => ({ "data-logic": JSON.stringify(attributes.logic || []) }),
            parseHTML: element => JSON.parse(element.getAttribute("data-logic") || "[]"),
          }
        },
      },
    ];
  },
});

const dragHandle = GlobalDragHandle.configure({
  dragHandleSelector: ".custom-drag-handle",
  // dragHandleWidth controls: (1) node detection X offset (clientX + 50 + width),
  // (2) handle left position (blockLeft - width). Keep it small so detection
  // doesn't overshoot into the wrong block.
  dragHandleWidth: 100,
  customNodes: ["checkbox-block", "multiple-choice-block", "short-answer-block", "number-answer-block", "email-answer-block", "phone-answer-block", "link-answer-block", "date-answer-block", "time-answer-block", "long-answer-block", "logic-block", "gps-answer-block", "image-answer-block", "signature-answer-block"],
});

// TODO I am using cx here to get tailwind autocomplete working, idk if someone else can write a regex to just capture the class key in objects

// Custom placeholder per node type.
// All blocks always show placeholder when empty, except plain text paragraphs
// which only show "Press '/'" when the cursor is there.
const placeholder = Placeholder.configure({
  placeholder: ({ node, editor, pos, hasAnchor }) => {
    if (node.type.name === "heading") {
      return `Heading ${node.attrs.level}`;
    }
    if (node.type.name === "codeBlock") {
      return "Write some code...";
    }
    if (node.type.name === "checkboxTitle") return "Type your question...";
    if (node.type.name === "checkboxOption") return ""; // CSS handles this
    if (node.type.name === "multipleChoiceTitle") return "Type your question...";
    if (node.type.name === "multipleChoiceOption") return ""; // CSS handles this
    if (node.type.name === "shortAnswerBlock") return "Type your question...";
    if (node.type.name === "numberAnswerBlock") return "Type your question...";
    if (node.type.name === "emailAnswerBlock") return "Type your question...";
    if (node.type.name === "phoneAnswerBlock") return "Type your question...";
    if (node.type.name === "linkAnswerBlock") return "Type your question...";
    if (node.type.name === "dateAnswerBlock") return "Type your question...";
    if (node.type.name === "timeAnswerBlock") return "Type your question...";
    if (node.type.name === "longAnswerBlock") return "Type your question...";
    if (node.type.name === "gpsAnswerBlock") return "Type your question...";
    if (node.type.name === "imageAnswerBlock") return "Type your question...";
    if (node.type.name === "signatureAnswerBlock") return "Type your question...";

    // Check parent context for lists/quotes
    const $pos = editor.state.doc.resolve(pos);
    if ($pos.depth > 1) {
      const parent = $pos.node($pos.depth - 1);
      if (parent.type.name === "listItem") return "List item";
      if (parent.type.name === "taskItem") return "To-do";
      if (parent.type.name === "blockquote") return "Type a quote...";
    }

    // Plain text paragraph: only show when cursor is there
    if (!hasAnchor) return "";
    return "Press '/' for commands";
  },
  includeChildren: true,
  showOnlyCurrent: false,
});
const tiptapLink = TiptapLink.configure({
  HTMLAttributes: {
    class: cx(
      "text-muted-foreground underline underline-offset-[3px] hover:text-primary transition-colors cursor-pointer",
    ),
  },
});

const taskList = TaskList.configure({
  HTMLAttributes: {
    class: cx("not-prose pl-2"),
  },
});
const taskItem = TaskItem.configure({
  HTMLAttributes: {
    class: cx("flex items-start my-4"),
  },
  nested: true,
});

const horizontalRule = HorizontalRule.configure({
  HTMLAttributes: {
    class: cx("mt-4 mb-6 border-t border-muted-foreground"),
  },
});

const starterKit = StarterKit.configure({
  bulletList: {
    HTMLAttributes: {
      class: cx("list-disc list-outside leading-3 -mt-2"),
    },
  },
  orderedList: {
    HTMLAttributes: {
      class: cx("list-decimal list-outside leading-3 -mt-2"),
    },
  },
  listItem: {
    HTMLAttributes: {
      class: cx("leading-normal -mb-2"),
    },
  },
  blockquote: {
    HTMLAttributes: {
      class: cx("border-l-2 border-primary my-4 text-zinc-600"),
    },
  },
  codeBlock: {
    HTMLAttributes: {
      class: cx("rounded-sm bg-muted border p-5 font-mono font-medium"),
    },
  },
  code: {
    HTMLAttributes: {
      class: cx("rounded-md bg-muted  px-1.5 py-1 font-mono font-medium"),
      spellcheck: "false",
    },
  },
  horizontalRule: false,
  dropcursor: {
    color: "#DBEAFE",
    width: 4,
  },
  gapcursor: false,
});

export const UniqueIdExtension = Extension.create({
  name: "fieldTallyUniqueId",

  addGlobalAttributes() {
    return [
      {
        types: ID_BLOCK_TYPES,
        attributes: {
          id: {
            default: null,
            renderHTML: attributes => {
              if (!attributes.id) return {};
              return { "data-id": attributes.id };
            },
            parseHTML: element => element.getAttribute("data-id"),
          },
        },
      },
    ];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("fieldTallyUniqueId"),
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some(transaction => transaction.docChanged)) return null;

          const seen = new Set<string>();
          const tr = newState.tr;

          newState.doc.descendants((node, pos) => {
            if (!ID_BLOCK_TYPES.includes(node.type.name)) return;

            const currentId = node.attrs.id;
            if (typeof currentId === "string" && currentId && !seen.has(currentId)) {
              seen.add(currentId);
              return;
            }

            const id = crypto.randomUUID();
            seen.add(id);
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, id });
          });

          return tr.steps.length > 0 ? tr : null;
        },
      }),
    ];
  },
});

export const defaultExtensions = [
  UniqueIdExtension,
  // Custom blocks must be registered BEFORE starterKit so their Enter/Backspace
  // shortcuts take precedence over the default splitBlock/lift behaviors.
  CheckboxBlock,
  CheckboxTitle,
  CheckboxOption,
  MultipleChoiceBlock,
  MultipleChoiceTitle,
  MultipleChoiceOption,
  ShortAnswerBlock,
  NumberAnswerBlock,
  EmailAnswerBlock,
  PhoneAnswerBlock,
  LinkAnswerBlock,
  DateAnswerBlock,
  TimeAnswerBlock,
  LongAnswerBlock,
  LogicBlock,
  GpsAnswerBlock,
  ImageAnswerBlock,
  SignatureAnswerBlock,
  RequiredAttribute,
  QuizAttribute,
  DocumentAttributes,
  dragHandle,
  starterKit,
  placeholder,
  tiptapLink,
  UpdatedImage,
  taskList,
  taskItem,
  horizontalRule,
  Underline,
];
