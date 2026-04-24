"use client";

import { useState, useEffect, useRef } from "react";
import {
  EditorRoot,
  EditorContent,
  EditorCommand,
  EditorCommandEmpty,
  EditorCommandList,
  EditorCommandItem,
  SuggestionItem,
} from "novel";

import { defaultExtensions } from "./extension";
import { slashCommand, suggestionItems } from "./slashCommand";

//-------Initial Content---------
const initialContent = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "" }],
    },
  ],
};

// --------Main Component---------
export default function Home() {
  // When extension.ts is saved, Next.js Fast Refresh re-executes the module,
  // producing a new `defaultExtensions` array reference. We detect that and
  // increment editorKey to force TipTap to fully remount with the new config.
  const [editorKey, setEditorKey] = useState(0);
  const prevExtensionsRef = useRef(defaultExtensions);

  useEffect(() => {
    if (prevExtensionsRef.current !== defaultExtensions) {
      prevExtensionsRef.current = defaultExtensions;
      setEditorKey((k) => k + 1);
    }
  }); // intentionally no deps — runs after every render to catch HMR updates

  const extensions = [...defaultExtensions, slashCommand];

  return (
    <div className="px-12 py-36 w-screen">
      
      <EditorRoot>
        <EditorContent
          key={editorKey}
          initialContent={initialContent}
          extensions={extensions}
          
          // onUpdate={({ editor }) => {
          //   const json = editor.getJSON();
          //   console.log(json)
          // }}

          immediatelyRender={false} // If client-side rendering, set this to true. If server-side rendering, set this to false.
        >
          <EditorCommand className="z-50 h-auto min-w-[300px] max-h-[340px] overflow-y-auto px-1 gap-2 border-1 border-zinc-200 rounded-lg bg-white shadow-lg">
            <EditorCommandEmpty className="px-3 py-1 text-sm text-zinc-500">
              No results found
            </EditorCommandEmpty>
            <EditorCommandList>
              {suggestionItems.map((item: SuggestionItem) => (
                <EditorCommandItem
                  key={item.title}
                  value={item.title}
                  onCommand={item.command!}
                  className="flex cursor-pointer my-1.5 gap-3 rounded-lg px-3 py-2 text-sm text-zinc-700 border-1 border-zinc-200 hover:bg-zinc-100 aria-selected:bg-white-100"
                >
                  <div className="flex h-6 w-8 items-center justify-center rounded-md border border-gray-300">
                    {item.icon}
                  </div>
                  <div>
                    <p className="font-medium leading-none">{item.title}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">{item.description}</p>
                  </div>
                </EditorCommandItem>
              ))}
            </EditorCommandList>
          </EditorCommand>
        </EditorContent>
      </EditorRoot>
    </div>
  );
}