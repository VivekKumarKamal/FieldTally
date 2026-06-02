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
  CircleDot,
  Type,
  Hash,
  Mail,
  Phone,
  Link,
  Calendar,
  Clock,
  AlignLeft,
  GitBranch,
  MapPin,
  Image,
  PenTool,
} from "lucide-react";

import { createSuggestionItems } from "novel";
import { Command, renderItems } from "novel";

// ------- Slash Commands -------

// Content structure for the Checkboxes block inserted via slash command
const checkboxesContent = {
  type: "checkboxBlock",
  content: [{ type: "checkboxTitle" }, { type: "checkboxOption" }],
};

// Content structure for the Multiple Choice block inserted via slash command
const multipleChoiceContent = {
  type: "multipleChoiceBlock",
  content: [{ type: "multipleChoiceTitle" }, { type: "multipleChoiceOption" }],
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
    title: "Checkboxes",
    description: "Add a question with multiple select options.",
    searchTerms: ["question", "options", "checkbox", "poll", "quiz", "mcq"],
    icon: <CheckSquare size={18} />,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent(checkboxesContent)
        .setTextSelection(range.from + 1)
        .run();
    },
  },
  {
    title: "Multiple Choice",
    description: "A single-select question with radio buttons.",
    searchTerms: ["radio", "multiple choice", "options", "question", "single select"],
    icon: <CircleDot size={18} />,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent(multipleChoiceContent)
        .setTextSelection(range.from + 1)
        .run();
    },
  },
  {
    title: "Short Answer",
    description: "A question with a short text response field.",
    searchTerms: ["short", "answer", "text", "input", "question"],
    icon: <Type size={18} />,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode("shortAnswerBlock")
        .run();
    },
  },
  {
    title: "Long Answer",
    description: "A question with a multi-line resizable text area.",
    searchTerms: ["long", "answer", "paragraph", "textarea", "description", "question"],
    icon: <AlignLeft size={18} />,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode("longAnswerBlock")
        .run();
    },
  },
  {
    title: "Number",
    description: "A question with a numeric response field.",
    searchTerms: ["number", "numeric", "digit", "amount", "question"],
    icon: <Hash size={18} />,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode("numberAnswerBlock")
        .run();
    },
  },
  {
    title: "Email",
    description: "A question with an email format response field.",
    searchTerms: ["email", "mail", "address", "contact", "question"],
    icon: <Mail size={18} />,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode("emailAnswerBlock")
        .run();
    },
  },
  {
    title: "Phone",
    description: "A question with a phone number format response field.",
    searchTerms: ["phone", "number", "mobile", "cell", "contact", "question"],
    icon: <Phone size={18} />,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode("phoneAnswerBlock")
        .run();
    },
  },
  {
    title: "Link",
    description: "A question with a URL response field.",
    searchTerms: ["link", "url", "website", "web", "address", "question"],
    icon: <Link size={18} />,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode("linkAnswerBlock")
        .run();
    },
  },
  {
    title: "Date",
    description: "A question with a date response field.",
    searchTerms: ["date", "calendar", "day", "month", "year", "question"],
    icon: <Calendar size={18} />,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode("dateAnswerBlock")
        .run();
    },
  },
  {
    title: "Time",
    description: "A question with a time response field.",
    searchTerms: ["time", "clock", "hour", "minute", "question"],
    icon: <Clock size={18} />,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode("timeAnswerBlock")
        .run();
    },
  },
  {
    title: "GPS Location",
    description: "Capture the responder's current GPS location.",
    searchTerms: ["gps", "location", "coordinates", "map"],
    icon: <MapPin size={18} />,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode("gpsAnswerBlock")
        .run();
    },
  },
  {
    title: "Image Upload",
    description: "Allow users to upload an image from their device.",
    searchTerms: ["image", "photo", "upload", "file", "camera", "picture"],
    icon: <Image size={18} />,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode("imageAnswerBlock")
        .run();
    },
  },
  {
    title: "Signature",
    description: "Add a drawing canvas to capture a signature.",
    searchTerms: ["signature", "sign", "draw", "pen", "canvas"],
    icon: <PenTool size={18} />,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode("signatureAnswerBlock")
        .run();
    },
  },
  {
    title: "Conditional Logic",
    description: "Add a logic rule to show, hide, or skip blocks.",
    searchTerms: ["logic", "condition", "if", "then", "rule", "branch"],
    icon: <GitBranch size={18} />,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({ type: "logicBlock" })
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
