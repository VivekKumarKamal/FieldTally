import {
  TiptapImage,
  TiptapLink,
  UpdatedImage,
  TaskList,
  TaskItem,
  HorizontalRule,
  StarterKit,
  Placeholder,
} from "novel";

import { cx } from "class-variance-authority";
import { QuestionBlock, QuestionTitle, OptionItem } from "./extensions/questionBlock";

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
    if (node.type.name === "questionTitle") return "Type your question...";
    if (node.type.name === "optionItem") return ""; // CSS handles this

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

export const defaultExtensions = [
  starterKit,
  placeholder,
  tiptapLink,
  TiptapImage,
  UpdatedImage,
  taskList,
  taskItem,
  horizontalRule,
  QuestionBlock,
  QuestionTitle,
  OptionItem,
];