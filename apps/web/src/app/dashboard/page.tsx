"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, FileText, Globe, Pencil, Trash2, Clock, AlertCircle, ClipboardList, Compass, Search, ArrowUpDown } from "lucide-react";
import { parseStoredDraft, deleteForm } from "../../lib/formActions";
import { apiGet, apiSend } from "../../lib/apiClient";
import * as Popover from "@radix-ui/react-popover";
import { TEMPLATES, createFormFromTemplate } from "../../lib/templates";

/** Large enough that search/filter/sort (client-side, over this page) sees
 * every form for virtually all users in one request — the API caps this at
 * 100. "Load more" still exists below that for the rare account past it. */
const PAGE_SIZE = 100;

const TEMPLATE_ICONS: Record<string, any> = {
  Compass: Compass,
  ClipboardList: ClipboardList,
  AlertCircle: AlertCircle,
};

type FormRow = {
  id: string;
  status: string | null;
  updated_at: string | null;
  draft_schema: any;
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

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [forms, setForms] = useState<FormRow[]>([]);
  const [sharedForms, setSharedForms] = useState<any[]>([]);
  const [orphanDraft, setOrphanDraft] = useState<{ id: string; title: string } | null>(null);
  const [claimingDraft, setClaimingDraft] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [totalForms, setTotalForms] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "published">("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  const fetchOwnedForms = async (offset: number) => {
    const result = await apiGet<{ forms: FormRow[]; total: number; hasMore: boolean }>(
      `/api/forms?scope=owned&limit=${PAGE_SIZE}&offset=${offset}`
    );
    if (!result.ok || !result.data) return null;
    return result.data;
  };

  useEffect(() => {
    document.title = "Dashboard · FieldTally";

    async function init() {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        router.replace("/login");
        return;
      }
      setUser(currentUser);

      const [owned, shared] = await Promise.all([
        fetchOwnedForms(0),
        apiGet<{ forms: any[] }>(`/api/forms?scope=shared&limit=${PAGE_SIZE}&offset=0`),
      ]);

      const ownedForms = owned?.forms ?? [];
      setForms(ownedForms);
      setTotalForms(owned?.total ?? ownedForms.length);
      setHasMore(owned?.hasMore ?? false);
      setSharedForms(shared.ok ? shared.data?.forms ?? [] : []);

      // Check for orphan local draft (created before login). Only the first page
      // is loaded, so confirm against the server rather than the loaded slice.
      const localDraftId = localStorage.getItem("current_draft_form_id");
      if (localDraftId) {
        const localData = localStorage.getItem(`draft_schema_${localDraftId}`);
        const parsed = parseStoredDraft(localData);
        if (parsed && (parsed.title || parsed.schema?.content?.length > 1)) {
          const existing = await apiGet(`/api/forms/${localDraftId}?status=draft`);
          if (!existing.ok) {
            setOrphanDraft({ id: localDraftId, title: parsed.title || "Untitled Form" });
          }
        }
      }

      setLoading(false);
    }

    init();
  }, [router]);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    const next = await fetchOwnedForms(forms.length);
    if (next) {
      setForms(prev => [...prev, ...next.forms]);
      setTotalForms(next.total);
      setHasMore(next.hasMore);
    }
    setLoadingMore(false);
  };

  const handleClaimDraft = async () => {
    if (!orphanDraft || !user) return;
    setClaimingDraft(true);

    const localData = localStorage.getItem(`draft_schema_${orphanDraft.id}`);
    const parsed = parseStoredDraft(localData);
    if (parsed) {
      const created = await apiSend("/api/forms", "POST", {
        id: orphanDraft.id,
        draft_schema: { title: parsed.title || "", content: parsed.schema },
      });
      if (!created.ok) {
        alert(created.error || "Could not save that draft to your account.");
        setClaimingDraft(false);
        return;
      }
    }

    const refreshed = await fetchOwnedForms(0);
    if (refreshed) {
      setForms(refreshed.forms);
      setTotalForms(refreshed.total);
      setHasMore(refreshed.hasMore);
    }
    setOrphanDraft(null);
    setClaimingDraft(false);
  };

  const handleDismissDraft = () => {
    if (!orphanDraft) return;
    localStorage.removeItem("current_draft_form_id");
    localStorage.removeItem(`draft_schema_${orphanDraft.id}`);
    setOrphanDraft(null);
  };

  const handleNewForm = () => {
    router.push("/create-form");
  };

  const handleEditForm = (formId: string) => {
    router.push(`/create-form?form=${formId}`);
  };

  const handleDeleteForm = async (formId: string) => {
    if (!confirm("Are you sure you want to delete this form and all of its responses? This cannot be undone.")) return;
    setDeletingId(formId);

    const result = await deleteForm(formId);

    if (!result.ok) {
      alert(result.error || "Failed to delete the form.");
      setDeletingId(null);
      return;
    }

    setForms(prev => prev.filter(f => f.id !== formId));
    setTotalForms(prev => Math.max(0, prev - 1));
    setDeletingId(null);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const getFormTitle = (form: FormRow): string => {
    const draft = form.draft_schema as any;
    return draft?.title || "Untitled Form";
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Unknown";
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  // Search/filter/sort run over whatever is currently loaded (up to PAGE_SIZE,
  // which is nearly always "all of them" — see the constant's comment).
  const visibleForms = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = forms.filter((f) => {
      if (statusFilter !== "all" && (f.status ?? "draft") !== statusFilter) return false;
      if (q && !getFormTitle(f).toLowerCase().includes(q)) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      const at = a.updated_at ? Date.parse(a.updated_at) : 0;
      const bt = b.updated_at ? Date.parse(b.updated_at) : 0;
      return sortOrder === "newest" ? bt - at : at - bt;
    });
    return list;
  }, [forms, search, statusFilter, sortOrder]);

  const isFiltered = search.trim() !== "" || statusFilter !== "all";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="text-zinc-400 animate-pulse font-medium">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-2">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-zinc-800 to-zinc-600 rounded flex items-center justify-center shadow-sm">
              <span className="text-white text-xs font-bold tracking-tighter">FT</span>
            </div>
            <span className="font-semibold text-zinc-800 tracking-tight">FieldTally</span>
          </Link>

          <div className="flex items-center gap-4">
            <button
              onClick={handleNewForm}
              className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">New Form</span>
            </button>
            <div className="w-px h-5 bg-zinc-200"></div>
            <Popover.Root>
              <Popover.Trigger asChild>
                <button
                  className="relative w-8 h-8 rounded-full border border-zinc-200 overflow-hidden hover:ring-2 hover:ring-zinc-200 transition-all focus:outline-none cursor-pointer"
                  title={user?.email}
                >
                  <img
                    src={getAnimalAvatar(user?.email)}
                    alt="Profile"
                    className="w-full h-full object-cover bg-zinc-50"
                  />
                </button>
              </Popover.Trigger>
              <Popover.Content align="end" sideOffset={8} className="w-56 p-2 rounded-xl border border-zinc-200 bg-white shadow-xl z-[150] outline-none">
                <div className="px-3 py-2 border-b border-zinc-100 mb-2">
                  <p className="text-xs font-medium text-zinc-900 truncate">{user?.email || 'Logged in'}</p>
                </div>
                <Link 
                  href="/create-form" 
                  className="w-full text-left px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 rounded-lg transition-colors block"
                >
                  Create a Form
                </Link>
                <button 
                  onClick={handleLogout} 
                  className="w-full text-left px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                >
                  Sign Out
                </button>
              </Popover.Content>
            </Popover.Root>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Orphan draft banner */}
        {orphanDraft && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900">
                You have an unsaved form: &ldquo;{orphanDraft.title}&rdquo;
              </p>
              <p className="text-sm text-amber-700 mt-0.5">
                It was created before you signed in. Would you like to save it to your account?
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleClaimDraft}
                  disabled={claimingDraft}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {claimingDraft ? "Saving..." : "Save to my account"}
                </button>
                <button
                  onClick={handleDismissDraft}
                  className="px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-100 rounded-lg transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Templates section */}
        <div className="mb-10">
          <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">Start with a Template</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {TEMPLATES.map((template) => {
              const Icon = TEMPLATE_ICONS[template.iconName] || FileText;
              return (
                <button
                  key={template.id}
                  onClick={async () => {
                    const path = await createFormFromTemplate(template, user?.id || null);
                    router.push(path);
                  }}
                  className="text-left bg-white border border-zinc-200/80 rounded-xl p-5 hover:border-zinc-300 hover:shadow-sm transition-all flex flex-col justify-between group cursor-pointer"
                >
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider bg-zinc-50 border border-zinc-200/60 px-2 py-0.5 rounded">
                        {template.category}
                      </span>
                      <Icon className="w-5 h-5 text-zinc-400 group-hover:text-zinc-700 transition-colors" />
                    </div>
                    <h3 className="text-sm font-bold text-zinc-800 group-hover:text-zinc-900 transition-colors mb-1">
                      {template.title}
                    </h3>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      {template.description}
                    </p>
                  </div>
                  <div className="mt-4 flex items-center gap-1 text-[11px] font-semibold text-blue-600 group-hover:text-blue-700 transition-colors">
                    <span>Use template</span>
                    <svg className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-zinc-900">Your Forms</h2>
          <span className="text-sm text-zinc-400">
            {isFiltered ? `${visibleForms.length} of ${totalForms}` : totalForms} {totalForms === 1 ? "form" : "forms"}
          </span>
        </div>

        {forms.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search your forms…"
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg outline-none focus:border-zinc-400 transition-colors"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg outline-none focus:border-zinc-400 text-zinc-700 cursor-pointer"
            >
              <option value="all">All statuses</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
            <button
              onClick={() => setSortOrder((o) => (o === "newest" ? "oldest" : "newest"))}
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-white border border-zinc-200 hover:border-zinc-300 rounded-lg transition-colors text-zinc-700 whitespace-nowrap"
              title="Sort by last updated"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400" />
              {sortOrder === "newest" ? "Newest first" : "Oldest first"}
            </button>
          </div>
        )}

        {forms.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-zinc-300" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-700 mb-1">No forms yet</h3>
            <p className="text-sm text-zinc-400 mb-6">Create your first form to get started.</p>
            <button
              onClick={handleNewForm}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Create Form
            </button>
          </div>
        ) : visibleForms.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-zinc-300" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-700 mb-1">No matching forms</h3>
            <p className="text-sm text-zinc-400">Try a different search or filter.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {visibleForms.map(form => {
              const title = getFormTitle(form);
              const isPublished = form.status === "published";
              const isDeleting = deletingId === form.id;

              return (
                <div
                  key={form.id}
                  className={`group bg-white border border-zinc-200/80 rounded-xl p-4 hover:border-zinc-300 hover:shadow-sm transition-all ${isDeleting ? "opacity-50 pointer-events-none" : ""}`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isPublished ? "bg-emerald-50" : "bg-zinc-100"}`}>
                        {isPublished ? (
                          <Globe className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <FileText className="w-4 h-4 text-zinc-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-zinc-900 truncate">{title}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full ${isPublished ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>
                            {isPublished ? "Published" : "Draft"}
                          </span>
                          <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(form.updated_at)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-wrap pl-12 md:pl-0">
                      <button
                        onClick={() => handleEditForm(form.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      {isPublished && (
                        <Link
                          href={`/s/${form.id}`}
                          target="_blank"
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors"
                        >
                          <Globe className="w-3.5 h-3.5" />
                          View
                        </Link>
                      )}
                      <Link
                        href={`/dashboard/submissions/${form.id}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors"
                      >
                        <ClipboardList className="w-3.5 h-3.5" />
                        Submissions
                      </Link>
                      <button
                        onClick={() => handleDeleteForm(form.id)}
                        className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete form"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {hasMore && (
          <div className="flex justify-center mt-6">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="px-5 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 rounded-lg transition-all shadow-sm disabled:opacity-50"
            >
              {loadingMore ? "Loading…" : `Load more (${totalForms - forms.length} remaining)`}
            </button>
          </div>
        )}

        {/* Shared with You Section */}
        {sharedForms.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-zinc-900">Shared with You</h2>
              <span className="text-sm text-zinc-400">{sharedForms.length} {sharedForms.length === 1 ? "form" : "forms"}</span>
            </div>

            <div className="grid gap-3">
              {sharedForms.map(form => {
                const title = getFormTitle(form);
                const isPublished = form.status === "published";
                
                return (
                  <div
                    key={form.id}
                    className="group bg-white border border-zinc-200/80 rounded-xl p-4 hover:border-zinc-300 hover:shadow-sm transition-all"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isPublished ? "bg-blue-50" : "bg-zinc-100"}`}>
                          {isPublished ? (
                            <Globe className="w-4 h-4 text-blue-600" />
                          ) : (
                            <FileText className="w-4 h-4 text-zinc-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-zinc-900 truncate">{title}</h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-500 tracking-wider">
                              {form.role}
                            </span>
                            <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDate(form.updated_at)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-wrap pl-12 md:pl-0">
                        {isPublished ? (
                          <Link
                            href={`/s/${form.id}`}
                            target="_blank"
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors"
                          >
                            <Globe className="w-3.5 h-3.5" />
                            View Form
                          </Link>
                        ) : (
                          <span className="text-xs text-zinc-400 font-medium px-3 py-1.5 select-none pl-12 md:pl-0">
                            Not published yet
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
