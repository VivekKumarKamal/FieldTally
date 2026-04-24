import {
  Code,
  List,
  ListOrdered,
  TextQuote,
  Heading1,
  Heading2,
  Heading3,
  Minus,
  CheckSquare,
} from "lucide-react";

import { createSuggestionItems } from "novel";
import { Command, renderItems } from "novel";

// ------- Slash Commands -------

const mcqContent = {
  type: "questionBlock",
  content: [{ type: "questionTitle" }, { type: "optionItem" }],
};

export const suggestionItems = createSuggestionItems([
  {
    title: "Text",
    description: "Start typing plain text",
    searchTerms: ["paragraph", "text"],
    icon: <span className="text-base">T</span>,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleNode("paragraph", "paragraph").run();
    },
  },
  {
    title: "Heading 1",
    description: "Big section heading.",
    searchTerms: ["title", "big", "large"],
    icon: <Heading1 size={18} />,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode("heading", { level: 1 })
        .run();
    },
  },
  {
    title: "Heading 2",
    description: "Medium section heading.",
    searchTerms: ["subtitle", "medium"],
    icon: <Heading2 size={18} />,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode("heading", { level: 2 })
        .run();
    },
  },
  {
    title: "Heading 3",
    description: "Small section heading.",
    searchTerms: ["subtitle", "small"],
    icon: <Heading3 size={18} />,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode("heading", { level: 3 })
        .run();
    },
  },
  {
    title: "Bullet List",
    description: "Create a simple bullet list.",
    searchTerms: ["unordered", "point"],
    icon: <List size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: "Numbered List",
    description: "Create a list with numbering.",
    searchTerms: ["ordered"],
    icon: <ListOrdered size={18} />,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .toggleOrderedList()
        .run();
    },
  },
  {
    title: "Checkbox",
    description: "Track tasks with checkboxes.",
    searchTerms: ["task", "todo", "checkbox", "check"],
    icon: <CheckSquare size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    title: "Quote",
    description: "Capture a quote.",
    searchTerms: ["blockquote"],
    icon: <TextQuote size={18} />,
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .toggleNode("paragraph", "paragraph")
        .toggleBlockquote()
        .run(),
  },
  {
    title: "Code",
    description: "Capture a code snippet.",
    searchTerms: ["codeblock"],
    icon: <Code size={18} />,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    title: "Divider",
    description: "A simple horizontal line.",
    searchTerms: ["horizontalRule"],
    icon: <Minus size={18} />,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
  {
    title: "MCQ",
    description: "Add a question with options.",
    searchTerms: ["question", "options", "mcq", "poll", "quiz"],
    icon: <CheckSquare size={18} />,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .insertContentAt(range, mcqContent)
        // The inserted structure is `questionBlock -> questionTitle`, so
        // `range.from + 2` lands the caret inside the title immediately.
        .setTextSelection(range.from + 2)
        .run();
    },
  },
]);

export const slashCommand = Command.configure({
  suggestion: {
    items: () => suggestionItems,
    render: renderItems,
  },
});
