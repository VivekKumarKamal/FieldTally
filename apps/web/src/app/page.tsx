"use client";

import { useState, useEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  EditorRoot,
  EditorContent,
  EditorCommand,
  EditorCommandEmpty,
  EditorCommandList,
  EditorCommandItem,
  SuggestionItem,
} from "novel";
import type { Editor as TiptapEditor } from "@tiptap/core";
import { Selection } from "@tiptap/pm/state";

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
  const [extensions, setExtensions] = useState(() => [
    ...defaultExtensions,
    slashCommand,
  ]);
  const prevExtensionsRef = useRef(defaultExtensions);
  const editorRef = useRef<TiptapEditor | null>(null);
  const lastSelectionRef = useRef(1);

  useEffect(() => {
    if (prevExtensionsRef.current !== defaultExtensions) {
      prevExtensionsRef.current = defaultExtensions;
      // Keep the extension list stable between renders so typing and selection
      // changes do not hand the editor a fresh array every time.
      setExtensions([...defaultExtensions, slashCommand]);
      setEditorKey((k) => k + 1);
    }
  }); // intentionally no deps — runs after every render to catch HMR updates

  const syncEditorSelection = (editor: TiptapEditor) => {
    editorRef.current = editor;
    lastSelectionRef.current = editor.state.selection.from;
  };

  const focusNearestBlock = (clientX: number, clientY: number) => {
    const editor = editorRef.current;
    if (!editor) return;

    const editorDom = editor.view.dom as HTMLElement;
    const rect = editorDom.getBoundingClientRect();
    const fallbackPos = Math.max(
      1,
      Math.min(lastSelectionRef.current, editor.state.doc.content.size),
    );

    if (rect.width === 0 || rect.height === 0) {
      editor.commands.focus(fallbackPos);
      return;
    }

    // Clamp the probe point so clicks in the empty page gutter still resolve to
    // a real document position near the editor rather than outside its bounds.
    const probeX = Math.min(Math.max(clientX, rect.left + 8), rect.right - 8);
    const probeY = Math.min(Math.max(clientY, rect.top + 4), rect.bottom - 4);
    const resolvedPos =
      editor.view.posAtCoords({ left: probeX, top: probeY })?.pos ?? fallbackPos;
    const selection = Selection.near(editor.state.doc.resolve(resolvedPos), -1);

    editor.view.dispatch(editor.state.tr.setSelection(selection).scrollIntoView());
    editor.view.focus();
    lastSelectionRef.current = selection.from;
  };

  const handleEmptyPagePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const editor = editorRef.current;
    if (!editor) return;

    const rawTarget = event.target;
    const target =
      rawTarget instanceof HTMLElement
        ? rawTarget
        : rawTarget instanceof Node
          ? rawTarget.parentElement
          : null;

    if (!target) return;
    if (target.closest("#slash-command")) return;
    if (target.closest("button, a, input, textarea, select, [role='button']")) return;

    const editorDom = editor.view.dom as HTMLElement;
    const clickedInsideEditor = editorDom.contains(target);

    if (clickedInsideEditor && target !== editorDom) return;

    event.preventDefault();
    focusNearestBlock(event.clientX, event.clientY);
  };

  return (
    <div
      className="px-12 py-36 w-screen"
      onPointerDownCapture={handleEmptyPagePointerDown}
    >
      <EditorRoot>
        <EditorContent
          key={editorKey}
          initialContent={initialContent}
          extensions={extensions}
          onCreate={({ editor }) => syncEditorSelection(editor)}
          onSelectionUpdate={({ editor }) => syncEditorSelection(editor)}

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
