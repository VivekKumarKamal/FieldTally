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
  CheckSquare, CircleDot, MapPin, Image, PenTool,
  Heading1, Heading2, Heading3, List, ListOrdered, Cloud, Check, History, CloudUpload, CloudOff, CloudCheck, ChevronLeft,
  FileDown, LayoutGrid, Sparkles, Share2, Globe, Lock, Trophy
} from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import * as Switch from "@radix-ui/react-switch";
import { Tooltip } from "../../components/Tooltip";
import { supabase } from "../../lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useLogicStore } from "../../hooks/useLogicStore";
import { turnBlockInto, TURN_INTO_TARGETS, isConvertibleBlock, resolveTargetKey } from "../../lib/turnInto";
import {
  loadForm as loadFormAction,
  saveDraft,
  publishForm,
  type SaveStatus,
  fetchSharingSettings,
  updateFormAccess,
  addFormMember,
  removeFormMember,
  updateFormMemberRole
} from "../../lib/formActions";
import { TEMPLATES, getClonedTemplateSchema } from "../../lib/templates";
import FormRenderer from "../../components/FormRenderer";

import { defaultExtensions } from "./extension";
import { slashCommand, suggestionItems } from "./slashCommand";
import ChatPanel from "./ai-chat/ChatPanel";

// Icon map for the "Turn Into" submenu
const TURN_INTO_ICONS: Record<string, React.ReactNode> = {
  paragraph: <span className="text-sm font-semibold">T</span>,
  "heading-1": <Heading1 size={16} />,
  "heading-2": <Heading2 size={16} />,
  "heading-3": <Heading3 size={16} />,
  bulletList: <List size={16} />,
  orderedList: <ListOrdered size={16} />,
  shortAnswerBlock: <Type size={16} />,
  longAnswerBlock: <AlignLeft size={16} />,
  numberAnswerBlock: <Hash size={16} />,
  emailAnswerBlock: <Mail size={16} />,
  phoneAnswerBlock: <Phone size={16} />,
  linkAnswerBlock: <Link2 size={16} />,
  dateAnswerBlock: <Calendar size={16} />,
  timeAnswerBlock: <Clock size={16} />,
  gpsAnswerBlock: <MapPin size={16} />,
  imageAnswerBlock: <Image size={16} />,
  signatureAnswerBlock: <PenTool size={16} />,
  checkboxBlock: <CheckSquare size={16} />,
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
  "gpsAnswerBlock",
  "imageAnswerBlock",
  "signatureAnswerBlock",
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
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
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

  // --- Quiz State ---
  const [correctAnswer, setCorrectAnswer] = useState<any>(null);
  const [quizPoints, setQuizPoints] = useState<number>(1);
  const [activeNodeOptions, setActiveNodeOptions] = useState<string[]>([]);
  const [quizMode, setQuizMode] = useState(false);
  const [showResultsImmediately, setShowResultsImmediately] = useState(true);

  const updateDocAttr = (key: string, value: any) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.view.dispatch(
      editor.state.tr.setNodeMarkup(0, null, {
        ...editor.state.doc.attrs,
        [key]: value,
      })
    );
    if (key === "quizMode") setQuizMode(value);
    if (key === "showResultsImmediately") setShowResultsImmediately(value);
    saveForm(editor.getJSON());
  };

  // --- Form Saving State ---
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [formId, setFormId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isEditorEmpty, setIsEditorEmpty] = useState(true);
  const [editorInitialData, setEditorInitialData] = useState<any>(initialContent);
  const [formTitle, setFormTitle] = useState("");
  const [publishUrl, setPublishUrl] = useState<string | null>(null);
  const [formVersion, setFormVersion] = useState<number | null>(null);
  const [latestPublishedSchema, setLatestPublishedSchema] = useState<any>(null);
  const [latestPublishedTitle, setLatestPublishedTitle] = useState<string | null>(null);
  const [versionHistory, setVersionHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [userProfile, setUserProfile] = useState<{ email?: string, avatar_url?: string } | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [accessOpen, setAccessOpen] = useState<boolean>(true);
  const [formMembers, setFormMembers] = useState<{ user_id: string; email: string; name?: string; role: "owner" | "editor" | "viewer" | "submitter" }[]>([]);
  const [shareEmailInput, setShareEmailInput] = useState("");
  const [addMemberRoles, setAddMemberRoles] = useState({
    viewer: true,
    submitter: false,
  });
  const [isUpdatingAccess, setIsUpdatingAccess] = useState(false);

  const handleAddRoleChange = (role: 'viewer' | 'submitter', checked: boolean) => {
    setAddMemberRoles(prev => {
      if (role === 'submitter') {
        if (checked) {
          return { viewer: true, submitter: true };
        } else {
          return { ...prev, submitter: false };
        }
      } else { // viewer
        if (checked) {
          return { ...prev, viewer: true };
        } else {
          return { viewer: false, submitter: false };
        }
      }
    });
  };
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- PDF Export Workspace Redirect ---
  const handleExportPDF = () => {
    if (!editorRef.current) return;
    const json = editorRef.current.getJSON();
    localStorage.setItem("export_form_schema", JSON.stringify(json));
    localStorage.setItem("export_form_title", formTitle);
    if (formId) {
      localStorage.setItem("export_form_id", formId);
    }
    window.open("/create-form/export-pdf", "_blank");
  };

  const handleLoadTemplate = (template: any) => {
    if (!editorRef.current) return;

    // Check if the current editor has any meaningful content or title
    const currentJson = editorRef.current.getJSON();
    const hasContent = currentJson.content && (
      currentJson.content.length > 1 ||
      (currentJson.content[0] && currentJson.content[0].content && currentJson.content[0].content.length > 0)
    );

    if (hasContent || formTitle.trim() !== "") {
      const confirmLoad = confirm("Loading a template will replace all current questions and content in the editor. Do you want to continue?");
      if (!confirmLoad) return;
    }

    const freshSchema = getClonedTemplateSchema(template.schema);

    // Set content in Tiptap
    editorRef.current.commands.setContent(freshSchema);
    // Update title
    setFormTitle(template.title);
    // Save draft
    saveForm(freshSchema, template.title);
    setShowTemplates(false);
  };

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

      // Programmatically update the address bar so that refreshes preserve the draft
      if (!formIdParam && result.formId) {
        window.history.replaceState(null, "", `/create-form?form=${result.formId}`);
      }

      if (result.userId && result.formId) {
        fetchSharingSettings(result.formId).then((settings) => {
          setAccessOpen(settings.access_open);
          setFormMembers(settings.members);
        });
      }
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
    setIsEditorEmpty(editor.isEmpty);
    setSaveStatus("saving");
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      saveForm(editor.getJSON());
    }, 1500);
  };

  /** Extract option texts from checkbox/MCQ block children */
  const extractOptionsFromNode = (node: any): string[] => {
    const opts: string[] = [];
    node.forEach((child: any) => {
      if (child.type.name === "checkboxOption" || child.type.name === "multipleChoiceOption") {
        const text = child.textContent.trim();
        if (text) opts.push(text);
      }
    });
    return opts;
  };

  const QUIZ_BLOCK_TYPES = new Set(["multipleChoiceBlock", "checkboxBlock", "numberAnswerBlock"]);

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

          // Read quiz attributes
          if (QUIZ_BLOCK_TYPES.has(node.type.name)) {
            setCorrectAnswer(node.attrs.correctAnswer ?? null);
            setQuizPoints(node.attrs.quizPoints ?? 1);
            setActiveNodeOptions(extractOptionsFromNode(node));
          } else {
            setCorrectAnswer(null);
            setQuizPoints(1);
            setActiveNodeOptions([]);
          }
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
    setIsEditorEmpty(editor.isEmpty);

    // Read document attributes
    const docAttrs = editor.state.doc.attrs;
    setQuizMode(docAttrs.quizMode ?? false);
    setShowResultsImmediately(docAttrs.showResultsImmediately ?? true);
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
    if (formId) {
      localStorage.setItem("preview_form_id", formId);
    }
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
    if (target.closest("[data-ai-panel]")) {
      return;
    }
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
      <div className="print:hidden">
        {/* Top Navigation Bar */}
        <div className="fixed top-0 left-0 right-0 h-14 bg-white/70 backdrop-blur-xl border-b border-zinc-200/60 z-[100] px-6 flex items-center justify-between transition-all duration-200">
          <div className="flex items-center gap-6">
            <Link href={userId ? "/dashboard" : "/"} className={`flex items-center gap-2 ${userId ? 'group/logo' : ''}`}>
              <div className={`w-6 h-6 bg-gradient-to-br from-zinc-800 to-zinc-600 rounded flex items-center justify-center shadow-sm transition-all duration-200 ${userId ? 'group-hover/logo:from-zinc-700 group-hover/logo:to-zinc-500' : ''}`}>
                <span className={`text-white text-xs font-bold tracking-tighter block ${userId ? 'group-hover/logo:hidden' : ''}`}>FT</span>
                {userId && <ChevronLeft className="w-4 h-4 text-white hidden group-hover/logo:block" />}
              </div>
              <span className={`font-semibold text-zinc-800 tracking-tight transition-colors duration-200 block ${userId ? 'group-hover/logo:hidden' : ''}`}>FieldTally</span>
              {userId && <span className="font-semibold text-zinc-500 tracking-tight transition-colors duration-200 hidden group-hover/logo:block text-sm">Dashboard</span>}
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
                      <span className="text-xs text-zinc-400">{new Date(v.created_at).toLocaleDateString() + " | " + new Date(v.created_at).toLocaleTimeString()}</span>
                    </button>
                  ))}
                </Popover.Content>
              </Popover.Root>
            )}



            <div className="h-4 w-px bg-zinc-300 mx-1"></div>

            <button
              onClick={() => setIsAiChatOpen(!isAiChatOpen)}
              className={`px-3 py-1 text-sm font-medium transition-all rounded-lg flex items-center gap-1.5 cursor-pointer border ${
                isAiChatOpen
                  ? "bg-blue-50 border-blue-200 text-blue-600"
                  : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-sm border-transparent hover:shadow"
              }`}
              title="Open AI Form Assistant"
            >
              <Sparkles size={14} className={isAiChatOpen ? "" : "animate-pulse"} />
              <span>AI Assistant</span>
            </button>

            <Popover.Root>
              <Popover.Trigger asChild>
                <button
                  className={`px-3 py-1 text-sm font-medium transition-all rounded-lg flex items-center gap-1.5 cursor-pointer border ${
                    quizMode
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm"
                      : "bg-zinc-100 border-zinc-200 text-zinc-600 hover:bg-zinc-200"
                  }`}
                  title="Quiz Settings"
                >
                  <Trophy size={14} className={quizMode ? "text-emerald-600" : "text-zinc-400"} />
                  <span>Quiz Settings</span>
                </button>
              </Popover.Trigger>
              <Popover.Content align="center" sideOffset={8} className="w-80 p-4 rounded-xl border border-zinc-200 bg-white shadow-xl z-[150] outline-none">
                <div className="flex flex-col gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-950">Quiz Settings</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">Turn this form into an auto-graded quiz/assessment.</p>
                  </div>

                  <div className="h-px bg-zinc-100" />

                  <div className="flex items-center justify-between">
                    <div className="flex flex-col pr-4">
                      <span className="text-xs font-semibold text-zinc-800">Quiz Mode</span>
                      <span className="text-[10px] text-zinc-400">Enable auto-grading for MCQ/Checkbox/Number questions.</span>
                    </div>
                    <Switch.Root
                      checked={quizMode}
                      onCheckedChange={(checked) => updateDocAttr("quizMode", checked)}
                      className="w-10 h-6 bg-zinc-200 rounded-full relative data-[state=checked]:bg-emerald-500 outline-none cursor-pointer shadow-inner transition-colors"
                    >
                      <Switch.Thumb className="block w-4 h-4 bg-white rounded-full transition-transform duration-100 translate-x-1 will-change-transform data-[state=checked]:translate-x-5 shadow-sm" />
                    </Switch.Root>
                  </div>

                  {quizMode && (
                    <div className="flex flex-col gap-3 pt-1 border-t border-zinc-100 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col pr-4">
                          <span className="text-xs font-semibold text-zinc-800">Immediate Results</span>
                          <span className="text-[10px] text-zinc-400">Show submission results and scores to respondents immediately.</span>
                        </div>
                        <Switch.Root
                          checked={showResultsImmediately}
                          onCheckedChange={(checked) => updateDocAttr("showResultsImmediately", checked)}
                          className="w-10 h-6 bg-zinc-200 rounded-full relative data-[state=checked]:bg-emerald-500 outline-none cursor-pointer shadow-inner transition-colors"
                        >
                          <Switch.Thumb className="block w-4 h-4 bg-white rounded-full transition-transform duration-100 translate-x-1 will-change-transform data-[state=checked]:translate-x-5 shadow-sm" />
                        </Switch.Root>
                      </div>
                    </div>
                  )}
                </div>
              </Popover.Content>
            </Popover.Root>

            <button
              onClick={handleSubmit}
              className="px-3 py-1 text-sm font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors cursor-pointer"
            >
              Preview
            </button>

            <button
              onClick={handleExportPDF}
              className="px-3 py-1 text-sm font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Export form to PDF"
            >
              <FileDown size={14} />
              <span>Export PDF</span>
            </button>

            {formId && userId && (
              <Popover.Root>
                <Popover.Trigger asChild>
                  <button className="px-3 py-1 text-sm font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer animate-in fade-in" title="Share and Access Settings">
                    <Share2 size={14} />
                    <span>Share</span>
                  </button>
                </Popover.Trigger>
                <Popover.Content align="end" sideOffset={8} className="w-80 p-4 rounded-xl border border-zinc-200 bg-white shadow-xl z-[150] outline-none">
                  <div className="flex flex-col gap-4">
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-950">Share settings</h3>
                      <p className="text-xs text-zinc-500 mt-0.5">Control who can access and submit responses to this form.</p>
                    </div>

                    <div className="h-px bg-zinc-100" />

                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Access Link</span>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          readOnly
                          value={`${window.location.origin}/s/${formId}`}
                          className="flex-1 bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1 text-xs text-zinc-600 focus:outline-none"
                        />
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/s/${formId}`);
                            setCopiedUrl(true);
                            setTimeout(() => setCopiedUrl(false), 2000);
                          }}
                          className="px-2 py-1 text-xs font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200/60 rounded-lg transition-colors flex items-center justify-center shrink-0"
                          title="Copy submission link"
                        >
                          {copiedUrl ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Access Settings</span>
                      <div className="flex flex-col gap-1.5">
                        <button
                          onClick={async () => {
                            setIsUpdatingAccess(true);
                            const ok = await updateFormAccess(formId, true);
                            if (ok.ok) setAccessOpen(true);
                            else alert(ok.error || "Failed to update access settings.");
                            setIsUpdatingAccess(false);
                          }}
                          disabled={isUpdatingAccess}
                          className={`flex items-start gap-3 p-2.5 rounded-lg border text-left transition-all ${
                            accessOpen
                              ? "border-blue-200 bg-blue-50/50 text-blue-900"
                              : "border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700"
                          }`}
                        >
                          <Globe className={`w-4 h-4 mt-0.5 shrink-0 ${accessOpen ? "text-blue-500" : "text-zinc-400"}`} />
                          <div>
                            <p className="text-xs font-semibold">Anyone can submit</p>
                            <p className="text-[10px] text-zinc-500 mt-0.5">The form is public. No login required to submit answers.</p>
                          </div>
                        </button>

                        <button
                          onClick={async () => {
                            setIsUpdatingAccess(true);
                            const ok = await updateFormAccess(formId, false);
                            if (ok.ok) setAccessOpen(false);
                            else alert(ok.error || "Failed to update access settings.");
                            setIsUpdatingAccess(false);
                          }}
                          disabled={isUpdatingAccess}
                          className={`flex items-start gap-3 p-2.5 rounded-lg border text-left transition-all ${
                            !accessOpen
                              ? "border-blue-200 bg-blue-50/50 text-blue-900"
                              : "border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700"
                          }`}
                        >
                          <Lock className={`w-4 h-4 mt-0.5 shrink-0 ${!accessOpen ? "text-blue-500" : "text-zinc-400"}`} />
                          <div>
                            <p className="text-xs font-semibold">Restricted (Only selected people)</p>
                            <p className="text-[10px] text-zinc-500 mt-0.5">Only specific users added below can view and submit this form.</p>
                          </div>
                        </button>
                      </div>
                    </div>

                    {!accessOpen && (
                      <div className="flex flex-col gap-2 mt-1 animate-in fade-in slide-in-from-top-1 duration-200">
                        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Manage Access</span>
                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            if (!shareEmailInput.trim()) return;
                            setIsUpdatingAccess(true);
                            
                            let selectedRole: "viewer" | "submitter" = "viewer";
                            if (addMemberRoles.submitter) selectedRole = "submitter";

                            const result = await addFormMember(formId, shareEmailInput, selectedRole);
                            if (result.ok && result.member) {
                              setFormMembers((prev) => [...prev, result.member!]);
                              setShareEmailInput("");
                              setAddMemberRoles({ viewer: true, submitter: false });
                            } else {
                              alert(result.error || "Failed to add user.");
                            }
                            setIsUpdatingAccess(false);
                          }}
                          className="flex flex-col gap-2"
                        >
                          <div className="flex gap-2">
                            <input
                              type="email"
                              placeholder="Enter email address"
                              value={shareEmailInput}
                              onChange={(e) => setShareEmailInput(e.target.value)}
                              className="flex-1 border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                              required
                            />
                            <button
                              type="submit"
                              disabled={isUpdatingAccess}
                              className="px-3 py-1.5 text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors shrink-0 disabled:opacity-50"
                            >
                              Add
                            </button>
                          </div>
                          
                          <div className="flex items-center gap-4 px-1 py-0.5">
                            <label className="flex items-center gap-1.5 text-[11px] text-zinc-600 cursor-pointer font-medium select-none">
                              <input
                                type="checkbox"
                                checked={addMemberRoles.viewer}
                                onChange={(e) => handleAddRoleChange('viewer', e.target.checked)}
                                className="w-3.5 h-3.5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                              />
                              <span>Viewer</span>
                            </label>
                            <label className="flex items-center gap-1.5 text-[11px] text-zinc-600 cursor-pointer font-medium select-none">
                              <input
                                type="checkbox"
                                checked={addMemberRoles.submitter}
                                onChange={(e) => handleAddRoleChange('submitter', e.target.checked)}
                                className="w-3.5 h-3.5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                              />
                              <span>Submitter</span>
                            </label>
                          </div>
                        </form>

                        {formMembers.length > 0 ? (
                          <div className="max-h-36 overflow-y-auto border border-zinc-100 rounded-lg divide-y divide-zinc-50 mt-1">
                            {formMembers.map((member) => {
                              const displayName = member.name ? member.name.trim() : member.email.split('@')[0];
                              return (
                                <div key={member.user_id} className="flex items-center justify-between p-2 text-xs">
                                  <span 
                                    className="text-zinc-600 truncate max-w-[140px] font-semibold cursor-help" 
                                    title={member.email}
                                  >
                                    {displayName}
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    {member.role === "owner" ? (
                                      <span className="text-[10px] text-zinc-400 font-semibold uppercase bg-zinc-50 border border-zinc-200/50 px-1.5 py-0.5 rounded">
                                        owner
                                      </span>
                                    ) : (
                                      <select
                                        value={member.role === "editor" ? "submitter" : member.role}
                                        onChange={async (e) => {
                                          const newRole = e.target.value as "viewer" | "submitter";
                                          setIsUpdatingAccess(true);
                                          const result = await updateFormMemberRole(formId, member.user_id, newRole);
                                          if (result.ok) {
                                            setFormMembers(prev => prev.map(m => m.user_id === member.user_id ? { ...m, role: newRole } : m));
                                          } else {
                                            alert(result.error || "Failed to update role.");
                                          }
                                          setIsUpdatingAccess(false);
                                        }}
                                        disabled={isUpdatingAccess}
                                        className="text-[10px] text-zinc-600 font-medium bg-zinc-50 border border-zinc-200 rounded px-1.5 py-0.5 outline-none cursor-pointer focus:ring-1 focus:ring-blue-500"
                                      >
                                        <option value="viewer">Viewer</option>
                                        <option value="submitter">Submitter</option>
                                      </select>
                                    )}
                                    <button
                                      onClick={async () => {
                                        setIsUpdatingAccess(true);
                                        const ok = await removeFormMember(formId, member.user_id);
                                        if (ok.ok) {
                                          setFormMembers((prev) => prev.filter((m) => m.user_id !== member.user_id));
                                        } else {
                                          alert(ok.error || "Failed to remove member.");
                                        }
                                        setIsUpdatingAccess(false);
                                      }}
                                      disabled={isUpdatingAccess}
                                      className="p-1 text-zinc-400 hover:text-red-500 hover:bg-zinc-50 rounded transition-colors"
                                      title="Revoke access"
                                    >
                                      <Trash size={12} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-[10px] text-zinc-400 text-center py-2 bg-zinc-50 rounded-lg border border-dashed border-zinc-200">
                            No users added yet. Anyone with the link will be blocked until you add them.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </Popover.Content>
              </Popover.Root>
            )}

            <div className="flex items-center">
              <button
                onClick={handlePublish}
                className="px-4 py-1 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 shadow-sm transition-colors rounded-lg"
              >
                Publish
              </button>
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

        <div className={`pt-36 pb-24 max-w-4xl mx-auto transition-all duration-300 ${isAiChatOpen ? 'mr-[440px] ml-28 max-w-2xl' : 'px-12'}`}>
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

                    {/* Quiz Answer Configuration */}
                    {activeNodePos !== null && editorRef.current && QUIZ_BLOCK_TYPES.has(editorRef.current.state.doc.nodeAt(activeNodePos)?.type.name || "") && (() => {
                      const updateQuizAttr = (key: string, value: any) => {
                        if (activeNodePos === null || !editorRef.current) return;
                        const node = editorRef.current.state.doc.nodeAt(activeNodePos);
                        if (!node) return;
                        editorRef.current.view.dispatch(
                          editorRef.current.state.tr.setNodeMarkup(activeNodePos, null, {
                            ...node.attrs,
                            [key]: value,
                          })
                        );
                      };

                      const nodeType = editorRef.current.state.doc.nodeAt(activeNodePos)?.type.name;

                      return (
                        <>
                          <div className="px-2 py-1.5">
                            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Quiz Answer</span>
                          </div>

                          {/* MCQ: radio buttons */}
                          {nodeType === "multipleChoiceBlock" && activeNodeOptions.length > 0 && (
                            <div className="px-2 pb-1.5 flex flex-col gap-1">
                              {activeNodeOptions.map((opt, i) => {
                                const isCorrect = correctAnswer === opt;
                                return (
                                  <button
                                    key={i}
                                    className={`flex items-center gap-2 px-2 py-1 rounded text-xs text-left transition-colors w-full ${isCorrect ? "bg-emerald-50 text-emerald-700 font-semibold" : "text-zinc-600 hover:bg-zinc-50"}`}
                                    onClick={() => {
                                      const newVal = isCorrect ? null : opt;
                                      setCorrectAnswer(newVal);
                                      updateQuizAttr("correctAnswer", newVal);
                                    }}
                                  >
                                    <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${isCorrect ? "border-emerald-500 bg-emerald-500" : "border-zinc-300"}`}>
                                      {isCorrect && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                    </div>
                                    <span className="truncate">{opt}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {/* Checkbox: check multiple correct */}
                          {nodeType === "checkboxBlock" && activeNodeOptions.length > 0 && (
                            <div className="px-2 pb-1.5 flex flex-col gap-1">
                              {activeNodeOptions.map((opt, i) => {
                                const selected: string[] = Array.isArray(correctAnswer) ? correctAnswer : [];
                                const isCorrect = selected.includes(opt);
                                return (
                                  <button
                                    key={i}
                                    className={`flex items-center gap-2 px-2 py-1 rounded text-xs text-left transition-colors w-full ${isCorrect ? "bg-emerald-50 text-emerald-700 font-semibold" : "text-zinc-600 hover:bg-zinc-50"}`}
                                    onClick={() => {
                                      const newArr = isCorrect ? selected.filter(s => s !== opt) : [...selected, opt];
                                      const newVal = newArr.length > 0 ? newArr : null;
                                      setCorrectAnswer(newVal);
                                      updateQuizAttr("correctAnswer", newVal);
                                    }}
                                  >
                                    <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${isCorrect ? "border-emerald-500 bg-emerald-500" : "border-zinc-300"}`}>
                                      {isCorrect && (
                                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5L4.5 7.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                      )}
                                    </div>
                                    <span className="truncate">{opt}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {/* Number: exact or range */}
                          {nodeType === "numberAnswerBlock" && (
                            <div className="px-2 pb-1.5 flex flex-col gap-1.5">
                              <div className="flex gap-1">
                                <button
                                  className={`flex-1 px-2 py-1 rounded text-[11px] font-semibold transition-colors ${(!correctAnswer || correctAnswer?.type === "exact") ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "text-zinc-500 bg-zinc-50 border border-zinc-200 hover:bg-zinc-100"}`}
                                  onClick={() => {
                                    const newVal = { type: "exact" as const, value: correctAnswer?.value ?? undefined };
                                    setCorrectAnswer(newVal);
                                    updateQuizAttr("correctAnswer", newVal.value !== undefined ? newVal : null);
                                  }}
                                >Exact</button>
                                <button
                                  className={`flex-1 px-2 py-1 rounded text-[11px] font-semibold transition-colors ${correctAnswer?.type === "range" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "text-zinc-500 bg-zinc-50 border border-zinc-200 hover:bg-zinc-100"}`}
                                  onClick={() => {
                                    const newVal = { type: "range" as const, min: correctAnswer?.min ?? undefined, max: correctAnswer?.max ?? undefined };
                                    setCorrectAnswer(newVal);
                                    updateQuizAttr("correctAnswer", (newVal.min !== undefined || newVal.max !== undefined) ? newVal : null);
                                  }}
                                >Range</button>
                              </div>
                              {(!correctAnswer || correctAnswer?.type === "exact") && (
                                <input
                                  type="number"
                                  placeholder="Correct value"
                                  value={correctAnswer?.value ?? ""}
                                  className="w-full px-2 py-1 text-xs border border-zinc-200 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                                  onMouseDown={e => e.stopPropagation()}
                                  onClick={e => e.stopPropagation()}
                                  onChange={e => {
                                    const v = e.target.value;
                                    const newVal = v === "" ? null : { type: "exact" as const, value: Number(v) };
                                    setCorrectAnswer(newVal);
                                    updateQuizAttr("correctAnswer", newVal);
                                  }}
                                />
                              )}
                              {correctAnswer?.type === "range" && (
                                <div className="flex gap-1.5">
                                  <input
                                    type="number"
                                    placeholder="Min"
                                    value={correctAnswer?.min ?? ""}
                                    className="flex-1 px-2 py-1 text-xs border border-zinc-200 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                                    onMouseDown={e => e.stopPropagation()}
                                    onClick={e => e.stopPropagation()}
                                    onChange={e => {
                                      const v = e.target.value;
                                      const newVal = { ...correctAnswer, min: v === "" ? undefined : Number(v) };
                                      setCorrectAnswer(newVal);
                                      updateQuizAttr("correctAnswer", (newVal.min !== undefined || newVal.max !== undefined) ? newVal : null);
                                    }}
                                  />
                                  <input
                                    type="number"
                                    placeholder="Max"
                                    value={correctAnswer?.max ?? ""}
                                    className="flex-1 px-2 py-1 text-xs border border-zinc-200 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                                    onMouseDown={e => e.stopPropagation()}
                                    onClick={e => e.stopPropagation()}
                                    onChange={e => {
                                      const v = e.target.value;
                                      const newVal = { ...correctAnswer, max: v === "" ? undefined : Number(v) };
                                      setCorrectAnswer(newVal);
                                      updateQuizAttr("correctAnswer", (newVal.min !== undefined || newVal.max !== undefined) ? newVal : null);
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          )}

                          {/* Points input */}
                          <div className="flex items-center justify-between px-2 py-1.5">
                            <span className="text-xs text-zinc-600">Points</span>
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={quizPoints}
                              className="w-16 px-2 py-0.5 text-xs text-right border border-zinc-200 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                              onMouseDown={e => e.stopPropagation()}
                              onClick={e => e.stopPropagation()}
                              onChange={e => {
                                const v = Math.max(0, Number(e.target.value) || 0);
                                setQuizPoints(v);
                                updateQuizAttr("quizPoints", v);
                              }}
                            />
                          </div>

                          {correctAnswer && (
                            <button
                              className="flex items-center gap-1.5 px-2 py-1 mx-2 mb-1 rounded text-[11px] text-red-500 hover:bg-red-50 transition-colors"
                              onClick={() => {
                                setCorrectAnswer(null);
                                updateQuizAttr("correctAnswer", null);
                              }}
                            >
                              <Trash size={11} />
                              <span>Clear answer</span>
                            </button>
                          )}

                          <div className="h-px bg-zinc-100 my-1 mx-2" />
                        </>
                      );
                    })()}
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
                      className={`flex items-center justify-between px-2 py-1.5 rounded text-zinc-700 transition-colors w-full text-left ${turnIntoOpen ? "bg-zinc-100" : "hover:bg-zinc-100"
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
                                  className={`flex items-center gap-3 px-2 py-1.5 rounded w-full text-left transition-colors ${isCurrent ? "bg-blue-50 text-blue-600 cursor-default" : "text-zinc-700 hover:bg-zinc-100"
                                    }`}
                                  onClick={() => !isCurrent && handleTurnInto(key)}
                                >
                                  <span className={`flex items-center justify-center w-6 h-6 rounded border ${isCurrent ? "border-blue-200 bg-blue-100" : "border-zinc-200 bg-zinc-50"
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
                                  className={`flex items-center gap-3 px-2 py-1.5 rounded w-full text-left transition-colors ${isCurrent ? "bg-blue-50 text-blue-600 cursor-default" : "text-zinc-700 hover:bg-zinc-100"
                                    }`}
                                  onClick={() => !isCurrent && handleTurnInto(key)}
                                >
                                  <span className={`flex items-center justify-center w-6 h-6 rounded border ${isCurrent ? "border-blue-200 bg-blue-100" : "border-zinc-200 bg-zinc-50"
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

          {/* Light-themed Template Selection Boxes (positioned below the first line, always mounted for smooth transition) */}
          <div
            className={`transition-all duration-500 ease-in-out ${isLoaded && formTitle.trim() === "" && isEditorEmpty
                ? "opacity-100 translate-y-0 scale-100 max-h-[500px] mt-10"
                : "opacity-0 -translate-y-4 scale-95 max-h-0 overflow-hidden mt-0 pointer-events-none"
              }`}
          >
            <div className="p-6 bg-zinc-50/50 border border-zinc-200/80 rounded-2xl">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Start with a template</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                {TEMPLATES.map((template) => {
                  const complexity = template.id === "contact-form" ? "1/3" : template.id === "product-survey" ? "2/3" : "3/3";
                  return (
                    <button
                      key={template.id}
                      onClick={() => handleLoadTemplate(template)}
                      className="text-left bg-white border border-zinc-200/60 hover:border-blue-400/80 rounded-md hover:shadow-sm active:scale-[0.99] transition-all flex flex-col justify-between group cursor-pointer p-3"
                    >
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md text-zinc-600 bg-zinc-50 border border-zinc-100/80">
                            Complexity: {complexity}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-zinc-600 group-hover:text-zinc-800 transition-colors mb-1">
                          {template.title.replace(/^\d+\.\s*/, "")}
                        </h4>
                        <p className="text-[10px] text-zinc-400 leading-normal">
                          {template.description}
                        </p>
                      </div>
                      <span className="text-[9px] font-bold text-blue-600 group-hover:text-blue-700 transition-colors mt-3 block">
                        Apply Template &rarr;
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
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

        <ChatPanel
          isOpen={isAiChatOpen}
          onClose={() => setIsAiChatOpen(false)}
          currentFormTitle={formTitle}
          getCurrentSchema={() => editorRef.current?.getJSON()}
          onApplySchema={(schema, title) => {
            if (editorRef.current) {
              editorRef.current.commands.setContent(schema);
              setFormTitle(title);
              saveForm(schema, title);
            }
          }}
        />
      </div>


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
