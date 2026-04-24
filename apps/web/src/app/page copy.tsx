"use client";


import {
  EditorContent,
  EditorRoot,
  EditorCommand,
  EditorCommandItem,
  EditorCommandList,
  EditorCommandEmpty,
  StarterKit,
  Placeholder,
  Command,
  createSuggestionItems,
  renderItems,
  handleCommandNavigation,
  type SuggestionItem,
} from "novel";

// --- Slash Command Items ---
const suggestionItems = createSuggestionItems([
  {
    title: "Text",
    description: "Start typing plain text.",
    searchTerms: ["paragraph", "text"],
    icon: <span className="text-base">¶</span>,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleNode("paragraph", "paragraph").run();
    },
  },
  {
    title: "Heading 1",
    description: "Big section heading.",
    searchTerms: ["h1", "title"],
    icon: <span className="font-bold text-base">H1</span>,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
    },
  },
  {
    title: "Heading 2",
    description: "Medium section heading.",
    searchTerms: ["h2", "subtitle"],
    icon: <span className="font-bold text-sm">H2</span>,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
    },
  },
  {
    title: "Heading 3",
    description: "Small section heading.",
    searchTerms: ["h3"],
    icon: <span className="font-bold text-xs">H3</span>,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run();
    },
  },
  {
    title: "Bullet List",
    description: "Create a simple bullet list.",
    searchTerms: ["ul", "list", "bullet", "unordered"],
    icon: <span className="text-base">•</span>,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: "Numbered List",
    description: "Create a numbered list.",
    searchTerms: ["ol", "ordered", "number"],
    icon: <span className="text-base">1.</span>,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: "Quote",
    description: "Create a blockquote.",
    searchTerms: ["blockquote", "quote"],
    icon: <span className="text-base">"</span>,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setBlockquote().run();
    },
  },
  {
    title: "Code",
    description: "Capture a code snippet.",
    searchTerms: ["codeblock", "pre"],
    icon: <span className="font-mono text-sm">{"{}"}</span>,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setCodeBlock().run();
    },
  },
]);

const extensions = [
  StarterKit,
  Placeholder.configure({
    placeholder: ({ node }) => {
      if (node.type.name === "heading") return "Heading...";
      return "Type '/' for commands, or start writing...";
    },
  }),
  Command.configure({
    suggestion: {
      items: () => suggestionItems,
      render: renderItems,
    },
  }),
];

const initialContent = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "Welcome to FieldTally! Type / to open the command menu." }],
    },
  ],
};

export default function Home() {

  return (
    <div className="flex flex-col items-center min-h-screen bg-zinc-50 p-12 dark:bg-zinc-950">
      <div className="w-full max-w-3xl border border-zinc-200 bg-white rounded-xl shadow-md dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
        {/* Header */}
        <div className="border-b border-zinc-200 dark:border-zinc-800 px-8 py-4 flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-red-400" />
          <div className="h-3 w-3 rounded-full bg-yellow-400" />
          <div className="h-3 w-3 rounded-full bg-green-400" />
          <span className="ml-4 text-sm text-zinc-400 dark:text-zinc-500">FieldTally Editor</span>
        </div>

        {/* Editor */}
        <div className="px-8 py-6">
          <EditorRoot>
            <EditorContent
              initialContent={initialContent}
              extensions={extensions}
              immediatelyRender={true}
              className="prose prose-zinc dark:prose-invert max-w-none focus:outline-none min-h-[400px]"
              onKeyDown={handleCommandNavigation}
            >
              {/* Slash Command Menu */}
              <EditorCommand className="z-50 h-auto max-h-[330px] overflow-y-auto rounded-xl border border-zinc-200 bg-white px-1 py-2 shadow-lg transition-all dark:border-zinc-700 dark:bg-zinc-800">
                <EditorCommandEmpty className="px-3 py-2 text-sm text-zinc-400">
                  No results found
                </EditorCommandEmpty>
                <EditorCommandList>
                  {suggestionItems.map((item: SuggestionItem) => (
                    <EditorCommandItem
                      key={item.title}
                      value={item.title}
                      onCommand={item.command!}
                      className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 aria-selected:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-700 dark:aria-selected:bg-zinc-700"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
                        {item.icon}
                      </div>
                      <div>
                        <p className="font-medium leading-none">{item.title}</p>
                        <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">{item.description}</p>
                      </div>
                    </EditorCommandItem>
                  ))}
                </EditorCommandList>
              </EditorCommand>
            </EditorContent>
          </EditorRoot>
        </div>
      </div>
    </div>
  );
}