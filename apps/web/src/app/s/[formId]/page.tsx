"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import FormRenderer from "../../../components/FormRenderer";
import { FileDown, Copy, Check, Trophy } from "lucide-react";

function PoweredByBadge() {
  return (
    <Link 
      href="/"
      className="fixed bottom-6 right-6 flex items-center gap-1.5 px-3 py-2 bg-white/80 border border-zinc-200/60 rounded-lg text-xs font-medium text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50 transition-all z-50 group"
    >
      <span>Powered by</span>
      <span className="font-semibold text-zinc-800">FieldTally</span>
      <div className="w-4 h-4 bg-gradient-to-r from-zinc-600 to-zinc-800 rounded-md flex items-center justify-center opacity-90 group-hover:opacity-100 transition-opacity">
         <span className="text-white text-[8px] font-bold tracking-tighter">FT</span>
      </div>
    </Link>
  );
}

function SubmissionPageContent() {
  const router = useRouter();
  const params = useParams()!;
  const searchParams = useSearchParams();
  const formId = params?.formId as string;
  const versionQuery = searchParams?.get("version");
  
  const [formSchema, setFormSchema] = useState<any>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formVersionId, setFormVersionId] = useState<string>("");
  const [formVersionNum, setFormVersionNum] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [quizResult, setQuizResult] = useState<any>(null);
  const [isLatestVersion, setIsLatestVersion] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href.split('?')[0]);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleExportPDF = () => {
    if (!formSchema) return;
    localStorage.setItem("export_form_schema", JSON.stringify(formSchema));
    localStorage.setItem("export_form_title", formTitle);
    window.open("/create-form/export-pdf", "_blank");
  };

  useEffect(() => {
    async function loadForm() {
      if (!formId) return;

      if (formId === "preview") {
        const raw = localStorage.getItem("preview_form_schema");
        const title = localStorage.getItem("preview_form_title") || "Preview Form";
        if (raw) {
          try {
            setFormSchema(JSON.parse(raw));
            setFormTitle(title);
            setFormVersionNum(1);
            setLoading(false);
            return;
          } catch (e) {
            console.error("Failed to parse preview schema", e);
          }
        }
        setError("Preview schema not found in local storage.");
        setLoading(false);
        return;
      }
      
      try {
        // Fetch form status to ensure it's accessible and get its data
        const { data: form, error: formError } = await supabase
          .from('forms')
          .select('id, status, access_open, created_by')
          .eq('id', formId)
          .single();
          
        if (formError || !form) {
          setError(`Form not found or you do not have permission to view it.`);
          setLoading(false);
          return;
        }

        if (form.status !== 'published') {
          setError("This form is not currently published.");
          setLoading(false);
          return;
        }

        // Get user role information
        let resolvedRole: string | null = null;
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          if (user.id === form.created_by) {
            resolvedRole = 'owner';
          } else {
            const { data: member } = await supabase
              .from('form_members')
              .select('role')
              .eq('form_id', form.id)
              .eq('user_id', user.id)
              .maybeSingle();
            if (member) {
              resolvedRole = member.role;
            }
          }
        }

        // Access Control Logic
        if (!form.access_open) {
          if (!user) {
            setError("restricted");
            setLoading(false);
            return;
          }

          if (user.id !== form.created_by && !resolvedRole) {
            setError("You do not have permission to access this form.");
            setLoading(false);
            return;
          }
        }

        setUserRole(resolvedRole);

        // Fetch latest version info to see if requested version is latest
        const { data: latestVersionResult, error: latestError } = await supabase.from('form_versions')
          .select('id, version, title, content')
          .eq('form_id', formId)
          .order('version', { ascending: false })
          .limit(1)
          .single();
          
        if (latestError || !latestVersionResult) {
           setError("No published versions found for this form.");
           setLoading(false);
           return;
        }

        let targetVersionData = latestVersionResult;

        if (versionQuery) {
          const versionNumber = parseInt(versionQuery, 10);
          if (!isNaN(versionNumber) && versionNumber !== latestVersionResult.version) {
            const { data: specificVersion, error: specificError } = await supabase
              .from('form_versions')
              .select('id, version, title, content')
              .eq('form_id', formId)
              .eq('version', versionNumber)
              .single();

            if (!specificError && specificVersion) {
              targetVersionData = specificVersion;
              setIsLatestVersion(false);
            } else {
              setError(`Form version ${versionNumber} not found.`);
              setLoading(false);
              return;
            }
          }
        }

        const isQuiz = targetVersionData.content?.attrs?.quizMode === true;
        if (isQuiz) {
          const localCheck = localStorage.getItem(`quiz_submitted_${formId}`);
          if (localCheck) {
            setError("already_submitted");
            setLoading(false);
            return;
          }

          if (user) {
            const { data: existingSubmissions } = await supabase
              .from('submissions')
              .select('id')
              .eq('form_id', formId)
              .eq('submitted_by', user.id)
              .limit(1);

            if (existingSubmissions && existingSubmissions.length > 0) {
              setError("already_submitted");
              setLoading(false);
              return;
            }
          }
        }

        setFormVersionId(targetVersionData.id);
        setFormSchema(targetVersionData.content);
        setFormTitle(targetVersionData.title);
        setFormVersionNum(targetVersionData.version);
        document.title = targetVersionData.title ? `${targetVersionData.title} · FieldTally` : "FieldTally";
        setLoading(false);
      } catch {
        setError("Error loading form.");
        setLoading(false);
      }
    }
    
    loadForm();
  }, [formId, versionQuery]);

  const handleSubmit = async (answers: any) => {
    if (userRole === 'viewer') {
      alert("Viewers are not permitted to submit responses.");
      return;
    }

    if (answers.__quiz_result) {
      setQuizResult(answers.__quiz_result);
    }

    if (formId === "preview") {
      console.log("Preview submission data (database insert bypassed):", answers);
      setSubmitted(true);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (formVersionNum == null) {
        alert("Could not determine form version. Please reload and try again.");
        return;
      }

      const { error } = await supabase.from('submissions').insert({
        form_id: formId,
        form_version: formVersionNum,
        submitted_by: user ? user.id : null,
        data: answers,
        filled_at: new Date().toISOString()
      });

      if (error) throw error;

      const isQuiz = formSchema?.attrs?.quizMode === true;
      if (isQuiz) {
        localStorage.setItem(`quiz_submitted_${formId}`, "true");
      }

      setSubmitted(true);
    } catch (err: any) {
      console.error("Submission failed:", err);
      alert(`Failed to submit form: ${err.message || 'Unknown error'}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="text-zinc-400 animate-pulse font-medium">Loading form...</div>
      </div>
    );
  }

  if (error === "restricted") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 relative pb-16">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-zinc-200 text-center max-w-md">
          <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-zinc-900 mb-2">Restricted Form</h2>
          <p className="text-zinc-600 mb-6">This form requires you to be logged in and have permission to access it.</p>
          <Link href={`/login?redirect=/s/${formId}${versionQuery ? '?version=' + versionQuery : ''}`} className="inline-flex justify-center w-full px-4 py-2 text-sm font-medium text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2">
            Sign In to Access
          </Link>
        </div>
        <PoweredByBadge />
      </div>
    );
  }

  if (error === "already_submitted") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 relative pb-16">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-zinc-200 text-center max-w-md w-full mx-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trophy className="w-6 h-6 text-amber-600" />
          </div>
          <h2 className="text-xl font-semibold text-zinc-900 mb-2">Quiz Already Submitted</h2>
          <p className="text-zinc-600 mb-6 text-sm">You have already completed this quiz. Multiple attempts are not permitted.</p>
          <Link href="/dashboard" className="inline-flex justify-center w-full px-4 py-2 text-sm font-medium text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500">
            Back to Dashboard
          </Link>
        </div>
        <PoweredByBadge />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 relative pb-16">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-zinc-200 text-center max-w-sm w-full mx-4">
          <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-zinc-900 mb-2">Oops!</h2>
          <p className="text-zinc-600 mb-6">{error}</p>
        
          <div className="pt-4 border-t border-zinc-100 flex items-center justify-center gap-1.5 text-xs text-zinc-400">
            <span>Powered by</span>
            <Link href="/" className="font-semibold text-zinc-700 hover:text-zinc-900 flex items-center gap-1.5 group">
              <span>FieldTally</span>
              <div className="w-4 h-4 bg-gradient-to-r from-zinc-600 to-zinc-800 rounded-md flex items-center justify-center opacity-90 group-hover:opacity-100 transition-opacity">
                <span className="text-white text-[8px] font-bold tracking-tighter">FT</span>
              </div>
            </Link>
          </div>
        </div>
        <PoweredByBadge />
      </div>
    );
  }

  if (submitted) {
    const isQuiz = formSchema?.attrs?.quizMode === true;
    const showImmediate = formSchema?.attrs?.showResultsImmediately !== false;

    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 relative pb-16">
        <div className="bg-white p-10 rounded-2xl shadow-sm border border-zinc-200 text-center max-w-md animate-in fade-in zoom-in duration-500 w-full mx-4">
          <div className="w-16 h-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-zinc-900 mb-3">Response Submitted!</h2>
          
          {isQuiz ? (
            showImmediate && quizResult ? (
              <>
                <p className="text-zinc-600 mb-6">Your response has been recorded successfully.</p>
                <div className="mb-6 p-6 bg-zinc-50 border border-zinc-200/80 rounded-2xl flex flex-col gap-2 items-center justify-center">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Your Score</span>
                  <span className="text-3xl font-extrabold text-zinc-800 leading-none">
                    {quizResult.score} / {quizResult.totalPoints}
                  </span>
                  <span className="text-xs font-semibold text-emerald-600">
                    ({quizResult.percentage}% Correct)
                  </span>
                </div>
              </>
            ) : (
              <p className="text-zinc-600 mb-8 text-base">
                You have submitted your response. Your mentor will check it and give the marks.
              </p>
            )
          ) : (
            <p className="text-zinc-600 mb-8 text-lg">Thank you for completing this form.</p>
          )}

          {!isQuiz && (
            <button 
              onClick={() => setSubmitted(false)}
              className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
            >
              Submit another response
            </button>
          )}
        </div>
        <PoweredByBadge />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 relative pb-16">
      {!isLatestVersion && (
        <div className="bg-amber-100 text-amber-800 px-4 py-3 text-sm text-center font-medium sticky top-[45px] z-50">
          Note: You are viewing an older version of this form.
        </div>
      )}
      
      {/* Utility top bar */}
      <div className="w-full bg-white/80 backdrop-blur-xl border-b border-zinc-200/60 sticky top-0 z-40 px-6 py-2 flex items-center justify-between shadow-2xs">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-5 h-5 bg-gradient-to-br from-zinc-800 to-zinc-600 rounded flex items-center justify-center">
            <span className="text-white text-[10px] font-bold tracking-tighter">FT</span>
          </div>
          <span className="font-semibold text-zinc-700 tracking-tight text-xs">FieldTally</span>
        </Link>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-800 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200/60 rounded-lg shadow-2xs transition-all cursor-pointer"
          >
            {copiedUrl ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
            <span>{copiedUrl ? "Copied Link!" : "Copy Link"}</span>
          </button>
          
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-800 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200/60 rounded-lg shadow-2xs transition-all cursor-pointer"
          >
            <FileDown className="w-3.5 h-3.5 text-zinc-400" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      <div className="pt-8 pb-20 px-4 sm:px-6 max-w-3xl mx-auto">
        <FormRenderer
          schema={formSchema}
          title={formTitle}
          progressBarOffset="45px"
          onSubmit={handleSubmit}
          readOnly={userRole === 'viewer'}
        />
      </div>

      <PoweredByBadge />
    </div>
  );
}

export default function SubmissionPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-zinc-50"><div className="text-zinc-400 animate-pulse font-medium">Loading...</div></div>}>
      <SubmissionPageContent />
    </Suspense>
  );
}
