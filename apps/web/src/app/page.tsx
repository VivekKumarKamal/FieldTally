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
  EditorBubble,
  EditorBubbleItem,
  SuggestionItem,
  handleCommandNavigation,
} from "novel";
import type { Editor as TiptapEditor } from "@tiptap/core";
import { Selection } from "@tiptap/pm/state";
import { Trash, Plus, GripVertical, Copy, EyeOff, GitBranch, Bold, Italic, Strikethrough, Underline as UnderlineIcon, Link as LinkIcon } from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import * as Switch from "@radix-ui/react-switch";
import { Tooltip } from "../components/Tooltip";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLogicStore } from "../hooks/useLogicStore";

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
  const router = useRouter();
  // When extension.ts is saved, Next.js Fast Refresh re-executes the module,
  // producing a new `defaultExtensions` array reference. We detect that and
  // increment editorKey to force TipTap to fully remount with the new config.
  const [editorKey, setEditorKey] = useState(0);
  // Holds the JSON output shown in the modal; null means modal is closed
  const [jsonOutput, setJsonOutput] = useState<string | null>(null);
  const [extensions, setExtensions] = useState(() => [
    ...defaultExtensions,
    slashCommand,
  ]);
  const prevExtensionsRef = useRef(defaultExtensions);
  const editorRef = useRef<TiptapEditor | null>(null);
  const lastSelectionRef = useRef(1);

  const [menuOpen, setMenuOpen] = useState(false);
  const [activeNodePos, setActiveNodePos] = useState<number | null>(null);
  const [isRequired, setIsRequired] = useState(false);
  const { setLogicTabOpen, setActiveBlockId } = useLogicStore();

  // --- Form Saving State ---
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [formId, setFormId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [editorInitialData, setEditorInitialData] = useState<any>(initialContent);
  const [formTitle, setFormTitle] = useState("");
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const titleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const loadForm = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);

      let currentId = localStorage.getItem("current_draft_form_id");
      if (!currentId) {
        currentId = crypto.randomUUID();
        localStorage.setItem("current_draft_form_id", currentId);
        setFormId(currentId);
        setIsLoaded(true);
        return;
      }
      setFormId(currentId);

      if (user) {
        // Fetch from supabase
        const { data, error } = await supabase.from('forms').select('draft_schema, title').eq('id', currentId).single();
        if (data?.draft_schema) {
          setEditorInitialData(data.draft_schema);
          setFormTitle(data.title || "");
        } else {
          // Check local storage for migration
          const localData = localStorage.getItem(`draft_schema_${currentId}`);
          if (localData) {
            const parsed = JSON.parse(localData);
            setEditorInitialData(parsed.schema);
            setFormTitle(parsed.title || "");
            await supabase.from('forms').upsert({
              id: currentId,
              draft_schema: parsed.schema,
              title: parsed.title || "",
              created_by: user.id
            });
            localStorage.removeItem(`draft_schema_${currentId}`);
          }
        }
      } else {
        // Fetch from local storage
        const localData = localStorage.getItem(`draft_schema_${currentId}`);
        if (localData) {
          const parsed = JSON.parse(localData);
          setEditorInitialData(parsed.schema);
          setFormTitle(parsed.title || "");
        }
      }
      setIsLoaded(true);
    };
    loadForm();
  }, []);

  const saveForm = async (json: any, titleOverride?: string) => {
    if (!formId) return;
    setSaveStatus("saving");
    const titleToSave = titleOverride !== undefined ? titleOverride : formTitle;

    try {
      if (userId) {
        const { error } = await supabase.from('forms').upsert({
          id: formId,
          draft_schema: json,
          title: titleToSave,
          created_by: userId,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });
        
        if (error) throw error;
      } else {
        localStorage.setItem(`draft_schema_${formId}`, JSON.stringify({
          schema: json,
          title: titleToSave,
          updated_at: new Date().toISOString()
        }));
      }
      setSaveStatus("saved");
    } catch (err: any) {
      console.error("Failed to save form. Details:", JSON.stringify(err, null, 2));
      setSaveStatus("error");
    }
  };

  // Auto-save whenever only the title changes (no editor update)
  const handleTitleChange = (newTitle: string) => {
    setFormTitle(newTitle);
    setSaveStatus("saving");
    if (titleTimeoutRef.current) clearTimeout(titleTimeoutRef.current);
    titleTimeoutRef.current = setTimeout(() => {
      const editor = editorRef.current;
      if (editor) saveForm(editor.getJSON(), newTitle);
    }, 1000);
  };

  const handleEditorUpdate = (editor: TiptapEditor) => {
    setSaveStatus("saving");
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      saveForm(editor.getJSON());
    }, 1500);
  };

  const handleMenuOpenChange = (open: boolean) => {
    setMenuOpen(open);
    if (open) {
      const pos = getHoveredNodePos();
      setActiveNodePos(pos);
      if (pos !== null && editorRef.current) {
        const node = editorRef.current.state.doc.nodeAt(pos);
        if (node) {
          setIsRequired(node.attrs.required !== false);
          setActiveBlockId(node.attrs.id || null);
        }
      }
    } else {
      // setActiveNodePos(null); // Keep it active in case they are interacting with the sidebar
    }
  };

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

  // Fix: GlobalDragHandle resolves child nodes (e.g. shortAnswerTitle, checkboxTitle)
  // instead of their parent wrapper blocks. This capture-phase listener fires BEFORE
  // GlobalDragHandle's handler, detects any custom nested block, corrects the
  // selection to the top-level wrapper, and rebuilds the drag data.
  useEffect(() => {
    const handle = document.querySelector(".custom-drag-handle");
    if (!handle) return;

    // Node type names that are multi-node wrapper blocks (draggable as a unit)
    const NESTED_BLOCK_TYPES = new Set(["checkboxBlock", "shortAnswerBlock"]);

    const fixNestedBlockDrag = (e: Event) => {
      const editor = editorRef.current;
      if (!editor || !e.isTrusted) return;

      const dragEvent = e as DragEvent;
      // Use the editor's content area X instead of offset from handle rect.
      // This reliably hits the block content regardless of handle width/position.
      const editorEl = document.querySelector('.ProseMirror');
      if (!editorEl) return;
      const editorRect = editorEl.getBoundingClientRect();
      const handleRect = handle.getBoundingClientRect();
      const pos = editor.view.posAtCoords({
        left: editorRect.left + 20,
        top: handleRect.top + 10,
      });
      if (!pos) return;

      const resolved = pos.inside >= 0 ? pos.inside : pos.pos;
      const $pos = editor.state.doc.resolve(resolved);

      // Walk up to find a nested wrapper block ancestor (depth 1 = top-level)
      let blockPos = -1;
      for (let d = $pos.depth; d >= 1; d--) {
        if (NESTED_BLOCK_TYPES.has($pos.node(d).type.name)) {
          blockPos = $pos.before(d);
          break;
        }
      }

      // Not inside a nested block — let GlobalDragHandle handle it normally
      if (blockPos === -1) return;

      // Stop GlobalDragHandle's handler from running (it would select the child)
      e.stopImmediatePropagation();

      if (!dragEvent.dataTransfer) return;

      // Select the entire wrapper block
      const { NodeSelection } = require("@tiptap/pm/state");
      const sel = NodeSelection.create(editor.state.doc, blockPos);
      editor.view.dispatch(editor.state.tr.setSelection(sel));

      // Build drag data from the corrected selection
      const slice = editor.state.selection.content();
      const dom = document.createElement("div");

      let text = "";
      try {
        const result = (editor.view as any).serializeForClipboard(slice);
        dom.innerHTML = result.dom.innerHTML;
        text = result.text;
      } catch {
        const node = editor.view.nodeDOM(blockPos);
        if (node instanceof HTMLElement) {
          dom.innerHTML = node.outerHTML;
          text = node.textContent || "";
        }
      }

      dragEvent.dataTransfer.clearData();
      dragEvent.dataTransfer.setData("text/html", dom.innerHTML);
      dragEvent.dataTransfer.setData("text/plain", text);
      dragEvent.dataTransfer.effectAllowed = "copyMove";

      const blockDOM = editor.view.nodeDOM(blockPos);
      if (blockDOM instanceof HTMLElement) {
        dragEvent.dataTransfer.setDragImage(blockDOM, 0, 0);
      }

      (editor.view as any).dragging = { slice, move: true };
    };

    // Capture phase = fires BEFORE GlobalDragHandle's bubbling-phase handler
    handle.addEventListener("dragstart", fixNestedBlockDrag, true);
    return () => handle.removeEventListener("dragstart", fixNestedBlockDrag, true);
  }, [editorKey]);

  // Helper: resolve the top-level block (depth 1) under the drag handle.
  // Always walks up to depth 1 so nested blocks (checkboxBlock, shortAnswerBlock)
  // are selected as a whole unit, not their child nodes.
  const getHoveredNodePos = () => {
    if (!editorRef.current) return null;
    const handle = document.querySelector(".custom-drag-handle");
    if (!handle) return null;
    // Use the editor content X so we reliably hit the block, regardless of
    // how far left/right the handle itself is positioned.
    const editorEl = document.querySelector('.ProseMirror');
    if (!editorEl) return null;
    const editorRect = editorEl.getBoundingClientRect();
    const handleRect = handle.getBoundingClientRect();
    const pos = editorRef.current.view.posAtCoords({
      left: editorRect.left + 20,
      top: handleRect.top + 10,
    });
    if (!pos || pos.inside < 0) return null;

    // Always resolve to depth 1 (direct child of doc = top-level block)
    const $pos = editorRef.current.state.doc.resolve(pos.inside);
    return $pos.depth >= 1 ? $pos.before(1) : pos.inside;
  };

  const deleteBlock = (targetPos?: number) => {
    const editor = editorRef.current;
    if (!editor) return;
    const pos = targetPos ?? getHoveredNodePos();
    if (pos !== null) {
      // Import NodeSelection dynamically or use tiptap core state
      const { NodeSelection } = require("@tiptap/pm/state");
      const nodeSelection = NodeSelection.create(editor.state.doc, pos);
      editor.view.dispatch(
        editor.state.tr.setSelection(nodeSelection).deleteSelection()
      );
    }
  };

  const addBlock = (targetPos?: number) => {
    const editor = editorRef.current;
    if (!editor) return;
    const pos = targetPos ?? getHoveredNodePos();
    if (pos !== null) {
      const node = editor.state.doc.nodeAt(pos);
      if (!node) return;
      const endPos = pos + node.nodeSize;
      editor.commands.insertContentAt(endPos, { type: "paragraph" });
      editor.commands.focus(endPos + 1);
    }
  };

  const duplicateBlock = (targetPos?: number) => {
    const editor = editorRef.current;
    if (!editor) return;
    const pos = targetPos ?? getHoveredNodePos();
    if (pos !== null) {
      const node = editor.state.doc.nodeAt(pos);
      if (node) {
        editor.commands.insertContentAt(pos + node.nodeSize, node.toJSON());
      }
    }
  };

  // Grabs editor JSON and opens the preview modal
  const handleSubmit = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const json = editor.getJSON();
    setJsonOutput(JSON.stringify(json, null, 2));
  };

  const handlePublish = async () => {
    if (!formId) return;
    if (!userId) {
      alert("You need to sign in to publish this form.");
      router.push("/login");
      return;
    }
    
    setSaveStatus("saving");
    const editor = editorRef.current;
    if (!editor) return;
    const json = editor.getJSON();

    const { error } = await supabase.from('forms').update({
      published_schema: json,
      title: formTitle,
      status: 'published',
      updated_at: new Date().toISOString()
    }).eq('id', formId);

    if (error) {
      console.error(error);
      setSaveStatus("error");
    } else {
      setSaveStatus("saved");
      alert("Form published successfully!");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUserId(null);
  };

  return (
    <div className={`min-h-screen w-screen relative ${menuOpen ? 'editor-menu-open' : ''}`}>
      {/* Top Navigation Bar */}
      <div className="fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-md border-b border-zinc-200 z-[100] px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="font-semibold text-zinc-800">FieldTally</h1>
          <div className="h-4 w-px bg-zinc-300"></div>
          <div className="text-sm font-medium">
            {saveStatus === 'saving' && <span className="text-zinc-500 animate-pulse">Saving draft...</span>}
            {saveStatus === 'saved' && <span className="text-green-600">Draft saved</span>}
            {saveStatus === 'error' && <span className="text-red-500">Failed to save draft</span>}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (editorRef.current) saveForm(editorRef.current.getJSON());
            }}
            className="px-3 py-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
          >
            Save Draft
          </button>
          <button
            onClick={handleSubmit}
            className="px-3 py-1.5 text-sm font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors"
          >
            Preview
          </button>
          <button
            onClick={handlePublish}
            className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
          >
            Publish
          </button>
          
          <div className="w-px h-4 bg-zinc-300 mx-2"></div>

          {userId ? (
            <button onClick={handleLogout} className="text-sm font-medium text-zinc-600 hover:text-red-600 transition-colors">
              Sign Out
            </button>
          ) : (
            <>
              <Link href="/login" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors">
                Log In
              </Link>
              <Link href="/signup" className="text-sm font-medium px-3 py-1.5 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors">
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="px-12 pt-36 pb-24 max-w-4xl mx-auto">
      {/* Custom drag handle injected into the DOM for GlobalDragHandle to use */}
      <div 
        className={`custom-drag-handle flex gap-0.5 fixed z-50 bg-white ml-4 text-zinc-400 ${menuOpen ? 'opacity-0 pointer-events-none' : ''}`}
        data-menu-open={menuOpen}
      >
        <Tooltip content={
            <div className="text-center leading-tight text-zinc-400 font-semibold">
              <span><span className="text-white font-bold">Insert </span>a block below</span>
            </div>
          }>
          <button
            className="p-1 hover:bg-zinc-100 hover:text-red-500 rounded transition-colors"
            onClick={() => deleteBlock()}
          >
            <Trash size={16} />
          </button>
        </Tooltip>
        
        <Tooltip content={
            <div className="text-center leading-tight text-zinc-400 font-semibold">
              <span><span className="text-white font-bold">Insert </span>a block below</span>
            </div>
          }>
          <button
            className="p-1 hover:bg-zinc-100 hover:text-blue-500 rounded transition-colors"
            onClick={() => addBlock()}
          >
            <Plus size={16} />
          </button>
        </Tooltip>

        <Popover.Root open={menuOpen} onOpenChange={handleMenuOpenChange}>
          <Tooltip content={
            <div className="text-center leading-tight text-zinc-400 font-semibold">
              <span><span className="text-white font-bold">Drag </span>to move</span><br />
              <span><span className="text-white font-bold">Click </span>to open menu</span>
            </div>
          }>
            <Popover.Trigger asChild>
              <button
                className="p-1 cursor-pointer hover:bg-zinc-100 rounded transition-colors drag-grip text-zinc-400 hover:text-zinc-600"
              >
                <GripVertical size={16} />
              </button>
            </Popover.Trigger>
          </Tooltip>
          
          <Popover.Content
            className="w-64 p-2 rounded-xl border border-zinc-200 bg-white shadow-xl text-sm z-[60] flex flex-col focus:outline-none"
            side="right"
            align="start"
            sideOffset={8}
          >
            <div className="flex items-center justify-between px-2 py-2">
              <span className="text-zinc-700">Required</span>
              <Switch.Root
                checked={isRequired}
                onCheckedChange={(checked) => {
                  setIsRequired(checked);
                  if (activeNodePos !== null && editorRef.current) {
                    const node = editorRef.current.state.doc.nodeAt(activeNodePos);
                    if (node) {
                      editorRef.current.view.dispatch(
                        editorRef.current.state.tr.setNodeMarkup(activeNodePos, null, {
                          ...node.attrs,
                          required: checked,
                        })
                      );
                    }
                  }
                }}
                className="w-10 h-6 bg-zinc-200 rounded-full relative data-[state=checked]:bg-blue-500 outline-none cursor-pointer shadow-inner transition-colors"
              >
                <Switch.Thumb className="block w-4 h-4 bg-white rounded-full transition-transform duration-100 translate-x-1 will-change-transform data-[state=checked]:translate-x-5 shadow-sm" />
              </Switch.Root>
            </div>
            
            <div className="h-px bg-zinc-100 my-1 mx-2" />
            
            <button 
              className="flex items-center justify-between px-2 py-1.5 hover:bg-zinc-100 rounded text-zinc-700 transition-colors w-full text-left"
              onClick={() => {
                deleteBlock(activeNodePos !== null ? activeNodePos : undefined);
                setMenuOpen(false);
              }}
            >
              <span className="flex items-center gap-2"><Trash size={16} /> Delete</span>
              <span className="text-xs text-zinc-400">Del</span>
            </button>
            
            <button 
              className="flex items-center justify-between px-2 py-1.5 hover:bg-zinc-100 rounded text-zinc-700 transition-colors w-full text-left"
              onClick={() => {
                duplicateBlock(activeNodePos !== null ? activeNodePos : undefined);
                setMenuOpen(false);
              }}
            >
              <span className="flex items-center gap-2"><Copy size={16} /> Duplicate</span>
              <span className="text-xs text-zinc-400">⌘ D</span>
            </button>
          </Popover.Content>
        </Popover.Root>
      </div>

      {/* Form Title */}
      <div className="mb-8">
        <input
          type="text"
          value={formTitle}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Form Title"
          className="form-title-input"
          maxLength={200}
        />
      </div>

      <EditorRoot>
        {!isLoaded ? (
          <div className="flex justify-center items-center py-20 text-sm text-zinc-500">Loading form...</div>
        ) : (
          <EditorContent
            key={editorKey}
            initialContent={editorInitialData}
            extensions={extensions}
            onCreate={({ editor }) => syncEditorSelection(editor)}
            onSelectionUpdate={({ editor }) => syncEditorSelection(editor)}
            editorProps={{ handleKeyDown: (_, event) => handleCommandNavigation(event) }}
            onUpdate={({ editor }) => handleEditorUpdate(editor)}
            immediatelyRender={false}
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
                  className="flex cursor-pointer my-1.5 gap-3 rounded-lg px-3 py-2 text-sm text-zinc-700 border border-zinc-200 hover:bg-zinc-100 aria-selected:bg-zinc-100 aria-selected:border-zinc-400"
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
          <EditorBubble
            tippyOptions={{ placement: "top" }}
            className="flex w-fit max-w-[90vw] overflow-hidden rounded-md border border-zinc-200 bg-white shadow-xl z-50"
          >
            <EditorBubbleItem
              className="flex h-9 w-9 items-center justify-center text-zinc-600 hover:bg-zinc-100 cursor-pointer data-[active=true]:text-blue-500 data-[active=true]:bg-blue-50"
              onSelect={(editor) => {
                editor.chain().focus().toggleBold().run();
              }}
            >
              <Bold size={16} />
            </EditorBubbleItem>
            <EditorBubbleItem
              className="flex h-9 w-9 items-center justify-center text-zinc-600 hover:bg-zinc-100 cursor-pointer data-[active=true]:text-blue-500 data-[active=true]:bg-blue-50"
              onSelect={(editor) => {
                editor.chain().focus().toggleItalic().run();
              }}
            >
              <Italic size={16} />
            </EditorBubbleItem>
            <EditorBubbleItem
              className="flex h-9 w-9 items-center justify-center text-zinc-600 hover:bg-zinc-100 cursor-pointer data-[active=true]:text-blue-500 data-[active=true]:bg-blue-50"
              onSelect={(editor) => {
                editor.chain().focus().toggleStrike().run();
              }}
            >
              <Strikethrough size={16} />
            </EditorBubbleItem>
            <EditorBubbleItem
              className="flex h-9 w-9 items-center justify-center text-zinc-600 hover:bg-zinc-100 cursor-pointer data-[active=true]:text-blue-500 data-[active=true]:bg-blue-50"
              onSelect={(editor) => {
                editor.chain().focus().toggleUnderline().run();
              }}
            >
              <UnderlineIcon size={16} />
            </EditorBubbleItem>
            <EditorBubbleItem
              className="flex h-9 w-9 items-center justify-center text-zinc-600 hover:bg-zinc-100 cursor-pointer data-[active=true]:text-blue-500 data-[active=true]:bg-blue-50"
              onSelect={(editor) => {
                if (editor.isActive("link")) {
                  editor.chain().focus().unsetLink().run();
                } else {
                  const url = window.prompt("Enter link URL:");
                  if (url) {
                    editor.chain().focus().setLink({ href: url }).run();
                  }
                }
              }}
            >
              <LinkIcon size={16} />
            </EditorBubbleItem>
          </EditorBubble>
        </EditorContent>
        )}
      </EditorRoot>
      </div>

      {/* JSON output modal */}
      {jsonOutput !== null && (
        <div className="json-modal-overlay" onClick={() => setJsonOutput(null)}>
          <div className="json-modal" onClick={(e) => e.stopPropagation()}>
            <div className="json-modal-header">
              <span>Form JSON Output</span>
              <button onClick={() => setJsonOutput(null)} className="json-modal-close">✕</button>
            </div>
            <pre className="json-modal-body">{jsonOutput}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
