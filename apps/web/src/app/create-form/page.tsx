"use client";

import { useState, useEffect, useRef, Suspense } from "react";
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
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import {
  Trash, Plus, GripVertical, Copy, Bold, Italic, Strikethrough,
  Underline as UnderlineIcon, Link as LinkIcon,
  RefreshCw, ChevronRight,
  Type, Hash, Mail, Phone, Link2, Calendar, Clock, AlignLeft,
  CheckSquare, CircleDot,
  Heading1, Heading2, Heading3, List, ListOrdered, Cloud, Check, History, CloudUpload, CloudOff, CloudCheck, ChevronLeft
} from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import * as Switch from "@radix-ui/react-switch";
import { Tooltip } from "../../components/Tooltip";
import { supabase } from "../../lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useLogicStore } from "../../hooks/useLogicStore";
import { turnBlockInto, TURN_INTO_TARGETS, isConvertibleBlock, resolveTargetKey } from "../../lib/turnInto";
import { loadForm as loadFormAction, saveDraft, publishForm, type SaveStatus } from "../../lib/formActions";

import { defaultExtensions } from "./extension";
import { slashCommand, suggestionItems } from "./slashCommand";

// Icon map for the "Turn Into" submenu
const TURN_INTO_ICONS: Record<string, React.ReactNode> = {
  paragraph:           <span className="text-sm font-semibold">T</span>,
  "heading-1":         <Heading1 size={16} />,
  "heading-2":         <Heading2 size={16} />,
  "heading-3":         <Heading3 size={16} />,
  bulletList:          <List size={16} />,
  orderedList:         <ListOrdered size={16} />,
  shortAnswerBlock:    <Type size={16} />,
  longAnswerBlock:     <AlignLeft size={16} />,
  numberAnswerBlock:   <Hash size={16} />,
  emailAnswerBlock:    <Mail size={16} />,
  phoneAnswerBlock:    <Phone size={16} />,
  linkAnswerBlock:     <Link2 size={16} />,
  dateAnswerBlock:     <Calendar size={16} />,
  timeAnswerBlock:     <Clock size={16} />,
  checkboxBlock:       <CheckSquare size={16} />,
  multipleChoiceBlock: <CircleDot size={16} />,
};

//-------Initial Content---------
const initialContent = {
  type: "doc",
  content: [
    {
      type: "paragraph",
    },
  ],
};

const BLOCK_TYPES_WITH_IDS = new Set([
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
]);

type ClipboardCapableView = TiptapEditor["view"] & {
  serializeForClipboard?: (slice: ReturnType<NodeSelection["content"]>) => {
    dom: HTMLElement;
    text: string;
  };
  dragging?: { slice: ReturnType<NodeSelection["content"]>; move: boolean };
};


const cloneBlockWithFreshIds = (json: any): any => {
  if (!json || typeof json !== "object") return json;

  const cloned = {
    ...json,
    attrs: json.attrs ? { ...json.attrs } : json.attrs,
    content: Array.isArray(json.content)
      ? json.content.map((child: any) => cloneBlockWithFreshIds(child))
      : json.content,
  };

  if (BLOCK_TYPES_WITH_IDS.has(cloned.type)) {
    cloned.attrs = { ...(cloned.attrs || {}), id: crypto.randomUUID() };
  }

  if (cloned.type === "logicBlock" && cloned.attrs?.rule) {
    cloned.attrs.rule = {
      ...cloned.attrs.rule,
      id: crypto.randomUUID(),
      conditions: (cloned.attrs.rule.conditions || []).map((condition: any) => ({
        ...condition,
        id: crypto.randomUUID(),
      })),
    };
  }

  return cloned;
};

// Helper to deterministically pick an animal avatar based on email
function getAnimalAvatar(email: string | undefined) {
  if (!email) return "/avatars/panda.png";
  const animals = ["cat", "fox", "panda"];
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % animals.length;
  return `/avatars/${animals[index]}.png`;
}

// --------Main Component---------
function FormEditorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const formIdParam = searchParams?.get("form") || null;

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
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const [activeNodePos, setActiveNodePos] = useState<number | null>(null);
  const [isRequired, setIsRequired] = useState(false);
  const [turnIntoOpen, setTurnIntoOpen] = useState(false);
  const [menuVerticalAlign, setMenuVerticalAlign] = useState<"top" | "bottom">("top");
  const [activeNodeType, setActiveNodeType] = useState<string | null>(null);
  const { setActiveBlockId } = useLogicStore();

  // --- Form Saving State ---
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [formId, setFormId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [editorInitialData, setEditorInitialData] = useState<any>(initialContent);
  const [formTitle, setFormTitle] = useState("");
  const [publishUrl, setPublishUrl] = useState<string | null>(null);
  const [formVersion, setFormVersion] = useState<number | null>(null);
  const [latestPublishedSchema, setLatestPublishedSchema] = useState<any>(null);
  const [latestPublishedTitle, setLatestPublishedTitle] = useState<string | null>(null);
  const [versionHistory, setVersionHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [userProfile, setUserProfile] = useState<{ email?: string, avatar_url?: string } | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadFormAction(initialContent, formIdParam).then((result) => {
      setUserId(result.userId);
      setFormId(result.formId);
      setEditorInitialData(result.schema);
      setFormTitle(result.title);
      setFormVersion(result.version || null);
      setLatestPublishedSchema(result.latestPublishedSchema || null);
      setLatestPublishedTitle(result.latestPublishedTitle || null);
      if (result.shouldRemount) setEditorKey(k => k + 1);
      setIsLoaded(true);
    });

    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setUserProfile({
          email: data.user.email,
          avatar_url: data.user.user_metadata?.avatar_url
        });
      }
    });
  }, [formIdParam]);

  // Keep browser tab title in sync with the form title
  useEffect(() => {
    document.title = formTitle ? `${formTitle} · FieldTally` : "FieldTally";
  }, [formTitle]);

  const saveForm = async (json: any, titleOverride?: string) => {
    if (!formId) return;
    setSaveStatus("saving");
    const titleToSave = titleOverride !== undefined ? titleOverride : formTitle;
    const result = await saveDraft(formId, userId, json, titleToSave);
    setSaveStatus(result.ok ? "saved" : "error");
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
          setActiveNodeType(resolveTargetKey(node.type.name, node.attrs));
        }
      }
    } else {
      setTurnIntoOpen(false);
    }
  };

  const handleTurnInto = (targetKey: string) => {
    const editor = editorRef.current;
    if (!editor || activeNodePos === null) return;
    turnBlockInto(editor, activeNodePos, targetKey);
    setMenuOpen(false);
    setTurnIntoOpen(false);
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

  const getHandleTargetPos = () => {
    if (!editorRef.current) return null;
    const handle = document.querySelector(".custom-drag-handle");
    if (!handle) return null;

    const editorEl = document.querySelector('.ProseMirror');
    if (!editorEl) return null;
    const editorRect = editorEl.getBoundingClientRect();
    const handleRect = handle.getBoundingClientRect();
    const pos = editorRef.current.view.posAtCoords({
      left: editorRect.left + 20,
      top: handleRect.top + 10,
    });
    if (!pos) return null;

    const doc = editorRef.current.state.doc;
    const resolvedPos = Math.max(0, Math.min(pos.inside >= 0 ? pos.inside : pos.pos, doc.content.size));
    const $pos = doc.resolve(resolvedPos);
    const blockPos = $pos.depth >= 1 ? $pos.before(1) : resolvedPos;
    return doc.nodeAt(blockPos) ? blockPos : null;
  };

  const selectBlockAt = (pos: number) => {
    const editor = editorRef.current;
    if (!editor) return null;
    const selection = NodeSelection.create(editor.state.doc, pos);
    const tr = editor.state.tr.setSelection(selection);
    editor.view.dispatch(tr);
    return selection;
  };

  useEffect(() => {
    const handle = document.querySelector(".custom-drag-handle");
    if (!handle) return;

    const dragWholeBlock = (e: Event) => {
      const editor = editorRef.current;
      const dragEvent = e as DragEvent;
      if (!editor || !dragEvent.dataTransfer) return;

      const blockPos = getHandleTargetPos();
      if (blockPos === null) return;

      e.stopImmediatePropagation();
      const selection = selectBlockAt(blockPos);
      if (!selection) return;

      const slice = selection.content();
      const dom = document.createElement("div");
      let text = "";

      try {
        const result = (editor.view as ClipboardCapableView).serializeForClipboard?.(slice);
        if (!result) throw new Error("Clipboard serialization is unavailable");
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

      (editor.view as ClipboardCapableView).dragging = { slice, move: true };
    };

    handle.addEventListener("dragstart", dragWholeBlock, true);
    return () => handle.removeEventListener("dragstart", dragWholeBlock, true);
  }, [editorKey]);

  const getHoveredNodePos = () => {
    return getHandleTargetPos();
  };

  const deleteBlock = (targetPos?: number) => {
    const editor = editorRef.current;
    if (!editor) return;
    const pos = targetPos ?? getHoveredNodePos();
    if (pos !== null) {
      selectBlockAt(pos);
      editor.commands.deleteSelection();
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
        editor.commands.insertContentAt(pos + node.nodeSize, cloneBlockWithFreshIds(node.toJSON()));
      }
    }
  };

  // Navigate to the live form preview
  const handleSubmit = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const json = editor.getJSON();
    localStorage.setItem("preview_form_schema", JSON.stringify(json));
    localStorage.setItem("preview_form_title", formTitle);
    router.push("/preview");
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

    const hasChanges = JSON.stringify(json) !== JSON.stringify(latestPublishedSchema) || formTitle !== latestPublishedTitle;
    if (!hasChanges) {
      setSaveStatus("saved");
      alert("No changes detected since last publish.");
      return;
    }

    const result = await publishForm(formId, userId, json, formTitle);
    
    if (result.ok) {
      setSaveStatus("saved");
      setPublishUrl(result.url || null);
      setFormVersion(prev => (prev || 0) + 1);
      setLatestPublishedSchema(json);
      setLatestPublishedTitle(formTitle);
    } else {
      setSaveStatus("error");
      alert(`Publish failed: ${result.error}`);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUserId(null);
    router.push("/login");
  };

  const focusTextBlockAt = (pos: number) => {
    const editor = editorRef.current;
    if (!editor) return;
    const focusPos = Math.max(1, Math.min(pos + 1, editor.state.doc.content.size));
    const tr = editor.state.tr.setSelection(TextSelection.near(editor.state.doc.resolve(focusPos), 1));
    editor.view.dispatch(tr);
    editor.view.focus();
  };

  const getLastTopLevelBlock = () => {
    const doc = editorRef.current?.state.doc;
    const node = doc?.lastChild;
    if (!doc || !node) return null;

    return {
      pos: doc.content.size - node.nodeSize,
      isEmptyTextBlock: node.isTextblock && node.textContent.trim() === "",
    };
  };

  const handleEmptyAreaClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("input") || target.closest("a") || target.closest("[role='menu']") || target.closest("[data-radix-popper-content-wrapper]") || target.closest("textarea") || target.closest("select")) {
      return;
    }

    const editor = editorRef.current;
    if (!editor) return;

    const editorEl = editor.view.dom;
    if (editorEl.contains(target) && target !== editorEl) {
      return;
    }

    const blockEls = Array.from(editorEl.children).filter((child): child is HTMLElement => child instanceof HTMLElement);

    const lastBlock = blockEls[blockEls.length - 1];
    if (lastBlock) {
      const lastRect = lastBlock.getBoundingClientRect();
      if (e.clientY > lastRect.bottom + 4) {
        const lastDocBlock = getLastTopLevelBlock();
        if (lastDocBlock?.isEmptyTextBlock) {
          focusTextBlockAt(lastDocBlock.pos);
          return;
        }

        const endPos = editor.state.doc.content.size;
        editor.commands.insertContentAt(endPos, { type: "paragraph" });
        const newEndPos = editor.state.doc.content.size - 1;
        editor.commands.focus(newEndPos);
        return;
      }
    }

    const nearestBlock = blockEls.reduce<HTMLElement | null>((nearest, child) => {
      const rect = child.getBoundingClientRect();
      const distance = Math.min(Math.abs(e.clientY - rect.top), Math.abs(e.clientY - rect.bottom), Math.abs(e.clientY - (rect.top + rect.height / 2)));
      if (!nearest) return child;
      const nearestRect = nearest.getBoundingClientRect();
      const nearestDistance = Math.min(
        Math.abs(e.clientY - nearestRect.top),
        Math.abs(e.clientY - nearestRect.bottom),
        Math.abs(e.clientY - (nearestRect.top + nearestRect.height / 2))
      );
      return distance < nearestDistance ? child : nearest;
    }, null);

    if (nearestBlock) {
      const pos = editor.view.posAtDOM(nearestBlock, 0);
      focusTextBlockAt(pos);
      return;
    }

    // No blocks at all — create the first paragraph
    const endPos = editor.state.doc.content.size;
    editor.commands.insertContentAt(endPos, { type: "paragraph" });
    editor.commands.focus(endPos + 1);
  };

  const loadVersionHistory = async () => {
    if (!formId) return;
    const { data } = await supabase.from('form_versions').select('version, created_at, content, title').eq('form_id', formId).order('version', { ascending: false });
    if (data) setVersionHistory(data);
  };

  const handleLoadVersion = (versionData: any) => {
    setEditorInitialData(versionData.content);
    setFormTitle(versionData.title);
    setFormVersion(versionData.version);
    setEditorKey(k => k + 1);
  };

  return (
    <div className={`min-h-screen w-screen relative ${menuOpen ? 'editor-menu-open' : ''}`} onClick={handleEmptyAreaClick} onMouseMove={() => { if (isKeyboardActive) setIsKeyboardActive(false); }}>
      {/* Top Navigation Bar */}
      <div className="fixed top-0 left-0 right-0 h-14 bg-white/70 backdrop-blur-xl border-b border-zinc-200/60 z-[100] px-6 flex items-center justify-between transition-all duration-200">
        <div className="flex items-center gap-6">
          <Link href={userId ? "/dashboard" : "/"} className="flex items-center gap-2 group/logo">
            <div className="w-6 h-6 bg-gradient-to-br from-zinc-800 to-zinc-600 rounded flex items-center justify-center shadow-sm transition-all duration-200 group-hover/logo:from-zinc-700 group-hover/logo:to-zinc-500">
              <span className="text-white text-xs font-bold tracking-tighter block group-hover/logo:hidden">FT</span>
              <ChevronLeft className="w-4 h-4 text-white hidden group-hover/logo:block" />
            </div>
            <span className="font-semibold text-zinc-800 tracking-tight transition-colors duration-200 block group-hover/logo:hidden">FieldTally</span>
            <span className="font-semibold text-zinc-500 tracking-tight transition-colors duration-200 hidden group-hover/logo:block text-sm">Dashboard</span>
          </Link>
        </div>

        <div className="flex items-center gap-3">
              <button 
                onClick={() => { if (editorRef.current) saveForm(editorRef.current.getJSON()); }}
            className="p-1.5 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer mr-1"
            title={saveStatus === 'saving' ? "Saving..." : saveStatus === 'saved' ? "Saved" : saveStatus === 'error' ? "Error saving" : "Save draft"}
              >
            {saveStatus === 'saving' && <CloudUpload className="w-5 h-5 text-blue-500 animate-pulse" />}
            {saveStatus === 'saved' && <CloudCheck className="w-5 h-5 text-green-500 hover:text-green-600" />}
            {saveStatus === 'error' && <CloudOff className="w-5 h-5 text-red-500 hover:text-red-800" />}
            {saveStatus === 'idle' && <CloudCheck className="w-5 h-5 text-zinc-400 hover:text-zinc-800" />}
              </button>

            {formVersion !== null && (
            <span className="text-xs font-medium text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full border border-zinc-200">
              v{formVersion}
            </span>
          )}

          {formId && formVersion !== null && (
                <Popover.Root open={showHistory} onOpenChange={(open) => { setShowHistory(open); if (open) loadVersionHistory(); }}>
                  <Popover.Trigger asChild>
                <button className="p-1.5 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 rounded-lg transition-colors" title="Version History">
                  <History className="w-5 h-5" />
                    </button>
                  </Popover.Trigger>
              <Popover.Content align="center" sideOffset={8} className="w-64 p-2 rounded-xl border border-zinc-200 bg-white shadow-xl z-[150] outline-none max-h-80 overflow-y-auto">
                <div className="px-3 py-2 border-b border-zinc-100 mb-2">
                  <p className="text-sm font-semibold text-zinc-900">Version History</p>
                    </div>
                        {versionHistory.map(v => (
                          <button 
                            key={v.version}
                            onClick={() => { handleLoadVersion(v); setShowHistory(false); }}
                    className="w-full text-left px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 rounded-lg transition-colors flex justify-between items-center"
                          >
                    <span>Version {v.version}</span>
                    <span className="text-xs text-zinc-400">{new Date(v.created_at).toLocaleDateString()}</span>
                          </button>
                        ))}
                  </Popover.Content>
                </Popover.Root>
            )}

          <div className="h-4 w-px bg-zinc-300 mx-1"></div>

            <button
              onClick={handleSubmit}
            className="px-3 py-1 text-sm font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors"
            >
              Preview
            </button>
            
          <div className="flex items-center">
              <button
                onClick={handlePublish}
              className={`px-4 py-1 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 shadow-sm transition-colors ${formId && formVersion !== null ? 'rounded-lg' : 'rounded-lg'}`}
              >
                Publish
              </button>
              {formId && formVersion !== null && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.origin + '/s/' + formId);
                      setCopiedUrl(true);
                      setTimeout(() => setCopiedUrl(false), 2000);
                    }}
                title="Copy Link"
                className="ml-2 px-2 py-2 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 rounded-lg transition-colors flex justify-between items-center"
                  >
                {copiedUrl ? <Check size={16} /> : <LinkIcon size={16} />}
                  </button>
              )}
            </div>
          
          <div className="w-px h-4 bg-zinc-300 mx-2"></div>

          {userId ? (
            <Popover.Root>
              <Popover.Trigger asChild>
                <button className="relative w-8 h-8 rounded-full border border-zinc-200 overflow-hidden hover:ring-2 hover:ring-zinc-200 transition-all group focus:outline-none" title={userProfile?.email}>
                  <img src={getAnimalAvatar(userProfile?.email)} alt="Profile" className="w-full h-full object-cover bg-zinc-50" />
                </button>
              </Popover.Trigger>
              <Popover.Content align="end" sideOffset={8} className="w-56 p-2 rounded-xl border border-zinc-200 bg-white shadow-xl z-[150] outline-none">
                <div className="px-3 py-2 border-b border-zinc-100 mb-2">
                  <p className="text-sm font-medium text-zinc-900 truncate">{userProfile?.email || 'Logged in'}</p>
                </div>
                <Link 
                  href="/dashboard" 
                  className="w-full text-left px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 rounded-lg transition-colors block"
                >
                  My Forms
                </Link>
                <button 
                  onClick={handleLogout} 
                  className="w-full text-left px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Sign Out
                </button>
              </Popover.Content>
            </Popover.Root>
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
        className={`custom-drag-handle gap-0.5 fixed z-50 bg-white ml-4 text-zinc-400 ${isKeyboardActive && !menuOpen ? 'hidden' : 'flex'}`}
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
            className="w-64 p-2 rounded-xl border border-zinc-200 bg-white shadow-xl text-sm z-[60] flex flex-col focus:outline-none overflow-visible"
            side="right"
            align="start"
            sideOffset={8}
          >
            {activeNodeType && TURN_INTO_TARGETS[activeNodeType] && (
              <div className="px-2 py-1.5 border-b border-zinc-100 mb-1">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                  {TURN_INTO_TARGETS[activeNodeType].label}
                </span>
              </div>
            )}

            {activeNodeType && TURN_INTO_TARGETS[activeNodeType]?.group === "question" && (
              <>
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
              </>
            )}

            {/* Turn Into — hover to reveal submenu */}
            {activeNodeType && isConvertibleBlock(activeNodeType) && (
              <div
                className="relative"
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  if (window.innerHeight - rect.bottom < 300) {
                    setMenuVerticalAlign("bottom");
                  } else {
                    setMenuVerticalAlign("top");
                  }
                  setTurnIntoOpen(true);
                }}
                onMouseLeave={() => setTurnIntoOpen(false)}
              >
                <button
                  className={`flex items-center justify-between px-2 py-1.5 rounded text-zinc-700 transition-colors w-full text-left ${
                    turnIntoOpen ? "bg-zinc-100" : "hover:bg-zinc-100"
                  }`}
                >
                  <span className="flex items-center gap-2"><RefreshCw size={16} /> Turn into</span>
                  <ChevronRight size={14} className="text-zinc-400" />
                </button>

                {/* Hover submenu — floats to the right */}
                {turnIntoOpen && (
                  <div className={`absolute left-full pl-1 z-[70] ${menuVerticalAlign === "bottom" ? "bottom-0" : "top-0"}`}>
                    <div className="w-56 p-1.5 rounded-xl border border-zinc-200 bg-white shadow-xl max-h-[400px] overflow-y-auto turn-into-list">
                      {/* Basic blocks */}
                      <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider px-2 pt-1 pb-1">Basic</div>
                      {Object.entries(TURN_INTO_TARGETS)
                        .filter(([, t]) => t.group === "basic")
                        .map(([key, target]) => {
                          const isCurrent = key === activeNodeType;
                          return (
                            <button
                              key={key}
                              disabled={isCurrent}
                              className={`flex items-center gap-3 px-2 py-1.5 rounded w-full text-left transition-colors ${
                                isCurrent ? "bg-blue-50 text-blue-600 cursor-default" : "text-zinc-700 hover:bg-zinc-100"
                              }`}
                              onClick={() => !isCurrent && handleTurnInto(key)}
                            >
                              <span className={`flex items-center justify-center w-6 h-6 rounded border ${
                                isCurrent ? "border-blue-200 bg-blue-100" : "border-zinc-200 bg-zinc-50"
                              }`}>
                                {TURN_INTO_ICONS[key]}
                              </span>
                              <span className="flex-1 text-sm">{target.label}</span>
                              {isCurrent && <span className="text-[10px] font-semibold text-blue-400 uppercase">Current</span>}
                            </button>
                          );
                        })}

                      <div className="h-px bg-zinc-100 mx-2 my-1" />

                      {/* Question blocks */}
                      <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider px-2 pt-1 pb-1">Question</div>
                      {Object.entries(TURN_INTO_TARGETS)
                        .filter(([, t]) => t.group === "question")
                        .map(([key, target]) => {
                          const isCurrent = key === activeNodeType;
                          return (
                            <button
                              key={key}
                              disabled={isCurrent}
                              className={`flex items-center gap-3 px-2 py-1.5 rounded w-full text-left transition-colors ${
                                isCurrent ? "bg-blue-50 text-blue-600 cursor-default" : "text-zinc-700 hover:bg-zinc-100"
                              }`}
                              onClick={() => !isCurrent && handleTurnInto(key)}
                            >
                              <span className={`flex items-center justify-center w-6 h-6 rounded border ${
                                isCurrent ? "border-blue-200 bg-blue-100" : "border-zinc-200 bg-zinc-50"
                              }`}>
                                {TURN_INTO_ICONS[key]}
                              </span>
                              <span className="flex-1 text-sm">{target.label}</span>
                              {isCurrent && <span className="text-[10px] font-semibold text-blue-400 uppercase">Current</span>}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            )}
            
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
            editorProps={{ 
              handleKeyDown: (_, event) => {
                setIsKeyboardActive(true);
                return handleCommandNavigation(event);
              } 
            }}
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

      {/* Publish Success Modal */}
      {publishUrl && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setPublishUrl(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-zinc-900 mb-2">Form Published!</h3>
            <p className="text-sm text-zinc-500 mb-6">Your form is now live and ready to accept responses. Share the link below.</p>
            
            <div className="flex items-center gap-2 mb-6">
              <div className="flex-1 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm text-zinc-700 font-medium truncate select-all">
                {publishUrl}
              </div>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(publishUrl);
                  alert("Link copied!");
                }}
                className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors"
              >
                Copy
              </button>
            </div>
            
            <button 
              onClick={() => setPublishUrl(null)}
              className="w-full px-4 py-2 bg-zinc-100 text-zinc-700 hover:bg-zinc-200 rounded-lg text-sm font-medium transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}

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

export default function NewFormPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="text-zinc-400 animate-pulse font-medium">Loading editor...</div></div>}>
      <FormEditorContent />
    </Suspense>
  );
}
